import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { declareScope, SCOPE } from './scoping.js';
import { encryptField, isEncrypted } from '../utils/fieldCrypto.js';

const { Schema } = mongoose;

/**
 * An exporter's own bank details, saved so a quotation does not ask for them
 * every time (owner, 2026-09-24 — quotation builder, Bucket A1).
 *
 * 🔴 DISPLAY-ONLY, and that is what keeps it inside C1. `security-baseline.md`
 * forbids bank details that are *authoritative* — ones our code could send to a
 * payment API and redirect money with. These are printed on a document the buyer
 * pays against directly; the platform never touches that money and no payout
 * path may ever read this model. If a payout feature is built in Phase 2 it uses
 * the provider's beneficiary token, never this.
 *
 * 🔴 `accountNumber` is ENCRYPTED AT REST (AES-256-GCM, `utils/fieldCrypto.js`)
 * since 2026-09-25, at the owner's instruction. That protects a database that
 * leaves the server — a stolen backup, a loose Mongo permission, a retired disk.
 * It does NOT protect against anyone holding the app's own `.env`, because the
 * server has to decrypt the number to print it on a quotation. Hashing is not an
 * option for the same reason.
 *
 * 🔴 `last4` is STORED, and `accountNumber` is `select: false`. Every list, every
 * picker and every audit entry uses `last4`, so the full number is never loaded
 * to be masked — the safest mask is the one that never reads the secret. Loading
 * it requires an explicit `.select('+accountNumber')`, which happens in exactly
 * one place: rendering a quotation the exporter has just confirmed.
 *
 * 🔴 SCOPED PER EXPORTER. One org never sees another's, and `SCOPE.EXPORTER_ORG`
 * makes an unscoped query throw rather than quietly return everyone's.
 *
 * ⚠️ What this model deliberately does NOT do, and must not be assumed to:
 *   · it does not verify the account belongs to the exporter (no penny-drop —
 *     that is C7, and it belongs with a real payout path);
 *   · a quotation must SNAPSHOT these values, never reference this row. If a
 *     quotation renders live from here, editing this record silently rewrites
 *     every quotation ever issued — an old PDF would show a new account. That is
 *     the whole attack this is meant to survive.
 */
const exporterBankAccountSchema = new Schema(
  {
    // §A2 — owned by the exporter org, not a generic `orgId`.
    exporterOrgId: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },

    // Lets one exporter keep more than one ("HDFC current", "export EEFC").
    label: { type: String, required: true, trim: true, maxlength: 60 },

    beneficiary: { type: String, required: true, trim: true, maxlength: 140 },
    bankName: { type: String, required: true, trim: true, maxlength: 140 },
    branch: { type: String, trim: true, maxlength: 140 },

    /**
     * 🔴 No `maxlength` here, deliberately. It was 34 (the IBAN maximum) and
     * that limit describes the PLAINTEXT — once the value is encrypted it is
     * ~73 characters and every save failed validation. The plaintext bound is
     * enforced where the plaintext actually arrives: `bankAccount.validators.js`
     * at the route boundary. A length rule on a ciphertext column constrains
     * nothing real and breaks the moment the format changes.
     */
    accountNumber: { type: String, required: true, trim: true, select: false },
    // Derived below. The ONLY part of the number any list or log may hold.
    last4: { type: String, maxlength: 4 },

    swift: { type: String, trim: true, uppercase: true, maxlength: 11 },
    ifsc: { type: String, trim: true, uppercase: true, maxlength: 11 },

    isDefault: { type: Boolean, default: false },

    /**
     * When the exporter last said "yes, use these" on a quotation.
     *
     * This is the control the owner asked for, and it is not decoration: silent
     * auto-fill is exactly how tampered details reach a buyer unnoticed. The
     * quotation form shows the saved account and makes the exporter confirm it,
     * and this records that they did.
     */
    lastConfirmedAt: { type: Date },

    isActive: { type: Boolean, default: true },
  },
  baseSchemaOptions,
);

/**
 * Derive `last4`, then ENCRYPT the number — in that order, on every write.
 *
 * 🔴 It lives in a model hook rather than at the call sites (owner asked for
 * encryption 2026-09-25) precisely so no future write path can forget. A
 * service that forgets to encrypt stores a plaintext account number and nothing
 * complains; a model that always encrypts cannot be bypassed by new code.
 *
 * 🔴 The ORDER is load-bearing: `last4` must come off the plaintext. Compute it
 * after encrypting and the mask becomes four characters of base64 — a
 * meaningless string shown to a person as confirmation that they typed the
 * right account.
 *
 * The `isEncrypted` guard makes this idempotent: `save()` on a document whose
 * number has not changed must not encrypt the ciphertext a second time.
 */
exporterBankAccountSchema.pre('validate', function protectAccountNumber() {
  /**
   * 🔴 The condition is "is it plaintext?", NOT "did it change?".
   *
   * It was `isModified(...)` first, and its test caught the hole: a row written
   * before encryption existed would only convert if somebody EDITED the number.
   * Saving it for any other reason — renaming the label, flipping the default —
   * left the plaintext sitting there indefinitely. Keying on the value's own
   * shape means every save of a legacy row converts it, which is what makes the
   * plaintext tolerance in `decryptField` temporary rather than permanent.
   *
   * Absent (`select: false` on most reads) or already encrypted → nothing to do.
   */
  if (!this.accountNumber || isEncrypted(this.accountNumber)) return;

  this.last4 = this.accountNumber.replace(/\s+/g, '').slice(-4);
  this.accountNumber = encryptField(this.accountNumber);
});

// One default per exporter; the partial index lets every non-default row exist.
exporterBankAccountSchema.index(
  { exporterOrgId: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true, isActive: true } },
);

declareScope(exporterBankAccountSchema, SCOPE.EXPORTER_ORG);

/** `••••1234` — built from `last4`, so it never needs the full number. */
export function maskedAccount(last4) {
  return last4 ? `••••${last4}` : '••••';
}

/**
 * What a list or picker may show. `accountNumber` is absent by construction:
 * this takes a document loaded WITHOUT it.
 */
export function bankAccountView(row) {
  return {
    id: String(row._id),
    label: row.label,
    beneficiary: row.beneficiary,
    bankName: row.bankName,
    branch: row.branch ?? null,
    masked: maskedAccount(row.last4),
    swift: row.swift ?? null,
    ifsc: row.ifsc ?? null,
    isDefault: Boolean(row.isDefault),
    lastConfirmedAt: row.lastConfirmedAt ?? null,
  };
}

export const ExporterBankAccount = mongoose.model('ExporterBankAccount', exporterBankAccountSchema);
