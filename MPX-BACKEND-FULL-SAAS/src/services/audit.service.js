import { AuditLog } from '../models/AuditLog.js';

// Write one append-only audit record. Always keyed to the acting user's id
// (never just a role). Callers must pass already-safe before/after snapshots —
// no tokens, OTPs, password hashes, bank numbers or KYC values.
export function recordAudit({ actor, action, entityType, entityId, orgId, before, after, meta = {} }) {
  return AuditLog.create({
    actorId: actor.userId,
    actorRole: actor.role,
    action,
    entityType,
    entityId,
    orgId,
    before,
    after,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
    requestId: meta.requestId,
    occurredAt: new Date(),
  });
}
