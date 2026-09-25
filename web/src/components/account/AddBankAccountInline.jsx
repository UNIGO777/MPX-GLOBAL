import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { bankAccountsApi } from '../../api/quotations.js';
import { apiError, fieldErrorMap } from '../../lib/format.js';
import { Alert } from '../ui/Alert.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';

/**
 * Add a bank account without leaving the send step (owner, 2026-09-25 — "waha
 * add karne ki field daal do or wahi se save karna").
 *
 * 🔴 **Inline, not a second modal.** The send step is already a dialog, and a
 * dialog opened on top of a dialog traps focus in the wrong layer and closes
 * the wrong thing on Esc. This expands in place instead.
 *
 * 🔴 It SAVES the account properly — the same `POST /me/bank-accounts` the
 * company profile uses, so what is added here is a real saved account available
 * to every future quotation, not a one-off typed onto this document. There is
 * deliberately no "use once without saving" path: an account that exists only
 * on one quotation can never be corrected, audited, or re-confirmed, and the
 * whole point of `lastConfirmedAt` is that a person looked at it again.
 *
 * The full field set lives on the company profile (`BankAccounts.jsx`); this
 * asks only for what a quotation must print. Branch, SWIFT and a custom label
 * are editable there afterwards.
 */
export function AddBankAccountInline({ onAdded }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ beneficiary: '', bankName: '', accountNumber: '', ifsc: '' });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const save = useMutation({
    mutationFn: () =>
      bankAccountsApi.create({
        // The account's own name, which the exporter never asked to choose here.
        // "HDFC Bank" is more use in a picker than "Account 1".
        label: form.bankName.trim() || 'Bank account',
        beneficiary: form.beneficiary.trim(),
        bankName: form.bankName.trim(),
        accountNumber: form.accountNumber.trim(),
        ...(form.ifsc.trim() ? { ifsc: form.ifsc.trim().toUpperCase() } : {}),
      }),
    onSuccess: async (created) => {
      await qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      setOpen(false);
      setForm({ beneficiary: '', bankName: '', accountNumber: '', ifsc: '' });
      // Select it straight away — an exporter who just typed an account did so
      // to use it on THIS quotation.
      onAdded?.(created?.id ?? null);
    },
    onError: (e) => {
      const err = apiError(e, 'Could not save these details.');
      setFieldErrors(fieldErrorMap(err.fields));
      setError(err.fields?.length ? null : err.message);
    },
  });

  const incomplete = !form.beneficiary.trim() || !form.bankName.trim() || !form.accountNumber.trim();

  if (!open) {
    return (
      <Button size="sm" variant="secondary" className="mt-2" onClick={() => setOpen(true)}>
        Add bank details
      </Button>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-surface-border bg-surface-subtle p-3">
      {error && <Alert tone="danger" className="mb-3">{error}</Alert>}

      <div className="space-y-3">
        <Input
          label="Account holder"
          value={form.beneficiary}
          onChange={set('beneficiary')}
          error={fieldErrors.beneficiary}
          placeholder="As the bank has it"
        />
        <Input label="Bank" value={form.bankName} onChange={set('bankName')} error={fieldErrors.bankName} />
        <Input
          label="Account number"
          value={form.accountNumber}
          onChange={set('accountNumber')}
          error={fieldErrors.accountNumber}
          autoComplete="off"
        />
        <Input label="IFSC" optional value={form.ifsc} onChange={set('ifsc')} error={fieldErrors.ifsc} />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        Saved to your company profile so you can reuse it, and stored encrypted. Branch and SWIFT can
        be added there. MPX Global never holds or moves your money — these print for the buyer to pay
        you directly.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" loading={save.isPending} disabled={incomplete} onClick={() => { setError(null); save.mutate(); }}>
          Save and use
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
