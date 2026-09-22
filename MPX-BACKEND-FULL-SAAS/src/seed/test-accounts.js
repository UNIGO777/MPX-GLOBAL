import mongoose from 'mongoose';

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { hashPassword } from '../services/password.service.js';
import { PERMISSIONS } from '../config/permissions.js';
import '../models/index.js';
import { User } from '../models/User.js';
import { Organisation } from '../models/Organisation.js';

/**
 * Seed the DEMO accounts handed to the client — one buyer, one exporter, one
 * employee. Idempotent: an account that already exists is left alone.
 *
 * Run with `npm run seed:test-accounts`.
 *
 * 🔴 DEVELOPMENT ONLY — the script refuses to run anywhere else (see `run()`).
 * CLAUDE.md forbids seed scripts that touch production-shaped data, and these
 * create real `User` and `Organisation` documents; the guard is what keeps that
 * from ever pointing at a live database.
 *
 * 🔴 These are GENERIC logins, which `auth-sessions.md` ("named accounts only")
 * otherwise forbids. They are demo fixtures, not staff accounts: delete them
 * before the platform carries real users. The `.test` marker in every email is
 * there so they are trivial to find and remove.
 *
 * 🔴 The password comes from `SEED_TEST_PASSWORD` in `.env` — never from source
 * (CLAUDE.md #3) — and is never logged, printed or returned. The operator
 * already knows it; nothing here needs to echo it back.
 *
 * ⚠️ Pair this with `OTP_DEV_FIXED_CODE=true`, or nobody can sign in: every
 * login is OTP-gated (`auth.service.js`), and these accounts carry made-up
 * numbers that no real code can reach.
 *
 * WHY NO KYC IS PRE-DONE (owner, 2026-09-21): the buyer and the exporter are
 * created exactly as a fresh signup leaves them — `kycStatus: 'pending'`, no
 * documents, nothing submitted. That is deliberate. Pre-verifying the exporter
 * would have hidden the whole journey the client most wants to see: submit
 * documents as the exporter, review and decide them as the employee, watch the
 * tick appear. A seeded tick is a screenshot; this is the product working.
 */

/** Ofcom's reserved drama range (+44 7700 900xxx) — guaranteed to reach nobody. */
const DEMO_ACCOUNTS = [
  {
    key: 'buyer',
    name: 'Demo Buyer',
    email: 'demo-buyer@mpx.test',
    mobile: { countryCode: '+44', number: '7700900101', e164: '+447700900101' },
    role: 'buyer',
    org: {
      name: 'Demo Buyer Imports',
      type: 'business',
      buyerSide: true,
      country: 'GB',
      entityType: 'business',
      address: { line1: '1 Demo Street', city: 'London', postalCode: 'EC1A 1BB' },
    },
  },
  {
    key: 'exporter',
    name: 'Demo Exporter',
    email: 'demo-exporter@mpx.test',
    mobile: { countryCode: '+44', number: '7700900102', e164: '+447700900102' },
    role: 'exporter',
    org: {
      name: 'Demo Exports',
      type: 'business',
      exporterSide: true,
      country: 'IN',
      entityType: 'business',
      address: { line1: '2 Demo Road', city: 'Tirupur', state: 'Tamil Nadu', postalCode: '641601' },
    },
  },
  {
    key: 'employee',
    name: 'Demo Employee',
    email: 'demo-employee@mpx.test',
    mobile: { countryCode: '+44', number: '7700900103', e164: '+447700900103' },
    role: 'employee',
    // A REVIEWER's grant, not a blanket one. `security-baseline.md` says never
    // blanket-grant, and a scoped employee also demonstrates something true:
    // the sidebar renders from server-supplied permissions, so the client can
    // see that access is really gated. The superadmin account (`npm run seed`)
    // is the all-access one.
    permissions: [
      PERMISSIONS.EXPORTER_VERIFY,
      PERMISSIONS.BUYER_APPROVE,
      PERMISSIONS.KYC_VIEW,
      PERMISSIONS.ORGANISATION_READ,
      PERMISSIONS.USER_READ,
      PERMISSIONS.CONVERSATION_READ,
      PERMISSIONS.AUDIT_READ,
    ],
  },
];

async function orgFor(spec) {
  const existing = await Organisation.findOne({ name: spec.name });
  if (existing) return existing;
  // kycStatus is left at the model's default — nothing is pre-verified.
  return Organisation.create(spec);
}

async function run() {
  // 🔴 The guard. Not "not production" — development ONLY, matching how every
  // other dev affordance in this codebase is locked (OTP_DEV_PRINT, the fixed
  // OTP code). `test` is excluded too, so a suite can never seed into its DB.
  if (env.NODE_ENV !== 'development') {
    throw new Error(
      `refusing to seed demo accounts with NODE_ENV=${env.NODE_ENV} — development only`,
    );
  }

  const password = env.SEED_TEST_PASSWORD;
  if (!password) throw new Error('SEED_TEST_PASSWORD is required in .env to seed demo accounts');

  await mongoose.connect(env.MONGODB_URI);
  await User.syncIndexes();
  await Organisation.syncIndexes();

  const created = [];
  const skipped = [];

  for (const spec of DEMO_ACCOUNTS) {
    const email = spec.email.toLowerCase();

    // (email, role) is the unique index — scope the existence check to both, or
    // a buyer would block an exporter that is legitimately allowed to share it.
    if (await User.findOne({ email, role: spec.role })) {
      skipped.push(`${spec.role} ${email}`);
      continue;
    }

    // An employee belongs to the platform org, not a company of its own.
    const orgId = spec.org
      ? (await orgFor(spec.org))._id
      : (await Organisation.findOne({ type: 'platform' }))?._id;

    if (!orgId) {
      throw new Error('no platform organisation — run `npm run seed` first to create it');
    }

    await User.create({
      name: spec.name,
      email,
      mobile: spec.mobile,
      passwordHash: await hashPassword(password),
      role: spec.role,
      orgId,
      permissions: spec.permissions ?? [],
      isActive: true,
      // Both channels marked proved: these accounts skip signup, and an
      // unverified flag would block flows the client is meant to walk through.
      isEmailVerified: true,
      isMobileVerified: true,
      // 🔴 FALSE deliberately. A superadmin-created employee normally carries
      // `mustChangePassword: true`, and `middleware/authorize.js` blocks EVERY
      // authorised route until it is cleared — a client handed that account
      // would be locked out of the entire panel on first login.
      mustChangePassword: false,
    });

    created.push(`${spec.role} ${email}`);
  }

  // Emails and roles only — never the password (A1 / CLAUDE.md #4).
  logger.info({ created, skipped }, 'demo accounts seeded');
  await mongoose.disconnect();
}

run().catch((err) => {
  logger.error({ err: { name: err.name, message: err.message } }, 'demo account seed failed');
  process.exit(1);
});
