import { randomBytes } from 'node:crypto';

import mongoose from 'mongoose';

import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { CategoryAttribute } from '../models/CategoryAttribute.js';
import { Organisation } from '../models/Organisation.js';
import { AppError } from '../utils/AppError.js';
import { slugify } from '../utils/slug.js';
import { recordAudit } from './audit.service.js';
import { uploadPublicImage, isOwnCloudinaryUrl } from './image.storage.service.js';
import { searchFieldsFor } from './searchSync.service.js';
import { removeSavedForProduct } from './saved.service.js';

// D1/A15 caps (unverified sellers). A10: taken-down products do NOT occupy an
// active slot — the cap query excludes them explicitly.
export const MAX_ACTIVE_UNVERIFIED = 3;
export const MAX_DRAFTS_UNVERIFIED = 10;

/**
 * The two cap queries, defined ONCE.
 *
 * 🔴 They are shared by the ENFORCEMENT (assertActiveCap / assertDraftCap) and
 * by the seller's cap meter (`listMine` summary). Two copies would drift, and
 * the failure is nasty: a meter reading "2 of 3" beside a publish that 409s.
 * Same reason `nearingPurgeFilter` exists in adminProducts.service.js.
 *
 * Note `activeCapFilter` excludes taken-down rows (§A10 — a block frees a slot)
 * while the status TAB count does not. Those two numbers legitimately disagree,
 * and the design brief requires it: a blocked product must visibly not consume
 * a slot.
 */
export const activeCapFilter = (exporterOrgId) => ({
  exporterOrgId,
  status: 'active',
  'takedown.isDown': { $ne: true },
});

export const draftCapFilter = (exporterOrgId) => ({ exporterOrgId, status: 'draft' });

const GOODS_FIELDS = ['moq', 'unit', 'hsCode', 'countryOfOrigin', 'supplyAbility', 'leadTime', 'packaging', 'terms'];
const SERVICE_FIELDS = ['engagementType', 'deliveryModel', 'teamSize', 'pricingModel', 'timeline'];

// ---------------------------------------------------------------------------
// Shared guards
// ---------------------------------------------------------------------------

// The caller must be an exporter-side company (defensive: requireRole's
// superadmin bypass must not create platform-org-owned products).
async function loadExporterOrg(orgId) {
  // `name` is selected because §A26 puts the seller's company name into the
  // product's search corpus — without it "TextileHub" would never match that
  // seller's listings (caught by the M3-A create test).
  const org = await Organisation.findOne({ _id: orgId }).select('name exporterSide country kycStatus');
  if (!org || !org.exporterSide) {
    throw AppError.forbidden('not an exporter org', 'Not allowed.');
  }
  return org;
}

// M2↔M3 fix: a product maps to a LEAF only — a top category has no type, no
// attributes and no form, so it is rejected outright.
async function loadLeafCategory(categoryId) {
  const cat = await Category.findOne({ _id: categoryId });
  if (!cat) throw AppError.badRequest('category not found', 'Unknown category.');
  if (cat.parentId == null) {
    throw AppError.badRequest('top category rejected', 'Pick a sub-category — products cannot sit on a top category.');
  }
  return cat;
}

// Leaf type decides the field group (§A14 — the seller never picks it manually):
// a goods listing must not carry service fields and vice versa.
function assertTypeFields(leaf, doc) {
  const forbidden = leaf.type === 'goods' ? SERVICE_FIELDS : GOODS_FIELDS;
  const present = forbidden.filter((f) => doc[f] !== undefined && doc[f] !== null && doc[f] !== '');
  if (present.length > 0) {
    throw AppError.badRequest(
      `wrong-type fields: ${present.join(',')}`,
      `These fields do not apply to a ${leaf.type} listing: ${present.join(', ')}.`,
    );
  }
}

// Validate submitted attributes against the leaf's CategoryAttribute defs.
// Draft = shape-valid only; PUBLISH additionally requires every `required` def
// to be present (a seller may save an incomplete draft — plan M2-E).
// `dropStale` (edit path only): an admin can delete an attribute, or remove a
// `select` option, AFTER products already store values for it. Rejecting those
// on edit would lock the seller out of their OWN live listing — a normal
// GET-then-PATCH round-trip would 400 forever (review finding). On an edit we
// therefore DROP entries the category no longer recognises; on create there is
// nothing stale yet, so an unknown key is still a hard error.
async function validateAttributes(leaf, attributes, { forPublish = false, dropStale = false } = {}) {
  const defs = await CategoryAttribute.find({ categoryId: leaf._id }).lean();
  const byKey = new Map(defs.map((d) => [d.key, d]));

  const out = [];
  const seen = new Set();
  for (const { key, value } of attributes ?? []) {
    const def = byKey.get(key);
    if (!def) {
      if (dropStale) continue;
      throw AppError.badRequest(`unknown attribute key: ${key}`, `Unknown specification "${key}" for this category.`);
    }
    if (seen.has(key)) {
      throw AppError.badRequest(`duplicate attribute key: ${key}`, `Specification "${key}" appears twice.`);
    }
    seen.add(key);

    const type = typeof value;
    const ok =
      (def.inputType === 'number' && type === 'number' && Number.isFinite(value)) ||
      (def.inputType === 'boolean' && type === 'boolean') ||
      (def.inputType === 'text' && type === 'string') ||
      (def.inputType === 'select' && type === 'string' && def.options.includes(value));
    if (!ok) {
      if (dropStale) {
        seen.delete(key); // the value is gone, so the key is not "supplied"
        continue;
      }
      throw AppError.badRequest(
        `bad attribute value: ${key}`,
        `Invalid value for "${def.name}" (expects ${def.inputType}).`,
      );
    }
    out.push({ attributeId: def._id, key, value });
  }

  if (forPublish) {
    const missing = defs.filter((d) => d.required && !seen.has(d.key)).map((d) => d.name);
    if (missing.length > 0) {
      throw AppError.badRequest(
        `missing required attributes: ${missing.join(',')}`,
        `Required specifications missing: ${missing.join(', ')}.`,
      );
    }
  }
  return out;
}

// Image refs are client-supplied JSON, so BOTH halves must be verified — the
// `publicId` alone is not enough (review finding): the `url` is what buyers
// actually load, so a forged pair could hotlink another seller's asset or an
// arbitrary external image while passing a prefix check.
//   1. publicId must sit in the caller's OWN upload prefix — no cross-seller refs
//   2. url must be OUR Cloudinary host AND contain that publicId — so the pair
//      can only be one this server issued
function assertImageRefsOwned(images, orgId) {
  const prefix = `mpx/products/${orgId}/`;
  for (const img of images ?? []) {
    if (!img.publicId.startsWith(prefix)) {
      throw AppError.badRequest('foreign image ref', 'One of the images does not belong to this account.');
    }
    if (!isOwnCloudinaryUrl(img.url, img.publicId)) {
      throw AppError.badRequest('untrusted image url', 'One of the image links is not a valid upload.');
    }
  }
}

const isVerified = (org) => org.kycStatus === 'verified';

async function assertDraftCap(org, exporterOrgId) {
  if (isVerified(org)) return;
  const drafts = await Product.countDocuments(draftCapFilter(exporterOrgId));
  if (drafts >= MAX_DRAFTS_UNVERIFIED) {
    throw AppError.conflict(
      'draft cap reached',
      `Draft limit reached (${MAX_DRAFTS_UNVERIFIED}). Publish or delete a draft, or complete verification.`,
    );
  }
}

// D1 + A10: cap counts ACTIVE rows only, taken-down excluded (a block frees a slot).
async function assertActiveCap(org, exporterOrgId) {
  if (isVerified(org)) return;
  const active = await Product.countDocuments(activeCapFilter(exporterOrgId));
  if (active >= MAX_ACTIVE_UNVERIFIED) {
    throw AppError.conflict(
      'active cap reached',
      `Unverified sellers can have ${MAX_ACTIVE_UNVERIFIED} live products. Complete verification to list more.`,
    );
  }
}

// The slug hook resolves a VISIBLE clash; an insert-race E11000 retries once
// with a random suffix (same pattern as org signup).
async function saveHandlingSlugRace(doc) {
  try {
    return await doc.save();
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.slug) {
      // Suffix the slug the caller ALREADY set — never rebuild it from `name`
      // (review finding): on the archive path the caller has just appended the
      // `--archived-xxxx` marker, and rebuilding would hand the archived row a
      // CLEAN slug again, re-occupying the very name archiving is meant to free.
      const current = doc.slug || slugify(doc.name) || 'product';
      doc.slug = `${current}-${randomBytes(2).toString('hex')}`;
      return doc.save();
    }
    throw err;
  }
}

async function loadOwned(id, exporterOrgId) {
  const product = await Product.findOne({ _id: id, exporterOrgId });
  if (!product) throw AppError.notFound('product not found', 'Not found.');
  return product;
}

// Archived is TERMINAL (no un-archive path exists in the spec) and a taken-down
// product is FROZEN for the seller (restore must return it exactly as the admin
// froze it; content fixes stay possible — see update()).
function assertNotArchived(product) {
  if (product.status === 'archived') {
    throw AppError.conflict('product archived', 'This product was deleted. List it again as a new product.');
  }
}

// ---------------------------------------------------------------------------
// Seller operations
// ---------------------------------------------------------------------------

export async function uploadImages({ user, files }) {
  await loadExporterOrg(user.orgId);
  if (!files || files.length === 0) {
    throw AppError.badRequest('no files', 'No images were uploaded (field "images").');
  }
  const refs = [];
  for (const file of files) {
    refs.push(await uploadPublicImage({ buffer: file.buffer, folder: `mpx/products/${user.orgId}` }));
  }
  return refs;
}

export async function createProduct({ user, body, meta }) {
  const org = await loadExporterOrg(user.orgId);
  const leaf = await loadLeafCategory(body.categoryId);

  assertTypeFields(leaf, body);
  const attributes = await validateAttributes(leaf, body.attributes);
  assertImageRefsOwned(body.images, user.orgId);
  await assertDraftCap(org, user.orgId);

  const product = new Product({
    ...body,
    attributes,
    exporterOrgId: user.orgId,
    status: 'draft', // §A1 — create default, regardless of input
    // §A23 denorm — set from the owning org; synced on org state changes.
    sellerCountry: org.country,
    sellerVerified: isVerified(org),
    // §A26 denorms — search corpus + facet keys (searchSync owns the shape).
    ...searchFieldsFor({ leaf, org, attributes }),
  });
  await saveHandlingSlugRace(product);

  // A19: create MUST audit (createdBy was dropped — this is who-listed-what).
  await recordAudit({
    actor: user,
    action: 'product.create',
    entityType: 'Product',
    entityId: product._id,
    orgId: user.orgId,
    after: { name: product.name, slug: product.slug, categoryId: String(product.categoryId) },
    meta,
  });
  return product;
}

export async function updateProduct({ user, id, patch, meta }) {
  const product = await loadOwned(id, user.orgId);
  assertNotArchived(product);

  const categoryChanged =
    patch.categoryId !== undefined && String(patch.categoryId) !== String(product.categoryId);
  const leaf = await loadLeafCategory(patch.categoryId ?? product.categoryId);

  // A cross-TYPE category change auto-clears the now-inapplicable field group —
  // without this the seller is stuck: the old goods/service values fail the
  // type check and the API has no "unset" input (bug found in the M1+M2 audit).
  const merged = { ...product.toObject(), ...patch };
  if (categoryChanged) {
    const oldLeaf = await Category.findOne({ _id: product.categoryId }).select('type').lean();
    if (oldLeaf && oldLeaf.type !== leaf.type) {
      const stale = leaf.type === 'goods' ? SERVICE_FIELDS : GOODS_FIELDS;
      for (const field of stale) {
        if (patch[field] === undefined) {
          product[field] = undefined;
          delete merged[field];
        }
      }
    }
  }
  assertTypeFields(leaf, merged);

  // On a category change, stale attribute keys are DROPPED (they belong to the
  // old leaf) — the caller supplies the new leaf's attributes or none. Without
  // a change, a patch re-validates and an untouched set stays as-is.
  const attributes =
    patch.attributes !== undefined || categoryChanged
      ? await validateAttributes(leaf, patch.attributes ?? (categoryChanged ? [] : product.attributes), {
          forPublish: product.status === 'active',
          // Edit path: tolerate values the category no longer defines (see
          // validateAttributes) so an admin's attribute change can never brick a
          // seller's ability to edit their own listing.
          dropStale: true,
        })
      : undefined;
  if (patch.images !== undefined) assertImageRefsOwned(patch.images, user.orgId);

  const changed = [];
  for (const [field, value] of Object.entries(patch)) {
    product[field] = value;
    changed.push(field);
  }
  if (attributes !== undefined) product.attributes = attributes;
  // A6: slug never regenerates on rename — the public URL keeps the old name.

  // §A26: the corpus depends on the leaf and the product's attribute values, so
  // rebuild whenever either moved. (A rename does NOT touch it — `name` is its
  // own weighted field in the text index.)
  if (categoryChanged || attributes !== undefined) {
    const org = await Organisation.findOne({ _id: user.orgId }).select('name');
    Object.assign(
      product,
      searchFieldsFor({ leaf, org, attributes: attributes ?? product.attributes ?? [] }),
    );
  }

  await product.save();
  await recordAudit({
    actor: user,
    action: 'product.update',
    entityType: 'Product',
    entityId: product._id,
    orgId: user.orgId,
    after: { changed },
    meta,
  });
  return product;
}

export async function setProductStatus({ user, id, status, meta }) {
  const product = await loadOwned(id, user.orgId);
  assertNotArchived(product);
  if (status === 'draft') {
    // §A1 one-way — belt-and-braces (the validator only admits active/inactive).
    throw AppError.conflict('draft is one-way', 'A published product cannot return to draft.');
  }
  if (product.takedown?.isDown) {
    // Frozen: restore must put back exactly the state the admin took down (A9 —
    // the seller sees the reason + date on their own listing).
    throw AppError.conflict('product taken down', 'This product was taken down by the platform.');
  }
  if (product.status === status) {
    throw AppError.conflict('status unchanged', `The product is already ${status}.`);
  }

  if (status === 'active') {
    const org = await loadExporterOrg(user.orgId);
    // Full publish validation: required attributes must be present now.
    const leaf = await loadLeafCategory(product.categoryId);
    await validateAttributes(leaf, product.attributes, { forPublish: true });
    await assertActiveCap(org, user.orgId); // D1/A10 — applies to draft→active AND inactive→active
  }

  const before = { status: product.status };
  product.status = status;
  await product.save();

  await recordAudit({
    actor: user,
    action: status === 'active' ? 'product.publish' : 'product.unpublish',
    entityType: 'Product',
    entityId: product._id,
    orgId: user.orgId,
    before,
    after: { status },
    meta,
  });
  return product;
}

// A5: delete is ALWAYS soft — status='archived', slug gets an archive marker so
// the clean slug frees up for a re-list (A6). Kept forever (A7).
export async function archiveProduct({ user, id, meta }) {
  const product = await loadOwned(id, user.orgId);
  assertNotArchived(product);
  if (product.takedown?.isDown) {
    // Flagged default: a blocked product cannot be archived by the seller —
    // archiving would pull it out of the A8 purge (archived rows are never
    // purged), letting a seller shelter blocked content from cleanup.
    throw AppError.conflict('product taken down', 'This product was taken down by the platform.');
  }

  const before = { status: product.status, slug: product.slug };
  product.status = 'archived';
  product.slug = `${product.slug}--archived-${randomBytes(2).toString('hex')}`;
  await saveHandlingSlugRace(product);

  // M3-D: archived = PERMANENTLY gone for buyers, so its saved rows are removed
  // (Saved-item.md §3.2 — temporary-unavailable stays flagged, permanent-gone
  // is cleaned up so no dead entry survives).
  await removeSavedForProduct(product._id);

  await recordAudit({
    actor: user,
    action: 'product.archive',
    entityType: 'Product',
    entityId: product._id,
    orgId: user.orgId,
    before,
    after: { status: 'archived', slug: product.slug },
    meta,
  });
  return product;
}

/**
 * Per-status row counts for the list screen's tabs.
 *
 * These are RAW status counts — a taken-down product is still counted under the
 * status it holds, because the design puts blocked rows inside their status tab
 * wearing an overlay chip rather than in a tab of their own.
 */
async function statusCounts(exporterOrgId) {
  // 🔴 Cast explicitly: `req.user.orgId` is a STRING (authenticate.js) and an
  // aggregate `$match` does no schema casting — a raw string silently matches
  // nothing and every tab would read 0.
  const grouped = await Product.aggregate([
    { $match: { exporterOrgId: new mongoose.Types.ObjectId(exporterOrgId) } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  // Default every status to 0 so a tab never renders `undefined`.
  const counts = { all: 0, draft: 0, active: 0, inactive: 0, archived: 0 };
  for (const { _id, count } of grouped) {
    if (_id in counts) counts[_id] = count;
    // `all` mirrors the unfiltered list, which EXCLUDES archived (see listMine)
    // — the tile and the rows it opens must agree.
    if (_id !== 'archived') counts.all += count;
  }
  return counts;
}

/**
 * The cap meter's numbers — D1/A15, and ONLY while unverified.
 *
 * A verified seller gets `{ verified: true }` and no figures at all: the briefs
 * are explicit that a verified account shows no cap UI, and shipping limits
 * would invite a client to render one.
 */
async function capState(exporterOrgId) {
  const org = await Organisation.findOne({ _id: exporterOrgId }).select('kycStatus');
  if (!org || isVerified(org)) return { verified: true };

  const [active, drafts] = await Promise.all([
    Product.countDocuments(activeCapFilter(exporterOrgId)),
    Product.countDocuments(draftCapFilter(exporterOrgId)),
  ]);
  return {
    verified: false,
    active: { used: active, limit: MAX_ACTIVE_UNVERIFIED },
    drafts: { used: drafts, limit: MAX_DRAFTS_UNVERIFIED },
  };
}

/**
 * ONE of the seller's own products — what the edit form loads.
 *
 * Ownership-scoped by `loadOwned`, so another seller's product is a **404, never
 * a 403**: a 403 would confirm the row exists (tracker A6). Archived rows are
 * returned deliberately — the edit screen has to recognise one to show its
 * terminal "this product is archived" notice rather than a form.
 */
export async function getOwnProduct({ user, id }) {
  return loadOwned(id, user.orgId);
}

// The seller's own list. `status` is optional — omitted means the "All" tab.
// Counts and caps ride along on every page so the tabs and the meter can never
// disagree with the rows, and so publishing refreshes all three in one call.
export async function listMine({ user, status, page, pageSize }) {
  // No status = "All", and All EXCLUDES archived (owner, 2026-08-11): archived
  // rows are dead history and drowned the working list. They remain reachable
  // via ?status=archived — their tab/tile is the only window into them.
  const filter = {
    exporterOrgId: user.orgId,
    ...(status ? { status } : { status: { $ne: 'archived' } }),
  };
  const [rows, total, counts, caps] = await Promise.all([
    Product.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    Product.countDocuments(filter),
    statusCounts(user.orgId),
    capState(user.orgId),
  ]);
  return { rows, total, page, pageSize, counts, caps };
}
