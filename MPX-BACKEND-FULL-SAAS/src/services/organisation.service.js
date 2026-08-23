import mongoose from 'mongoose';

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
 * The heart of it is the PENDING-CHANGE rule (owner redesign, 2026-08-19 —
 * this RETIRES the old demote-on-edit): `name`, `country`, `address` and
 * `entityType` are what an Employee verifies against the KYC documents. On a
 * VERIFIED org a change to any of them does NOT touch the live profile or the
 * tick — it lands in `pendingChanges`, the company uploads fresh supporting
 * documents, and the values apply only when a reviewer approves them
 * (verification.service.approveChange). Unverified orgs keep editing live.
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
    pendingChanges: org.pendingChanges?.state
      ? {
          changedFields: org.pendingChanges.changedFields ?? [],
          values: org.pendingChanges.values ?? {},
          state: org.pendingChanges.state,
          submittedAt: org.pendingChanges.submittedAt ?? null,
          rejectionReason:
            org.pendingChanges.state === 'rejected'
              ? (org.pendingChanges.rejectionReason ?? null)
              : null,
        }
      : null,
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

  // entityType is an ORDINARY locked field for both sides (owner, 2026-08-19 —
  // the "immutable for exporter" rule is retired). Changing it re-targets which
  // KYC documents apply; the verification lifecycle handles the consequences.

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

  const wasVerified = org.kycStatus === 'verified';
  const pc = org.pendingChanges?.state ? org.pendingChanges : null;

  // A patched field that EQUALS the live value is a REVERT when it sits in the
  // pending set — the client re-sends pending fields precisely so a user can
  // back out of one without cancelling the rest.
  const reverted = pc
    ? (pc.changedFields ?? []).filter((f) => {
        if (f === 'address') {
          return patch.address !== undefined && !ADDRESS_KEYS.some((k) => !same(patch.address[k], org.address?.[k]));
        }
        if (patch[f] === undefined) return false;
        if (f === 'country') return same(String(patch.country).toUpperCase(), org.country);
        return same(patch[f], org[f]);
      })
    : [];

  if (changedLocked.length === 0 && !descriptionChanged && reverted.length === 0) {
    // Nothing actually changed — a no-op save must not move anything.
    return { organisation: ownerView(org), demoted: false };
  }

  // ── UNVERIFIED: nothing is vouched for yet — edits apply live (as always) ──
  if (!wasVerified) {
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
    await org.save();

    // §A23: a country change must follow into the denormalised search copy —
    // this sync was missing even on the old live path (latent gap, 2026-08-19).
    if (changedLocked.includes('country') && org.exporterSide) {
      await Product.updateMany({ exporterOrgId: org._id }, { $set: { sellerCountry: org.country } });
    }

    await recordAudit({
      actor: { userId: user.userId, role: user.role },
      action: 'organisation.self_update',
      entityType: 'Organisation',
      entityId: org._id,
      orgId: org._id,
      before: undefined,
      after: { changedFields: [...changedLocked, ...(descriptionChanged ? ['description'] : [])] },
      meta,
    });
    return { organisation: ownerView(org), demoted: false };
  }

  // ── VERIFIED: locked changes land in the PENDING SET; live stays untouched ──
  // Description is storefront content, never identity — it applies live even
  // while a change pends.
  if (descriptionChanged) org.description = trimmed(patch.description) || undefined;

  let pendingAction = null; // 'created' | 'amended' | 'cancelled'
  if (changedLocked.length > 0 || reverted.length > 0) {
    // Merge: existing pending values + this patch, minus reverts.
    const merged = {};
    for (const f of pc?.changedFields ?? []) {
      merged[f] = f === 'address' ? pc.values?.address : pc.values?.[f];
    }
    for (const f of changedLocked) {
      if (f === 'name') merged.name = trimmed(patch.name);
      else if (f === 'country') merged.country = String(patch.country).toUpperCase();
      else if (f === 'entityType') merged.entityType = patch.entityType;
      else if (f === 'address') {
        merged.address = Object.fromEntries(
          ADDRESS_KEYS.map((k) => [k, trimmed(patch.address[k]) || undefined]),
        );
      }
    }
    for (const f of reverted) delete merged[f];

    if (Object.keys(merged).length === 0) {
      // Every pending field reverted — the change dissolves. Same bookkeeping
      // as an explicit cancel: the round's documents are superseded.
      pendingAction = 'cancelled';
      if (pc?.roundId) {
        await Organisation.updateOne(
          { _id: org._id },
          { $set: { 'kycDocuments.$[d].supersededAt': new Date() } },
          { arrayFilters: [{ 'd.roundId': pc.roundId, 'd.supersededAt': null }] },
        );
      }
      org.pendingChanges = undefined;
    } else {
      pendingAction = pc ? 'amended' : 'created';
      // A rejected set that is amended goes back to review (its round already
      // has documents); a fresh set waits for its first document.
      const nextState = pc
        ? (pc.state === 'rejected' ? 'awaiting_review' : pc.state)
        : 'awaiting_documents';
      org.pendingChanges = {
        values: merged,
        changedFields: Object.keys(merged),
        state: nextState,
        roundId: pc?.roundId ?? new mongoose.Types.ObjectId(),
        submittedAt: new Date(),
      };
    }
    org.markModified('pendingChanges');
  }

  await org.save();

  // Field NAMES only — an audit row is not the place for address values
  // (m5 rules §4); the transition is the meaningful evidence.
  const action =
    pendingAction === 'cancelled'
      ? 'organisation.change_cancel'
      : pendingAction
        ? 'organisation.change_request'
        : 'organisation.self_update';
  await recordAudit({
    actor: { userId: user.userId, role: user.role },
    action,
    entityType: 'Organisation',
    entityId: org._id,
    orgId: org._id,
    before: undefined,
    after: {
      changedFields: [...changedLocked, ...(descriptionChanged ? ['description'] : [])],
      ...(pendingAction && pendingAction !== 'cancelled'
        ? {
            pendingFields: org.pendingChanges?.changedFields,
            roundId: String(org.pendingChanges?.roundId),
            amended: pendingAction === 'amended',
          }
        : {}),
    },
    meta,
  });

  // `demoted` stays in the response contract as a constant `false` until the
  // web's new confirm flow is deployed — the old bundle keys its dialog on it.
  return { organisation: ownerView(org), demoted: false };
}

/**
 * Cancel my pending profile change (2026-08-19). The live profile was never
 * touched, so cancelling is pure bookkeeping: the round's documents are
 * superseded and the set is cleared. 409 when there is nothing to cancel — a
 * cancel of nothing is a client bug, and 404 would read as "org missing".
 */
export async function cancelMyPendingChanges({ user, meta }) {
  const org = await loadOwnOrg(user);
  const pc = org.pendingChanges?.state ? org.pendingChanges : null;
  if (!pc) throw AppError.conflict('no pending change', 'There is no profile change to cancel.');

  if (pc.roundId) {
    await Organisation.updateOne(
      { _id: org._id },
      { $set: { 'kycDocuments.$[d].supersededAt': new Date() } },
      { arrayFilters: [{ 'd.roundId': pc.roundId, 'd.supersededAt': null }] },
    );
  }
  const cancelledFields = pc.changedFields ?? [];
  org.pendingChanges = undefined;
  org.markModified('pendingChanges');
  await org.save();

  await recordAudit({
    actor: { userId: user.userId, role: user.role },
    action: 'organisation.change_cancel',
    entityType: 'Organisation',
    entityId: org._id,
    orgId: org._id,
    before: undefined,
    after: { changedFields: cancelledFields },
    meta,
  });

  return { organisation: ownerView(org) };
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

/** Same best-effort cleanup the logo does, for the cover asset. */
async function deleteOldCover(org) {
  const publicId = org.coverImage ? cloudinaryPublicIdFromUrl(org.coverImage) : null;
  if (!publicId) return;
  try {
    await deletePublicImage(publicId);
  } catch (err) {
    logger.warn({ err: { name: err?.name, message: err?.message } }, 'old cover cleanup skipped');
  }
}

/**
 * The supplier-profile banner (§A22 storefront content, 2026-08-17).
 *
 * `coverImage` shipped with the 2026-08-13 profile redesign but had NO way to
 * be set — only seeded rows had one, so 8 of 9 exporters could never have a
 * banner. This is that missing half. Public by design, exactly like `logo`:
 * it IS the public page's artwork, already on the whitelist, so nothing about
 * what the public API exposes changes here.
 */
export async function setMyCover({ user, buffer }) {
  const org = await loadOwnOrg(user);
  if (!org.exporterSide) {
    throw AppError.forbidden('buyer has no cover', 'Only exporter profiles have a cover image.');
  }

  const { url } = await uploadPublicImage({ buffer, folder: `mpx/covers/${org._id}` });

  await deleteOldCover(org);
  org.coverImage = url;
  await org.save();

  // Storefront content: kycStatus untouched, same as the logo (§A22).
  return { organisation: ownerView(org) };
}

export async function removeMyCover({ user }) {
  const org = await loadOwnOrg(user);
  if (!org.exporterSide) {
    throw AppError.forbidden('buyer has no cover', 'Only exporter profiles have a cover image.');
  }

  await deleteOldCover(org);
  org.coverImage = undefined;
  await org.save();

  return { organisation: ownerView(org) };
}

/**
 * The company icon.
 *
 * 🔴 SCOPE CHANGED 2026-08-17 (owner): buyers may set one too. It used to be
 * exporter-only, because the logo existed to fill the public seller page and a
 * buyer has no public page.
 *
 * What a BUYER's icon is, precisely — it is NOT public. There is no public buyer
 * page to carry it, and no public projection gained a field. It appears in two
 * authenticated places: the buyer's own portal, and as the counterparty avatar
 * inside a conversation the two companies are already party to. A seller
 * therefore sees the icon of a buyer who has enquired with them, and nobody
 * else can see it at all.
 *
 * An EXPORTER's logo is unchanged: still public, still the seller page's image.
 */
export async function setMyLogo({ user, buffer }) {
  const org = await loadOwnOrg(user);

  // Magic-byte verified, images only (no PDF), 5 MB cap — all inside
  // uploadPublicImage. For an exporter the asset is public by design; for a
  // buyer it is only ever served to a counterparty in a live conversation.
  const { url } = await uploadPublicImage({ buffer, folder: `mpx/logos/${org._id}` });

  await deleteOldLogo(org);
  org.logo = url;
  await org.save();

  // Storefront content: kycStatus untouched, by design (§A22).
  return { organisation: ownerView(org) };
}

export async function removeMyLogo({ user }) {
  const org = await loadOwnOrg(user);

  await deleteOldLogo(org);
  org.logo = undefined;
  await org.save();

  return { organisation: ownerView(org) };
}
