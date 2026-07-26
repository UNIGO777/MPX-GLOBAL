import mongoose from 'mongoose';

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { hashPassword } from '../services/password.service.js';
import '../models/index.js';
import { User } from '../models/User.js';
import { Organisation } from '../models/Organisation.js';

// Seed a single superadmin from .env. Idempotent: re-running skips if the email
// already exists. The password is read from the environment (never source) and
// stored only as an argon2 hash — it is never logged.
function required(name, value) {
  if (!value) throw new Error(`${name} is required in .env to seed the superadmin`);
  return value;
}

function normalizeMobile(cc, number) {
  const c = String(cc).replace(/\D/g, '');
  const n = String(number).replace(/\D/g, '');
  return { countryCode: `+${c}`, number: n, e164: `+${c}${n}` };
}

async function run() {
  const name = required('SEED_SUPERADMIN_NAME', env.SEED_SUPERADMIN_NAME);
  const email = required('SEED_SUPERADMIN_EMAIL', env.SEED_SUPERADMIN_EMAIL).toLowerCase();
  const cc = required('SEED_SUPERADMIN_MOBILE_CC', env.SEED_SUPERADMIN_MOBILE_CC);
  const number = required('SEED_SUPERADMIN_MOBILE_NUMBER', env.SEED_SUPERADMIN_MOBILE_NUMBER);
  const password = required('SEED_SUPERADMIN_PASSWORD', env.SEED_SUPERADMIN_PASSWORD);

  await mongoose.connect(env.MONGODB_URI);
  await User.syncIndexes();
  await Organisation.syncIndexes();

  let platform = await Organisation.findOne({ type: 'platform' });
  if (!platform) {
    platform = await Organisation.create({ name: 'MPX Global Platform', type: 'platform' });
    logger.info({ orgId: String(platform._id) }, 'created platform organisation');
  }

  if (await User.findOne({ email })) {
    logger.warn({ email }, 'superadmin already exists — nothing to do');
    await mongoose.disconnect();
    return;
  }

  const user = await User.create({
    name,
    email,
    mobile: normalizeMobile(cc, number),
    passwordHash: await hashPassword(password),
    role: 'superadmin',
    orgId: platform._id,
    isActive: true,
    isEmailVerified: true,
    isMobileVerified: true,
    mustChangePassword: false,
  });

  logger.info({ email: user.email, role: user.role, userId: String(user._id) }, 'superadmin seeded');
  await mongoose.disconnect();
}

run().catch((err) => {
  logger.error({ err: { name: err.name, message: err.message } }, 'superadmin seed failed');
  process.exit(1);
});
