import { Conversation } from '../models/Conversation.js';
import { InternalNote } from '../models/InternalNote.js';
import { Lead } from '../models/Lead.js';
import { Organisation } from '../models/Organisation.js';
import { Ticket } from '../models/Ticket.js';
import { User } from '../models/User.js';
import { PERMISSIONS } from '../config/permissions.js';
import { AppError } from '../utils/AppError.js';
import { recordAudit } from './audit.service.js';

/**
 * Step 1c · staff-only internal notes.
 *
 * 🔴 Access follows the SUBJECT: you may read or add notes on something only if
 * you may open that thing — organisation → `organisation:read`, conversation →
 * `conversation:read`, ticket → `support:read`. Superadmin passes. The route
 * only requires a staff role; this map is the real gate (default-deny: an
 * unknown subject type is refused).
 *
 * Adding a note writes an AuditLog row (`note.add`) — the body is NOT copied
 * into the audit trail, only the fact and the subject.
 */
const SUBJECTS = {
  organisation: { permission: PERMISSIONS.ORGANISATION_READ, model: Organisation, orgOf: (d) => d._id },
  conversation: { permission: PERMISSIONS.CONVERSATION_READ, model: Conversation, orgOf: () => null },
  ticket: { permission: PERMISSIONS.SUPPORT_READ, model: Ticket, orgOf: (d) => d.orgId },
  lead: { permission: PERMISSIONS.LEAD_MANAGE, model: Lead, orgOf: (d) => d.buyerOrgId },
};

function gate(actor, subjectType) {
  const subject = SUBJECTS[subjectType];
  if (!subject) throw AppError.badRequest('bad subject', 'Unknown note subject.');
  if (actor.role !== 'superadmin') {
    const held = new Set(actor.permissions ?? []);
    if (actor.role !== 'employee' || !held.has(subject.permission)) {
      throw AppError.forbidden('missing permission', 'Not allowed.');
    }
  }
  return subject;
}

async function loadSubject(subject, subjectId) {
  // Staff surface, permission-gated above; the subject is looked up by id the
  // same way the moderation screens read (explicit filter, never findById).
  const doc = await subject.model.findOne({ _id: subjectId }).select('_id orgId buyerOrgId').lean();
  if (!doc) throw AppError.notFound('subject not found', 'Not found.');
  return doc;
}

function view(n, names) {
  return {
    id: String(n._id),
    body: n.body,
    author: { id: String(n.authorId), name: names.get(String(n.authorId)) ?? '—' },
    createdAt: n.createdAt,
  };
}

export async function listNotes({ actor, subjectType, subjectId }) {
  const subject = gate(actor, subjectType);
  await loadSubject(subject, subjectId);
  const notes = await InternalNote.find({ subjectType, subjectId }).sort({ createdAt: -1, _id: -1 }).limit(200).lean();
  const authors = await User.find({ _id: { $in: [...new Set(notes.map((n) => String(n.authorId)))] } }).select('name').lean();
  const names = new Map(authors.map((u) => [String(u._id), u.name]));
  return notes.map((n) => view(n, names));
}

export async function addNote({ actor, subjectType, subjectId, body, meta }) {
  const subject = gate(actor, subjectType);
  const doc = await loadSubject(subject, subjectId);
  const note = await InternalNote.create({ subjectType, subjectId, body, authorId: actor.userId });
  await recordAudit({
    actor: { userId: actor.userId, role: actor.role },
    action: 'note.add',
    entityType: subjectType,
    entityId: subjectId,
    orgId: subject.orgOf(doc) ?? undefined,
    after: { noteId: String(note._id) },
    meta,
  });
  const me = await User.findOne({ _id: actor.userId }).select('name').lean();
  return view(note, new Map([[String(actor.userId), me?.name ?? '—']]));
}
