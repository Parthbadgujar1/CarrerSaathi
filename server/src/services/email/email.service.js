/**
 * Email delivery through a transactional outbox:
 *   sendEmail() only writes to MongoDB (fast, never throws to the caller),
 *   a background worker delivers queued mail with exponential backoff.
 * Without SMTP credentials (local development) emails are written as .html
 * files to server/storage/mail so every flow can still be tested end-to-end.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { isDbReady } from '../../config/db.js';
import { EmailOutbox } from '../../models/index.js';
import { templates } from './templates.js';

const MAX_ATTEMPTS = 5;
let transporter = null;
let lastStatus = { ok: null, checkedAt: null, error: null };

function getTransporter() {
  if (!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      pool: true,
      maxConnections: 3,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transporter;
}

export const emailTransportName = () => (env.resendConfigured ? 'resend' : env.smtpConfigured ? 'smtp' : 'file');

/** HTTPS email API — works on hosts that block outbound SMTP ports (e.g. Railway Hobby/Trial). */
async function sendViaResend(mail) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/** Queue an email from a named template. Returns true if queued. */
export async function sendEmail(to, templateName, data = {}) {
  try {
    const tpl = templates[templateName];
    if (!tpl) throw new Error(`Unknown email template: ${templateName}`);
    const { subject, html, text } = tpl(data);
    await EmailOutbox.create({ to, subject, html, text, template: templateName });
    setImmediate(() => processOutbox().catch(() => {})); // try promptly, worker retries otherwise
    return true;
  } catch (err) {
    logger.error('Failed to queue email', { template: templateName, message: err.message });
    return false;
  }
}

async function deliver(mail) {
  if (env.resendConfigured) {
    await sendViaResend(mail);
    return 'resend';
  }
  const t = getTransporter();
  if (t) {
    await t.sendMail({ from: env.MAIL_FROM, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text });
    return 'smtp';
  }
  await fs.mkdir(env.paths.mail, { recursive: true });
  const safeTo = mail.to.replace(/[^a-z0-9@._-]/gi, '_');
  const file = path.join(env.paths.mail, `${Date.now()}-${mail.template || 'mail'}-${safeTo}.html`);
  await fs.writeFile(file, `<!-- To: ${mail.to} | Subject: ${mail.subject} -->\n${mail.html}`, 'utf8');
  const link = mail.html.match(/href="(http[^"]+)"/)?.[1];
  logger.info(`[dev-mail] "${mail.subject}" → ${mail.to}${link ? ` | link: ${link.replace(/&amp;/g, '&')}` : ''}`);
  return 'file';
}

let running = false;
export async function processOutbox(batchSize = 10) {
  if (running || !isDbReady()) return;
  running = true;
  try {
    for (let i = 0; i < batchSize; i += 1) {
      const mail = await EmailOutbox.findOneAndUpdate(
        { status: 'queued', nextAttemptAt: { $lte: new Date() } },
        { status: 'sending', $inc: { attempts: 1 } },
        { new: true, sort: { nextAttemptAt: 1 } },
      );
      if (!mail) break;
      try {
        const transport = await deliver(mail);
        mail.status = 'sent';
        mail.sentAt = new Date();
        mail.transport = transport;
        mail.lastError = undefined;
        lastStatus = { ok: true, checkedAt: new Date(), error: null };
      } catch (err) {
        const giveUp = mail.attempts >= MAX_ATTEMPTS;
        mail.status = giveUp ? 'failed' : 'queued';
        mail.lastError = err.message?.slice(0, 500);
        mail.nextAttemptAt = new Date(Date.now() + 2 ** mail.attempts * 60_000); // 2,4,8,16 min
        lastStatus = { ok: false, checkedAt: new Date(), error: err.message };
        logger.warn('Email delivery failed', { to: mail.to, attempt: mail.attempts, giveUp, message: err.message });
      }
      await mail.save();
    }
  } finally {
    running = false;
  }
}

/** Mail that got stuck in "sending" (e.g. process crashed mid-send) goes back to the queue. */
export async function recoverStuckEmails() {
  await EmailOutbox.updateMany(
    { status: 'sending', updatedAt: { $lt: new Date(Date.now() - 10 * 60_000) } },
    { status: 'queued', nextAttemptAt: new Date() },
  );
}

export async function emailHealth() {
  const [queued, failed] = isDbReady()
    ? await Promise.all([EmailOutbox.countDocuments({ status: 'queued' }), EmailOutbox.countDocuments({ status: 'failed' })])
    : [null, null];
  return { transport: emailTransportName(), lastDelivery: lastStatus, queued, failed };
}
