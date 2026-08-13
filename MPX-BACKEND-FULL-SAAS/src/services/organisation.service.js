import { Organisation } from '../models/Organisation.js';
import { Product } from '../models/Product.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { recordAudit } from './audit.service.js';
import { uploadPublicImage, deletePublicImage } from './image.storage.service.js';

/**
 * §A22 · Self-service company profile — the owner reads and edits their OWN
 * Organisation.
 *
 * The heart of it is the LOCK + DEMOTION rule: `name`, `country`, `address` and
 * `entityType` are what an Employee verifies against the KYC documents, so on a
 * VERIFIED org a change to any of them is allowed but drops `kycStatus` back to
 * `submitted` (the existing resubmit path) — the tick is withheld until
 * re-approval, the change is auditable, and the exporter's denormalised
 * `sellerVerified` search field is synced down.
 *
 * `logo` and `description` are storefront content, not identity: they are never
 * checked against documents and NEVER touch `kycStatus`.
 *
 * Ownership: the org is the tenant root, always taken from the token —
 * `findOne({ _id: user.orgId })`, never from a body or path param.
 */

// The locked set is name · country · address · entityType — each checked
// individually in updateMyOrganisation because their comparison shapes differ.
const ADDRESS_KEYS = ['line1', 'line2', 'city', 'state', 'postalCode'];

function assertPartyRole(user) {
  // Staff also carry an orgId (the platform org) — this surface is not for them.
  if (user.role !== 'buyer' && user.role !== 'exporter') {
    throw AppError.forbidden('role has no company profile', 'Not allowed.');
  }
}

/**
 * Owner view — curated, like every other response (api-endpoints: never a full
 * document). The owner MAY see their own raw `kycStatus` (same as
 * `/me/verification`); the never-expose rule is about PUBLIC surfaces.
 * `website` is internal-only and deliberately absent even here.
 */
export function ownerView(org) {
  return {
    name: org.name,
    // The public URL's slug — immutable after creation, shown so the preview
    // can render `/supplier/<slug>`. Only meaningful for an exporter side.
    slug: org.exporterSide ? (org.slug ?? null) : null,
    country: org.country ?? null,
    address: {
      line1: org.address?.line1 ?? '',
      line2: org.address?.line2 ?? '',
      city: org.address?.city ?? '',
      state: org.address?.state ?? '',
      postalCode: org.address?.postalCode ?? '',
    },
    entityType: org.entityType ?? null,
    buyerSide: Boolean(org.buyerSide),
    exporterSide: Boolean(org.exporterSide),
    logo: org.logo ?? null,
    coverImage: org.coverImage ?? null,
    description: org.description ?? '',
    establishedYear: org.businessProfile?.establishedYear ?? null,
    kycStatus: org.kycStatus,
    verifiedAt: org.verifiedAt ?? null,
  };
}

async function loadOwnOrg(user) {
  assertPartyRole(user);
  const org = await Organisation.findOne({ _id: user.orgId });
  if (!org) throw AppError.notFound('org not found', 'Not found.');
  return org;
}

export async function getMyOrganisation({ user }) {
  return ownerView(await loadOwnOrg(user));
}

const trimmed = (v) => (typeof v === 'string' ? v.trim() : v);

/** ''/undefined/null are all "empty" for comparison purposes. */
const same = (a, b) => (trimmed(a) || '') === (trimmed(b) || '');

/**
 * Applies a partial update. Returns `{ organisation, demoted }`.
 *
 * @param {object} patch validated body — any of name, country, entityType,
 *   description, address (full object; subfields optional).
 */
export async function updateMyOrganisation({ user, patch, meta }) {
  const org = await loadOwnOrg(user);

  // --- entityType has per-side rules -----------------------------------------
  if (patch.entityType !== undefined) {
    if (org.exporterSide) {
      // A22.1: an exporter's entity type is set at signup and read-only in every
      // state — it drove which documents were requested.
      throw AppError.badRequest('entityType immutable for exporter', 'Entity type is set at signup and cannot be changed.');
    }
  }

  // --- storefront fields are exporter-only -----------------------------------
  if (patch.description !== undefined && !org.exporterSide) {
    // A buyer has no public page; accepting the field would invent one.
    throw AppError.badRequest('buyer has no storefront', 'Only exporter profiles have a description.');
  }

  // --- work out which LOCKED fields actually change ---------------------------
  const changedLocked = [];
  if (patch.name !== undefined && !same(patch.name, org.name)) changedLocked.push('name');
  if (patch.country !== undefined && !same(String(patch.country).toUpperCase(), org.country)) {
    changedLocked.push('country');
  }
  if (patch.entityType !== undefined && !same(patch.entityType, org.entityType)) {
    changedLocked.push('entityType');
  }
  if (patch.address !== undefined) {
    const addressChanged = ADDRESS_KEYS.some((k) => !same(patch.address[k], org.address?.[k]));
    if (addressChanged) changedLocked.push('address');
  }

  const descriptionChanged =
    patch.description !== undefined && !same(patch.description, org.description);

  if (changedLocked.length === 0 && !descriptionChanged) {
    // Nothing actually changed — a no-op save must not demote anything.
    return { organisation: ownerView(org), demoted: false };
  }

  const wasVerified = org.kycStatus === 'verified';
  const demoted = wasVerified && changedLocked.length > 0;

  // --- apply -------------------------------------------------------------------
  if (changedLocked.includes('name')) org.name = trimmed(patch.name);
  if (changedLocked.includes('country')) org.country = String(patch.country).toUpperCase();
  if (changedLocked.includes('entityType')) org.entityType = patch.entityType;
  if (changedLocked.includes('address')) {
    for (const k of ADDRESS_KEYS) {
      const v = trimmed(patch.address[k]);
      org.address = org.address ?? {};
      org.address[k] = v || undefined;
    }
    org.markModified('address');
  }
  if (descriptionChanged) org.description = trimmed(patch.description) || undefined;

  if (demoted) {
    // Same posture as a reject in verification.service: the verification
    // evidence is cleared so nothing downstream can derive a tick from a stale
    // `verifiedAt`. WHO verified and WHEN survives in the append-only audit.
    org.kycStatus = 'submitted';
    org.kycSubmittedAt = new Date();
    org.verifiedAt = undefined;
    org.verifiedBy = undefined;
  }

  await org.save();

  if (demoted && org.exporterSide) {
    // §A23: search reads the denormalised copy — a demoted seller must stop
    // ranking as verified immediately, not at next review.
    await Product.updateMany({ exporterOrgId: org._id }, { $set: { sellerVerified: false } });
  }

  // Field NAMES only — an audit row is not the place for address values
  // (m5 rules §4); the demotion transition is the meaningful evidence.
  await recordAudit({
    actor: { userId: user.userId, role: user.role },
    action: 'organisation.self_update',
    entityType: 'Organisation',
    entityId: org._id,
    orgId: org._id,
    before: demoted ? { kycStatus: 'verified' } : undefined,
    after: {
      changedFields: [...changedLocked, ...(descriptionChanged ? ['description'] : [])],
      ...(demoted ? { kycStatus: 'submitted', demoted: true } : {}),
    },
    meta,
  });

  return { organisation: ownerView(org), demoted };
}

// --- logo (exporter storefront) -----------------------------------------------

/** Best-effort publicId from a secure_url we issued — for replace/remove cleanup. */
function cloudinaryPublicIdFromUrl(url) {
  try {
    const path = new URL(url).pathname;
    const at = path.indexOf('/upload/');
    if (at === -1) return null;
    return path
      .slice(at + '/upload/'.length)
      .replace(/^v\d+\//, '')
      .replace(/\.[a-z0-9]+$/i, '');
  } catch {
    return null;
  }
}

async function deleteOldLogo(org) {
  const publicId = org.logo ? cloudinaryPublicIdFromUrl(org.logo) : null;
  if (!publicId) return;
  try {
    await deletePublicImage(publicId);
  } catch (err) {
    // Cleanup only — an orphaned asset must never block the profile operation.
    logger.warn({ err: { name: err?.name, message: err?.message } }, 'old logo cleanup skipped');
  }
}

export async function setMyLogo({ user, buffer }) {
  const org = await loadOwnOrg(user);
  if (!org.exporterSide) {
    throw AppError.forbidden('buyer has no logo', 'Only exporter profiles have a logo.');
  }

  // Public asset by design — the logo IS the public page's image. Magic-byte
  // verified, images only (no PDF), 5 MB cap — all inside uploadPublicImage.
  const { url } = await uploadPublicImage({ buffer, folder: `mpx/logos/${org._id}` });

  await deleteOldLogo(org);
  org.logo = url;
  await org.save();

  // Storefront content: kycStatus untouched, by design (§A22).
  return { organisation: ownerView(org) };
}

export async function removeMyLogo({ user }) {
  const org = await loadOwnOrg(user);
  if (!org.exporterSide) {
    throw AppError.forbidden('buyer has no logo', 'Only exporter profiles have a logo.');
  }

  await deleteOldLogo(org);
  org.logo = undefined;
  await org.save();

  return { organisation: ownerView(org) };
}
