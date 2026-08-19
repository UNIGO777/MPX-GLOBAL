import { Organisation } from '../models/Organisation.js';
import { Product } from '../models/Product.js';
import { Conversation } from '../models/Conversation.js';
import { Inquiry } from '../models/Inquiry.js';
import { User } from '../models/User.js';
import { PERMISSIONS } from '../config/permissions.js';
import { PURGE_AFTER_DAYS, NEARING_PURGE_DAYS, nearingPurgeFilter } from './adminProducts.service.js';

/**
 * M5-E — the dashboard.
 *
 * §5: three bands ordered by how often they are acted on, and NOT a metrics
 * wall — only things that ask for work. Every number carries the query that
 * reproduces its list, because a count you cannot click through is a dead end:
 * the admin ends up re-finding the same rows by hand.
 *
 * Permission filtering (D1): the dashboard has no permission of its own, but a
 * tile is only computed if the caller holds the permission for the list it links
 * to — so a tile can never link someone to a page they cannot open.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function can(user, permission) {
  if (user.role === 'superadmin') return true;
  return (user.permissions ?? []).includes(permission);
}

/**
 * W1 — the nearing-purge filter lives in adminProducts.service and is shared
 * with the monitoring list, so the tile's count and the list it links to can
 * never drift apart. It mirrors the purge job: taken down, old enough, and NOT
 * archived (A7).
 */

/**
 * D3 — VERIFICATIONS ONLY, never "time to decision".
 *
 * `verifiedAt` is cleared on reject (it means "verified, and when" — a rejected
 * org must not carry one), so a rejection's decision time exists only in
 * AuditLog. Averaging what we have and labelling it honestly beats an aggregate
 * that quietly means something else.
 */
async function verificationTurnaround() {
  const rows = await Organisation.aggregate([
    { $match: { kycStatus: 'verified', verifiedAt: { $ne: null }, kycSubmittedAt: { $ne: null } } },
    { $project: { days: { $divide: [{ $subtract: ['$verifiedAt', '$kycSubmittedAt'] }, DAY_MS] } } },
    { $group: { _id: null, avgDays: { $avg: '$days' }, sample: { $sum: 1 } } },
  ]);
  const r = rows[0];
  return {
    // Named for what it measures. Not "days to decision".
    averageDaysToVerify: r ? Number(r.avgDays.toFixed(1)) : null,
    sample: r?.sample ?? 0,
  };
}

/**
 * Owner override, 2026-08-18: trend graphs were deferred by §5 ("month 1 will
 * not have enough data for a graph to mean anything") and the owner explicitly
 * pulled them back in for the dashboard. This is the smallest honest version —
 * a 14-day daily count of things that already carry `createdAt`, no new models,
 * no stored counters.
 *
 * Buckets are UTC calendar days — the same clock `createdAt` is stored on. A
 * local-time bucketing would double-count around midnight IST, and "which day
 * did this signup land on" only has to be CONSISTENT, not localised.
 *
 * Zero-filled server-side: a day with no rows must exist as 0, or the chart's
 * x-axis compresses and a quiet week silently vanishes.
 */
export const SERIES_DAYS = 14;

/**
 * The ranges the chart may ask for — an ALLOWLIST, enforced again by the route
 * validator. Not arbitrary integers: `days=100000` would aggregate the whole
 * collection into a five-figure zero-fill for no reason.
 */
export const SERIES_RANGES = [7, 14, 30, 90];

async function dailyCounts(Model, filter, since) {
  const rows = await Model.aggregate([
    { $match: { ...filter, createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
        n: { $sum: 1 },
      },
    },
  ]);
  return new Map(rows.map((r) => [r._id, r.n]));
}

async function buildSeries(user, now, seriesDays) {
  const dayKey = (d) => d.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - (seriesDays - 1) * DAY_MS);
  const days = Array.from({ length: seriesDays }, (_, i) => dayKey(new Date(start.getTime() + i * DAY_MS)));
  const since = new Date(`${days[0]}T00:00:00.000Z`);

  const series = { days };
  if (can(user, PERMISSIONS.ORGANISATION_READ)) {
    const m = await dailyCounts(Organisation, { type: { $ne: 'platform' } }, since);
    series.organisations = days.map((d) => m.get(d) ?? 0);
  }
  // Enquiries ride on the conversation permission: an Inquiry and its thread
  // are one-to-one (M4-35), so anyone allowed to see the threads may see how
  // many were opened. NOT message counts — those stay excluded (§5).
  if (can(user, PERMISSIONS.CONVERSATION_READ)) {
    const m = await dailyCounts(Inquiry, {}, since);
    series.enquiries = days.map((d) => m.get(d) ?? 0);
  }
  // Only the axis came back — the caller holds neither permission, so there is
  // no chart to draw and the client hides the panel entirely.
  if (!series.organisations && !series.enquiries) return null;
  return series;
}

export async function buildDashboard({ user, now = new Date(), seriesDays = SERIES_DAYS }) {
  const tiles = {};

  const canBuyer = can(user, PERMISSIONS.BUYER_APPROVE);
  const canExporter = can(user, PERMISSIONS.EXPORTER_VERIFY);
  const canProducts = can(user, PERMISSIONS.PRODUCT_READ);
  const canOrgs = can(user, PERMISSIONS.ORGANISATION_READ);

  // --- Needs action --------------------------------------------------------
  if (canBuyer) {
    tiles.pendingBuyerVerifications = {
      count: await Organisation.countDocuments({ buyerSide: true, kycStatus: 'submitted', type: { $ne: 'platform' } }),
      link: { path: '/admin/orgs', query: { side: 'buyer', verification: 'submitted' } },
    };
  }
  if (canExporter) {
    tiles.pendingExporterVerifications = {
      count: await Organisation.countDocuments({ exporterSide: true, kycStatus: 'submitted', type: { $ne: 'platform' } }),
      link: { path: '/admin/orgs', query: { side: 'exporter', verification: 'submitted' } },
    };
  }

  /**
   * ⚠️ §5 — the two tiles above are NOT independent queues. `kycStatus` is one
   * shared value per Organisation, so a both-sides company in `submitted`
   * appears in BOTH counts, and whichever review runs first verifies the whole
   * company. Reported explicitly so the screen can say so — otherwise the two
   * numbers read as two separate reviews and sum to more work than exists.
   */
  if (canBuyer || canExporter) {
    tiles.bothSidesPending = {
      count: await Organisation.countDocuments({
        buyerSide: true, exporterSide: true, kycStatus: 'submitted', type: { $ne: 'platform' },
      }),
      note: 'Counted in both verification tiles. Reviewing either side verifies the whole company.',
    };
  }

  if (canOrgs) {
    tiles.rejectedAwaitingResubmit = {
      count: await Organisation.countDocuments({ kycStatus: 'rejected', type: { $ne: 'platform' } }),
      link: { path: '/admin/orgs', query: { verification: 'rejected' } },
    };
  }

  if (canProducts) {
    tiles.blockedProducts = {
      count: await Product.countDocuments({ 'takedown.isDown': true }),
      link: { path: '/admin/products', query: { status: 'blocked' } },
    };
    tiles.nearingPurge = {
      count: await Product.countDocuments(nearingPurgeFilter(now)),
      afterDays: PURGE_AFTER_DAYS,
      warnFromDays: NEARING_PURGE_DAYS,
      // Reproduces THIS count, not "every blocked product".
      link: { path: '/admin/products', query: { nearingPurge: 'true' } },
    };
  }

  // --- Health --------------------------------------------------------------
  const health = canOrgs ? { verification: await verificationTurnaround() } : {};

  // --- Totals --------------------------------------------------------------
  const totals = {};
  if (canOrgs) {
    const [buyerOnly, exporterOnly, both] = await Promise.all([
      Organisation.countDocuments({ buyerSide: true, exporterSide: { $ne: true }, type: { $ne: 'platform' } }),
      Organisation.countDocuments({ exporterSide: true, buyerSide: { $ne: true }, type: { $ne: 'platform' } }),
      Organisation.countDocuments({ buyerSide: true, exporterSide: true, type: { $ne: 'platform' } }),
    ]);
    totals.organisations = { buyerOnly, exporterOnly, both };
    totals.users = await User.countDocuments({});
  }
  if (canProducts) {
    totals.activeProducts = await Product.countDocuments({
      status: 'active', 'takedown.isDown': { $ne: true },
    });
  }
  if (can(user, PERMISSIONS.CONVERSATION_READ)) {
    totals.conversations = await Conversation.countDocuments({});
  }

  return { tiles, health, totals, series: await buildSeries(user, now, seriesDays) };
}
