import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bankAccountsApi } from '../../api/quotations.js';
import { apiError, fieldErrorMap, formatDate } from '../../lib/format.js';
import { Alert } from '../ui/Alert.jsx';
import { Button } from '../ui/Button.jsx';
import { FlashMessage } from '../ui/FlashMessage.jsx';
import { Input } from '../ui/Input.jsx';
import { Modal } from '../ui/Modal.jsx';
import { SkeletonRows } from '../ui/Skeleton.jsx';
import { TrashIcon } from '../ui/icons.jsx';

/**
 * The bank details a quotation prints (owner, 2026-09-25 — "in the quotation
 * there is no option of bank account details filling"). The backend has existed
 * since 2026-09-24; this is the screen that was missing, so the picker in the
 * send step could only ever be empty.
 *
 * ── What this is, and what it must never become ───────────────────────────
 *
 * 🔴 **DISPLAY-ONLY, and that is what keeps it inside C1.**
 * `security-baseline.md` forbids bank details that are AUTHORITATIVE — ones our
 * code could send to a payment API and redirect money with. These are printed
 * on a document the buyer pays against directly; the platform never touches
 * that money, and no payout path may ever read them. If a payout feature is
 * built in Phase 2 it uses the provider's beneficiary token, never this.
 *
 * 🔴 **The full account number never comes back.** The API returns `masked`
 * (`••••4444`) and nothing else — `accountNumber` is `select: false` on the
 * model. So editing cannot pre-fill it: an exporter correcting a typo re-types
 * the number, and leaving it blank keeps the stored one. That is deliberate
 * friction, not an oversight.
 *
 * 🔴 **A quotation SNAPSHOTS these values at send.** Editing an account here
 * never changes a document already in a buyer's hands — which is the whole
 * reason the quotation copies them instead of linking. Said on screen, because
 * an exporter fixing a typo will reasonably wonder.
 */
const BLANK = {
  label: '',
  beneficiary: '',
  bankName: '',
  branch: '',
  accountNumber: '',
  swift: '',
  ifsc: '',
  isDefault: false,
};

export function BankAccounts() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // the row being edited, or null for a new one
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);

  const list = useQuery({ queryKey: ['bank-accounts'], queryFn: bankAccountsApi.list });
  const rows = list.data ?? [];

  const done = (message) => {
    qc.invalidateQueries({ queryKey: ['bank-accounts'] });
    setOpen(false);
    setConfirmRemove(null);
    setNotice(message);
  };

  const failed = (e, fallback) => {
    const err = apiError(e, fallback);
    setFieldErrors(fieldErrorMap(err.fields));
    setError(err.fields?.length ? null : err.message);
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        label: form.label.trim(),
        beneficiary: form.beneficiary.trim(),
        bankName: form.bankName.trim(),
        ...(form.branch.trim() ? { branch: form.branch.trim() } : {}),
        ...(form.swift.trim() ? { swift: form.swift.trim().toUpperCase() } : {}),
        ...(form.ifsc.trim() ? { ifsc: form.ifsc.trim().toUpperCase() } : {}),
        isDefault: form.isDefault,
      };
      // Blank on an edit means "keep the stored number" — the API never sent it
      // back, so there is nothing to re-submit unless it is being changed.
      if (form.accountNumber.trim()) body.accountNumber = form.accountNumber.trim();
      return editing ? bankAccountsApi.update(editing.id, body) : bankAccountsApi.create(body);
    },
    onSuccess: () => done(editing ? 'Bank details updated.' : 'Bank details added.'),
    onError: (e) => failed(e, 'Could not save these details.'),
  });

  const remove = useMutation({
    mutationFn: (id) => bankAccountsApi.remove(id),
    onSuccess: () => done('Bank details removed.'),
    onError: (e) => failed(e, 'Could not remove these details.'),
  });

  const start = (row) => {
    setEditing(row ?? null);
    setForm(
      row
        ? {
            label: row.label ?? '',
            beneficiary: row.beneficiary ?? '',
            bankName: row.bankName ?? '',
            branch: row.branch ?? '',
            accountNumber: '',
            swift: row.swift ?? '',
            ifsc: row.ifsc ?? '',
            isDefault: Boolean(row.isDefault),
          }
        : BLANK,
    );
    setError(null);
    setFieldErrors({});
    setOpen(true);
  };

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const incomplete =
    !form.label.trim() ||
    !form.beneficiary.trim() ||
    !form.bankName.trim() ||
    (!editing && !form.accountNumber.trim());

  return (
    <>
      {notice && (
        <FlashMessage tone="success" className="mb-3" onDismiss={() => setNotice(null)}>
          {notice}
        </FlashMessage>
      )}

      <p className="text-[13px] leading-relaxed text-muted">
        These print on the quotations you send, so a buyer knows where to pay. You pick which account
        each quotation carries when you send it.
      </p>

      {list.isPending ? (
        <div className="mt-4"><SkeletonRows rows={2} /></div>
      ) : rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-surface-border bg-surface-subtle px-4 py-5 text-center text-[13px] text-muted">
          No bank details yet. Quotations you send will print without payment details.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-surface-border p-3.5"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-900">
                  {b.label}
                  {b.isDefault && (
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700">
                      Default
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[13px] text-muted">
                  {b.beneficiary} · {b.bankName}
                  {b.branch ? ` · ${b.branch}` : ''}
                </p>
                {/* 🔴 The mask, never the number. The API does not return it. */}
                <p className="mt-0.5 text-[13px] tabular-nums text-ink-800">
                  {b.masked}
                  {b.ifsc ? ` · IFSC ${b.ifsc}` : ''}
                  {b.swift ? ` · SWIFT ${b.swift}` : ''}
                </p>
                {b.lastConfirmedAt && (
                  <p className="mt-0.5 text-[11.5px] text-muted">
                    Last used on a quotation {formatDate(b.lastConfirmedAt)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => start(b)}>
                  Edit
                </Button>
                <button
                  type="button"
                  aria-label={`Remove ${b.label}`}
                  onClick={() => setConfirmRemove(b)}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button size="sm" variant="secondary" className="mt-4" onClick={() => start(null)}>
        Add bank details
      </Button>

      {/* ── Add / edit ──────────────────────────────────────────────────── */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit bank details' : 'Add bank details'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={save.isPending} disabled={incomplete} onClick={() => { setError(null); save.mutate(); }}>
              {editing ? 'Save changes' : 'Add account'}
            </Button>
          </>
        }
      >
        {error && <Alert tone="danger" className="mb-3">{error}</Alert>}

        <div className="space-y-4">
          <Input
            label="Name for this account"
            value={form.label}
            onChange={set('label')}
            error={fieldErrors.label}
            placeholder="HDFC current"
            helper="Only you see this — it is how you pick the right account when sending."
          />
          <Input
            label="Account holder"
            value={form.beneficiary}
            onChange={set('beneficiary')}
            error={fieldErrors.beneficiary}
            placeholder="As the bank has it"
          />
          <Input label="Bank" value={form.bankName} onChange={set('bankName')} error={fieldErrors.bankName} />
          <Input label="Branch" optional value={form.branch} onChange={set('branch')} error={fieldErrors.branch} />
          <Input
            label="Account number"
            value={form.accountNumber}
            onChange={set('accountNumber')}
            error={fieldErrors.accountNumber}
            optional={Boolean(editing)}
            autoComplete="off"
            placeholder={editing ? `Leave blank to keep ${editing.masked}` : ''}
            helper={
              editing
                ? 'We never show a stored number back, so type it again only if it is changing.'
                : 'Digits, letters, spaces and dashes. We do not guess a country’s format.'
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="IFSC" optional value={form.ifsc} onChange={set('ifsc')} error={fieldErrors.ifsc} />
            <Input label="SWIFT / BIC" optional value={form.swift} onChange={set('swift')} error={fieldErrors.swift} />
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-800">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={set('isDefault')}
              className="mt-0.5 h-4 w-4"
            />
            <span>Offer this account first when I send a quotation</span>
          </label>
        </div>

        {/* 🔴 Said here, because an exporter fixing a typo will wonder. */}
        <p className="mt-4 text-xs leading-relaxed text-muted">
          A quotation copies these details when you send it, so changing them here never alters a
          quotation a buyer already has. MPX Global does not hold or move your money — these are
          printed for the buyer to pay you directly.
        </p>
      </Modal>

      {/* ── Remove ──────────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(confirmRemove)}
        onClose={() => setConfirmRemove(null)}
        title="Remove these bank details?"
        danger
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRemove(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => remove.mutate(confirmRemove.id)}
            >
              Remove
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-700">
          “{confirmRemove?.label}” ({confirmRemove?.masked}) will no longer be offered when you send a
          quotation. Quotations already sent keep the details they were sent with.
        </p>
      </Modal>
    </>
  );
}
