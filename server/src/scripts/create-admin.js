/**
 * Creates an admin invitation from the command line (e.g. on the production server):
 *   npm run create-admin -- admin@yourdomain.com "Full Name"
 * Prints a one-time activation link; the new admin chooses their own password.
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { User } from '../models/index.js';
import { ROLES, USER_STATUS } from '../config/constants.js';
import { createOneTimeToken } from '../services/token.service.js';
import { randomToken } from '../utils/helpers.js';

const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(' ') || 'Administrator';

async function main() {
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Usage: npm run create-admin -- <email> "<name>"');
  if (!(await connectDB({ retry: false }))) throw new Error('Could not connect to MongoDB');
  let user = await User.findOne({ email: email.toLowerCase() });
  if (user && user.status === USER_STATUS.ACTIVE) throw new Error('An active account with this email already exists.');
  if (!user) {
    user = await User.create({ name, email: email.toLowerCase(), role: ROLES.ADMIN, status: USER_STATUS.PENDING, unsubscribeToken: randomToken(24) });
  }
  const token = await createOneTimeToken(user._id, 'invite');
  console.log(`\nAdmin invitation created for ${email}.\nOpen this link within 72 hours to set a password:\n\n  ${env.CLIENT_URL}/accept-invite/${token}\n`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
