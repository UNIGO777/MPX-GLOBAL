import * as svc from '../services/userManagement.service.js';
import * as orgSvc from '../services/orgBlock.service.js';

function meta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'], requestId: req.id };
}

// Curated user view — never return the full user document (no passwordHash, no
// 2FA fields, no other users' permissions). Handles a populated or bare orgId.
function userView(user) {
  const org = user.orgId && typeof user.orgId === 'object' && user.orgId._id ? user.orgId : null;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    mobile: user.mobile?.e164 ?? null,
    role: user.role,
    isActive: user.isActive,
    orgId: org ? String(org._id) : user.orgId ? String(user.orgId) : null,
    org: org
      ? {
          id: String(org._id),
          name: org.name,
          // A21: `type` removed; sides are the discriminator (UiWebNotes logged).
          buyerSide: Boolean(org.buyerSide),
          exporterSide: Boolean(org.exporterSide),
          kycStatus: org.kycStatus,
          verifiedAt: org.verifiedAt ?? null,
        }
      : null,
    createdAt: user.createdAt,
  };
}

export async function listUsers(req, res) {
  // Rows are already curated by the aggregation projection (safe to return as-is).
  const result = await svc.listUsers(req.validated.query);
  res.json(result);
}

export async function getUser(req, res) {
  const user = await svc.getUser({ id: req.params.id });
  res.json({ user: userView(user) });
}

export async function activateUser(req, res) {
  const user = await svc.setUserActive({ id: req.params.id, active: true, actor: req.user, meta: meta(req) });
  res.json({ user: userView(user) });
}

export async function deactivateUser(req, res) {
  const user = await svc.setUserActive({ id: req.params.id, active: false, actor: req.user, meta: meta(req) });
  res.json({ user: userView(user) });
}

// F1-A: curated org view for the block/unblock responses. Internal moderation
// fields (blockReason / blockedAt / blockedBy) are fine here — the caller is a
// superadmin — but this is NOT the public projection (see Organisation
// PUBLIC_FIELDS + toPublic, which never carries them).
function orgBlockView(org) {
  return {
    id: String(org._id),
    name: org.name,
    isActive: org.isActive,
    blockReason: org.blockReason ?? null,
    blockedAt: org.blockedAt ?? null,
    blockedBy: org.blockedBy ? String(org.blockedBy) : null,
  };
}

export async function blockOrg(req, res) {
  const { org, usersCascaded } = await orgSvc.blockOrganisation({
    id: req.params.id,
    reason: req.body.reason,
    actor: req.user,
    meta: meta(req),
  });
  res.json({ organisation: orgBlockView(org), usersCascaded });
}

export async function unblockOrg(req, res) {
  const { org, usersRestored } = await orgSvc.unblockOrganisation({
    id: req.params.id,
    reason: req.body.reason,
    actor: req.user,
    meta: meta(req),
  });
  res.json({ organisation: orgBlockView(org), usersRestored });
}

export async function updateEmployeePermissions(req, res) {
  const user = await svc.setEmployeePermissions({
    id: req.params.id,
    permissions: req.body.permissions,
    actor: req.user,
    meta: meta(req),
  });
  // This response intentionally includes the employee's own permission set (the
  // caller is a superadmin managing this employee) — never other users' perms.
  res.json({ user: { ...userView(user), permissions: user.permissions } });
}
