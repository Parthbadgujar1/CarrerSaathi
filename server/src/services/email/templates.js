import { env } from '../../config/env.js';

export const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const button = (href, label) =>
  `<a href="${esc(href)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">${esc(label)}</a>`;

/**
 * Shared email layout. Every email carries the business identity; marketing
 * emails additionally carry a one-click unsubscribe link (required).
 */
function layout({ title, body, unsubscribeUrl }) {
  const prefsUrl = `${env.CLIENT_URL}/app/profile?tab=settings`;
  const footerLinks = unsubscribeUrl
    ? `<a href="${esc(unsubscribeUrl)}" style="color:#475569">Unsubscribe</a> · <a href="${esc(prefsUrl)}" style="color:#475569">Email preferences</a>`
    : `<a href="${esc(prefsUrl)}" style="color:#475569">Email preferences</a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0">
<tr><td style="padding:24px 28px;border-bottom:1px solid #e2e8f0;font-weight:700;font-size:18px;color:#0f766e">${esc(env.APP_NAME)}</td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6">${body}</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#475569;line-height:1.6">
${esc(env.APP_NAME)} is operated by ${esc(env.BUSINESS_NAME)}${env.BUSINESS_ADDRESS ? `, ${esc(env.BUSINESS_ADDRESS)}` : ''}.<br>
${env.SUPPORT_EMAIL ? `Questions? ${esc(env.SUPPORT_EMAIL)}<br>` : ''}${footerLinks}
</td></tr></table></td></tr></table></body></html>`;
}

const toText = (html) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

function build(subject, body, opts = {}) {
  const html = layout({ title: subject, body, ...opts });
  return { subject, html, text: toText(html) };
}

export const templates = {
  verifyEmail: ({ name, url }) =>
    build(
      'Verify your email address',
      `<p>Hi ${esc(name)},</p><p>Welcome to ${esc(env.APP_NAME)}! Please confirm your email address to secure your account.</p><p>${button(url, 'Verify email')}</p><p style="color:#475569;font-size:13px">This link expires in 48 hours. If you did not sign up, you can ignore this email.</p>`,
    ),

  resetPassword: ({ name, url }) =>
    build(
      'Reset your password',
      `<p>Hi ${esc(name)},</p><p>We received a request to reset your password.</p><p>${button(url, 'Choose a new password')}</p><p style="color:#475569;font-size:13px">This link expires in 30 minutes and can be used once. If you did not request this, no action is needed — your password stays the same.</p>`,
    ),

  passwordChanged: ({ name }) =>
    build(
      'Your password was changed',
      `<p>Hi ${esc(name)},</p><p>Your ${esc(env.APP_NAME)} password was just changed and all other devices were signed out.</p><p>If this wasn't you, reset your password immediately and contact support.</p>`,
    ),

  mentorInvite: ({ name, url, invitedBy, role = 'mentor' }) =>
    build(
      `You're invited to join ${env.APP_NAME} as ${{ admin: 'an admin', student: 'a student' }[role] || 'a mentor'}`,
      `<p>Hi ${esc(name)},</p><p>${esc(invitedBy)} has added you as ${{ admin: 'an administrator', student: 'a student' }[role] || 'a mentor'} on ${esc(env.APP_NAME)}. Set your password to activate your account${role === 'mentor' ? ' and start guiding students' : ''}.</p><p>${button(url, 'Activate account')}</p><p style="color:#475569;font-size:13px">This invitation expires in 72 hours.</p>`,
    ),

  mentorApproved: ({ name, url }) =>
    build(
      'Your mentor application was approved',
      `<p>Hi ${esc(name)},</p><p>Great news — your mentor application has been approved. You can now sign in and connect with students.</p><p>${button(url, 'Sign in')}</p>`,
    ),

  mentorRejected: ({ name }) =>
    build(
      'Update on your mentor application',
      `<p>Hi ${esc(name)},</p><p>Thank you for applying to mentor on ${esc(env.APP_NAME)}. We are unable to approve your application at this time. You are welcome to apply again in the future.</p>`,
    ),

  deletionScheduled: ({ name, date, url }) =>
    build(
      'Your account deletion is scheduled',
      `<p>Hi ${esc(name)},</p><p>As requested, your account and personal data will be permanently deleted on <strong>${esc(date)}</strong>.</p><p>Changed your mind? Simply sign in before that date to cancel the deletion.</p><p>${button(url, 'Sign in to cancel')}</p>`,
    ),

  deletionCompleted: ({ name }) =>
    build(
      'Your account has been deleted',
      `<p>Hi ${esc(name)},</p><p>Your ${esc(env.APP_NAME)} account and associated personal data have been permanently deleted. Thank you for being part of our community.</p>`,
    ),

  notification: ({ name, title, body, url }) =>
    build(
      title,
      `<p>Hi ${esc(name)},</p><p><strong>${esc(title)}</strong></p><p>${esc(body)}</p>${url ? `<p>${button(url, 'Open CareerSaathi')}</p>` : ''}`,
    ),

  announcement: ({ name, title, body, unsubscribeUrl }) =>
    build(
      title,
      `<p>Hi ${esc(name)},</p><h2 style="font-size:18px;margin:0 0 12px">${esc(title)}</h2><p style="white-space:pre-line">${esc(body)}</p><p>${button(env.CLIENT_URL + '/app', 'Open dashboard')}</p>`,
      { unsubscribeUrl },
    ),
};
