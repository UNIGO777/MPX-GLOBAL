import { ExporterBankAccount, bankAccountView } from '../models/ExporterBankAccount.js';
import { AppError } from '../utils/AppError.js';
import { recordAudit } from './audit.service.js';

/**
 * An exporter's saved bank details (owner, 2026-09-24 — quotation builder).
 *
 * 🔴 Every query is scoped by `exporterOrgId` from the TOKEN, never from a body
 * or a path parameter (CLAUDE.md rule 1). A row belonging to another exporter is
 * a 404, never a 403 — a 403 would confirm it exists.
 *
 * 🔴 No read path here ever selects `accountNumber`. Lists and pickers run on
 * `last4`, which is stored. The full number is loaded in exactly one place
 * (`revealForQuotation`) and that call writes an audit entry, mirroring the rule
 * `payments-escrow.md` already sets for approval screens: "revealing one is a
 * separate permissioned action that writes an audit entry".
 *
 * 🔴 Audit snapshots carry `last4` and never the number itself.
 */
function assertExporter(user) {
  if (user.role !== 'exporter') {
    throw AppError.forbidden('not an exporter', 'Only exporter accounts have bank details.');
  }
}

const auditSnapshot = (row) => ({
  label: row.label,
  beneficiary: row.beneficiary,
  bankName: row.bankName,
  last4: row.last4,
  isDefault: Boolean(row.isDefault),
});

export async function listBankAccounts({ user }) {
  assertExporter(user);
  const rows = await ExporterBankAccount.find({ exporterOrgId: user.orgId, isActive: true }).sort({
    isDefault: -1,
    updatedAt: -1,
  });
  return rows.map(bankAccountView);
}

export async function createBankAccount({ user, data, actor, meta }) {
  assertExporter(user);

  // The FIRST account an exporter saves is their default — otherwise the
  // quotation form would have nothing to pre-fill and would still ask cold.
  const existing = await ExporterBankAccount.countDocuments({
    exporterOrgId: user.orgId,
    isActive: true,
  });
  const isDefault = existing === 0 ? true : Boolean(data.isDefault);

  if (isDefault) await clearDefault(user.orgId);

  const row = await ExporterBankAccount.create({
    ...data,
    isDefault,
    exporterOrgId: user.orgId,
  });

  await recordAudit({
    actor,
    action: 'bankAccount.create',
    entityType: 'ExporterBankAccount',
    entityId: row._id,
    orgId: user.orgId,
    before: null,
    after: auditSnapshot(row),
    meta,
  });

  return bankAccountView(row);
}

async function clearDefault(exporterOrgId) {
  await ExporterBankAccount.updateMany(
    { exporterOrgId, isDefault: true },
    { $set: { isDefault: false } },
  );
}

export async function updateBankAccount({ user, id, data, actor, meta }) {
  assertExporter(user);
  const row = await ExporterBankAccount.findOne({
    _id: id,
    exporterOrgId: user.orgId,
    isActive: true,
  });
  if (!row) throw AppError.notFound('bank account not found', 'Not found.');

  const before = auditSnapshot(row);

  if (data.isDefault === true && !row.isDefault) await clearDefault(user.orgId);
  Object.assign(row, data);
  await row.save();

  /**
   * 🔴 An audit entry on EVERY edit, and it records the old and new `last4`.
   * A silently changed account is how a buyer ends up paying an attacker, so the
   * change has to leave a trail even though nobody was watching when it happened.
   */
  await recordAudit({
    actor,
    action: 'bankAccount.update',
    entityType: 'ExporterBankAccount',
    entityId: row._id,
    orgId: user.orgId,
    before,
    after: auditSnapshot(row),
    meta,
  });

  return bankAccountView(row);
}

export async function removeBankAccount({ user, id, actor, meta }) {
  assertExporter(user);
  const row = await ExporterBankAccount.findOne({
    _id: id,
    exporterOrgId: user.orgId,
    isActive: true,
  });
  if (!row) throw AppError.notFound('bank account not found', 'Not found.');

  // Soft: a quotation issued against it keeps its own snapshot, but the audit
  // trail must still resolve the row it points at.
  row.isActive = false;
  row.isDefault = false;
  await row.save();

  await recordAudit({
    actor,
    action: 'bankAccount.remove',
    entityType: 'ExporterBankAccount',
    entityId: row._id,
    orgId: user.orgId,
    before: auditSnapshot(row),
    after: { isActive: false },
    meta,
  });

  return { id: String(row._id), removed: true };
}

/**
 * The exporter answering "yes, use these" on a quotation form.
 *
 * It exists as its own call because the confirmation is the control: the form
 * shows the saved details and requires an explicit yes, so tampered details
 * cannot ride along unnoticed. `lastConfirmedAt` is the record that they looked.
 */
export async function confirmBankAccount({ user, id, actor, meta }) {
  assertExporter(user);
  const row = await ExporterBankAccount.findOneAndUpdate(
    { _id: id, exporterOrgId: user.orgId, isActive: true },
    { $set: { lastConfirmedAt: new Date() } },
    { new: true },
  );
  if (!row) throw AppError.notFound('bank account not found', 'Not found.');

  await recordAudit({
    actor,
    action: 'bankAccount.confirm',
    entityType: 'ExporterBankAccount',
    entityId: row._id,
    orgId: user.orgId,
    before: null,
    after: { last4: row.last4, confirmedAt: row.lastConfirmedAt },
    meta,
  });

  return bankAccountView(row);
}

/**
 * The ONLY path that loads the full account number — for the exporter's own
 * quotation, and it is audited.
 *
 * 🔴 The caller must SNAPSHOT what it returns onto the quotation. It must never
 * store the row's id and re-read it later: editing the saved account would then
 * rewrite every quotation already sent, and an old PDF would show a new account.
 */
export async function revealForQuotation({ user, id, actor, meta }) {
  assertExporter(user);
  const row = await ExporterBankAccount.findOne({
    _id: id,
    exporterOrgId: user.orgId,
    isActive: true,
  }).select('+accountNumber');
  if (!row) throw AppError.notFound('bank account not found', 'Not found.');

  await recordAudit({
    actor,
    action: 'bankAccount.reveal',
    entityType: 'ExporterBankAccount',
    entityId: row._id,
    orgId: user.orgId,
    before: null,
    after: { last4: row.last4 }, // never the number
    meta,
  });

  return {
    ...bankAccountView(row),
    accountNumber: row.accountNumber,
  };
}
