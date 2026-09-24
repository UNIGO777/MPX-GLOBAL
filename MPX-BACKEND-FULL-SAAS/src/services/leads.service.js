import { ROUTED_NOTICE } from '../utils/messageText.js';
import { randomBytes } from 'node:crypto';

import { AuditLog } from '../models/AuditLog.js';
import { Category } from '../models/Category.js';
import { Lead } from '../models/Lead.js';
import { Message } from '../models/Message.js';
import { Organisation } from '../models/Organisation.js';
import { Product } from '../models/Product.js';
import { User } from '../models/User.js';
import { PERMISSIONS } from '../config/permissions.js';
import { AppError } from '../utils/AppError.js';
import { recordAudit } from './audit.service.js';
import { createInquiry } from './inquiry.service.js';

/**
 * Step 1d · Enquiry routing — "help me find a supplier" (quote Module 6).
 *
 * Buyer side: create + read OWN requests, scoped `{ buyerOrgId }` from the token
 * (404 otherwise). Staff side (`lead:manage`): queue, assign, status, and ROUTE —
 * which opens a normal enquiry + chat IN THE BUYER'S NAME through the existing
 * `createInquiry` path, so every guard it carries still applies (the product
 * must be publicly live, no self-enquiry, one thread per buyer × product).
 *
 * Every staff/buyer action writes one AuditLog row (entityType `lead`).
 */

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newRef = () => `R-${Array.from(randomBytes(6), (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join('')}`;

// The notice wording lives in utils/messageText.js (neutral for both parties).

function actorOf(user) {
  return { userId: user.userId, role: user.role };
}

function audit(user, action, lead, { before, after, meta } = {}) {
  return recordAudit({
    actor: actorOf(user),
    action,
    entityType: 'lead',
    entityId: lead._id,
    orgId: lead.buyerOrgId,
    before,
    after: { ref: lead.ref, ...(after ?? {}) },
    meta,
  });
}

async function names(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map();
  const users = await User.find({ _id: { $in: unique } }).select('name email').lean();
  return new Map(users.map((u) => [String(u._id), { name: u.name, email: u.email }]));
}

async function orgNames(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map();
  const orgs = await Organisation.find({ _id: { $in: unique } }).select('name slug').lean();
  return new Map(orgs.map((o) => [String(o._id), { name: o.name, slug: o.slug }]));
}

async function productNames(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map();
  const products = await Product.find({ _id: { $in: unique } }).select('name slug').lean();
  return new Map(products.map((p) => [String(p._id), { name: p.name, slug: p.slug }]));
}

/** What the BUYER sees — no assignee, no staff names (they talk to "MPX Global"). */
async function buyerView(lead) {
  const [orgs, products] = await Promise.all([
    orgNames(lead.routedTo.map((r) => r.exporterOrgId)),
    productNames(lead.routedTo.map((r) => r.productId)),
  ]);
  return {
    id: String(lead._id),
    ref: lead.ref,
    what: lead.what,
    quantity: lead.quantity ?? null,
    unit: lead.unit ?? null,
    destinationCountry: lead.destinationCountry ?? null,
    note: lead.note ?? '',
    status: lead.status,
    createdAt: lead.createdAt,
    suppliers: lead.routedTo.map((r) => ({
      exporter: orgs.get(String(r.exporterOrgId))?.name ?? '—',
      product: products.get(String(r.productId))?.name ?? '—',
      conversationId: String(r.conversationId),
      at: r.at,
    })),
  };
}

async function staffView(lead, maps) {
  const people = maps?.people ?? (await names([lead.createdBy, lead.assignedTo, ...lead.routedTo.map((r) => r.by)]));
  const orgs = maps?.orgs ?? (await orgNames([lead.buyerOrgId, ...lead.routedTo.map((r) => r.exporterOrgId)]));
  const products = maps?.products ?? (await productNames(lead.routedTo.map((r) => r.productId)));
  return {
    id: String(lead._id),
    ref: lead.ref,
    what: lead.what,
    quantity: lead.quantity ?? null,
    unit: lead.unit ?? null,
    destinationCountry: lead.destinationCountry ?? null,
    note: lead.note ?? '',
    status: lead.status,
    buyer: {
      orgId: String(lead.buyerOrgId),
      org: orgs.get(String(lead.buyerOrgId))?.name ?? '—',
      name: people.get(String(lead.createdBy))?.name ?? '—',
      email: people.get(String(lead.createdBy))?.email ?? null,
    },
    assignedTo: lead.assignedTo ? { id: String(lead.assignedTo), name: people.get(String(lead.assignedTo))?.name ?? '—' } : null,
    routedTo: lead.routedTo.map((r) => ({
      exporterOrgId: String(r.exporterOrgId),
      exporter: orgs.get(String(r.exporterOrgId))?.name ?? '—',
      productId: String(r.productId),
      product: products.get(String(r.productId))?.name ?? '—',
      conversationId: String(r.conversationId),
      created: r.created,
      by: people.get(String(r.by))?.name ?? '—',
      at: r.at,
    })),
    createdAt: lead.createdAt,
    closedAt: lead.closedAt ?? null,
  };
}

// ─────────────────────────────── buyer side ────────────────────────────────

function requireBuyer(user) {
  if (user.role !== 'buyer' || !user.orgId) {
    throw AppError.forbidden('not a buyer', 'Only buyer accounts can request suppliers.');
  }
}

export async function createLead({ user, what, quantity, unit, destinationCountry, note, meta }) {
  requireBuyer(user);
  const org = await Organisation.findOne({ _id: user.orgId }).select('buyerSide');
  if (!org?.buyerSide) throw AppError.forbidden('not a buyer org', 'Not allowed.');

  let lead;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      lead = await Lead.create({
        buyerOrgId: user.orgId,
        createdBy: user.userId,
        ref: newRef(),
        what,
        quantity,
        unit,
        destinationCountry,
        note: note ?? '',
      });
      break;
    } catch (err) {
      if (err?.code !== 11000 || attempt === 2) throw err;
    }
  }
  await audit(user, 'lead.create', lead, { meta });
  return buyerView(lead);
}

export async function listMyLeads({ user }) {
  requireBuyer(user);
  const rows = await Lead.find({ buyerOrgId: user.orgId }).sort({ createdAt: -1 }).limit(100);
  return Promise.all(rows.map(buyerView));
}

export async function getMyLead({ user, id }) {
  requireBuyer(user);
  const lead = await Lead.findOne({ _id: id, buyerOrgId: user.orgId });
  if (!lead) throw AppError.notFound('lead not found', 'Request not found.');
  return buyerView(lead);
}

// ──────────────────────────────── staff side ────────────────────────────────

async function findAny(id) {
  const lead = await Lead.findOne({ _id: id });
  if (!lead) throw AppError.notFound('lead not found', 'Request not found.');
  return lead;
}

export async function listLeads({ actor, status, assignee, q, page = 1, pageSize = 20 }) {
  const filter = {};
  // Search the request's reference or what the buyer asked for.
  if (q) {
    const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ ref: rx }, { what: rx }];
  }
  if (status === 'active') filter.status = { $in: ['new', 'in_progress'] };
  else if (status) filter.status = status;
  if (assignee === 'me') filter.assignedTo = actor.userId;
  else if (assignee === 'unassigned') filter.assignedTo = null;
  else if (assignee) filter.assignedTo = assignee;

  const [rows, total] = await Promise.all([
    Lead.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    Lead.countDocuments(filter),
  ]);
  const people = await names(rows.flatMap((l) => [l.createdBy, l.assignedTo, ...l.routedTo.map((r) => r.by)]));
  const orgs = await orgNames(rows.flatMap((l) => [l.buyerOrgId, ...l.routedTo.map((r) => r.exporterOrgId)]));
  const products = await productNames(rows.flatMap((l) => l.routedTo.map((r) => r.productId)));
  return {
    rows: await Promise.all(rows.map((l) => staffView(l, { people, orgs, products }))),
    total,
    page,
    pageSize,
  };
}

export async function getLead({ id }) {
  return staffView(await findAny(id));
}

/** Staff a request can go to: active superadmins + employees holding `lead:manage`. */
async function canTake(userId) {
  return User.exists({
    _id: userId,
    isActive: true,
    $or: [{ role: 'superadmin' }, { role: 'employee', permissions: PERMISSIONS.LEAD_MANAGE }],
  });
}

export async function assignableStaff() {
  const users = await User.find({
    isActive: true,
    $or: [{ role: 'superadmin' }, { role: 'employee', permissions: PERMISSIONS.LEAD_MANAGE }],
  })
    .select('name role')
    .sort({ name: 1 })
    .lean();
  return users.map((u) => ({ id: String(u._id), name: u.name, role: u.role }));
}

export async function assignLead({ actor, id, assigneeId, meta }) {
  const lead = await findAny(id);
  if (assigneeId && !(await canTake(assigneeId))) {
    throw AppError.badRequest('bad assignee', 'That person cannot take supplier requests.');
  }
  const before = lead.assignedTo ? String(lead.assignedTo) : null;
  const next = assigneeId ? String(assigneeId) : null;
  if (before !== next) {
    lead.assignedTo = next;
    if (lead.status === 'new' && next) lead.status = 'in_progress';
    await lead.save();
    await audit(actor, 'lead.assign', lead, { before: { assignedTo: before }, after: { assignedTo: next }, meta });
  }
  return staffView(lead);
}

export async function setLeadStatus({ actor, id, status, meta }) {
  const lead = await findAny(id);
  if (lead.status === status) return staffView(lead);
  if (status === 'routed' && lead.routedTo.length === 0) {
    throw AppError.badRequest('not routed', 'Connect at least one supplier first.');
  }
  const before = lead.status;
  lead.status = status;
  lead.closedAt = status === 'closed' ? new Date() : null;
  await lead.save();
  await audit(actor, 'lead.status', lead, { before: { status: before }, after: { status }, meta });
  return staffView(lead);
}

/**
 * ROUTE — connect the request to one seller product. Opens (or links) the
 * buyer's normal enquiry thread through `createInquiry`, acting as the buyer
 * who raised the request. The seller hears about it through the EXISTING
 * new-enquiry push/email; no new notification event.
 */
export async function routeLead({ actor, id, productId, meta }) {
  const lead = await findAny(id);
  if (lead.status === 'closed') throw AppError.badRequest('closed', 'This request is closed.');
  if (lead.routedTo.some((r) => String(r.productId) === String(productId))) {
    throw AppError.conflict('already routed', 'This product is already connected to the request.');
  }

  const buyer = await User.findOne({ _id: lead.createdBy, isActive: true }).select('_id orgId role');
  if (!buyer || String(buyer.orgId) !== String(lead.buyerOrgId)) {
    throw AppError.badRequest('buyer gone', "The buyer's account is no longer active.");
  }

  // The enquiry's structured fields follow the product's category type (M4-9);
  // only goods carry quantity/unit/delivery country.
  const product = await Product.findOne({ _id: productId }).select('categoryId');
  if (!product) throw AppError.notFound('product not found', 'Product not found.');
  const leaf = await Category.findOne({ _id: product.categoryId }).select('type').lean();
  const fields =
    leaf?.type === 'goods'
      ? Object.fromEntries(
          Object.entries({ quantity: lead.quantity, unit: lead.unit, deliveryCountry: lead.destinationCountry }).filter(
            ([, v]) => v !== undefined && v !== null && v !== '',
          ),
        )
      : {};

  const { conversation, created } = await createInquiry({
    user: { userId: String(buyer._id), orgId: String(buyer.orgId), role: 'buyer' },
    productId,
    note: lead.what.slice(0, 200),
    fields,
    meta,
  });

  if (created) {
    await Message.create({
      conversationId: conversation._id,
      senderType: 'system',
      body: ROUTED_NOTICE,
      systemKind: 'routed',
    });
  }

  lead.routedTo.push({
    exporterOrgId: conversation.exporterOrgId,
    productId,
    conversationId: conversation._id,
    created,
    by: actor.userId,
  });
  const before = lead.status;
  lead.status = 'routed';
  if (!lead.assignedTo) lead.assignedTo = actor.userId;
  await lead.save();

  await audit(actor, 'lead.route', lead, {
    after: { productId: String(productId), conversationId: String(conversation._id), created },
    meta,
  });
  if (before !== 'routed') {
    await audit(actor, 'lead.status', lead, { before: { status: before }, after: { status: 'routed' }, meta });
  }
  return staffView(lead);
}

/** Every action on one request, oldest first. */
export async function leadTimeline({ id }) {
  const lead = await findAny(id);
  const rows = await AuditLog.find({ entityType: 'lead', entityId: lead._id }).sort({ occurredAt: 1, _id: 1 }).lean();
  const people = await names(rows.flatMap((r) => [r.actorId, r.before?.assignedTo, r.after?.assignedTo]));
  const nameOf = (v) => (v ? people.get(String(v))?.name ?? '—' : null);
  return rows.map((r) => ({
    id: String(r._id),
    at: r.occurredAt,
    action: r.action,
    actor: { id: String(r.actorId), name: nameOf(r.actorId), role: r.actorRole },
    from: r.before?.status ?? (r.action === 'lead.assign' ? nameOf(r.before?.assignedTo) : null),
    to: r.after?.status ?? (r.action === 'lead.assign' ? nameOf(r.after?.assignedTo) : null),
    created: r.after?.created ?? null,
  }));
}

export async function leadOverview() {
  const [fresh, inProgress, unassigned, routed7d, routed] = await Promise.all([
    Lead.countDocuments({ status: 'new' }),
    Lead.countDocuments({ status: 'in_progress' }),
    Lead.countDocuments({ status: { $in: ['new', 'in_progress'] }, assignedTo: null }),
    Lead.countDocuments({ status: 'routed', updatedAt: { $gte: new Date(Date.now() - 7 * 86400e3) } }),
    Lead.countDocuments({ status: 'routed' }),
  ]);
  return { counts: { new: fresh, inProgress, unassigned, routed7d, routed } };
}
