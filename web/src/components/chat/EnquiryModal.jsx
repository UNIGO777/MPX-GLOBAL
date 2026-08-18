import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { inquiriesApi } from '../../api/inquiries.js';
import { apiError } from '../../lib/format.js';
import { Alert } from '../ui/Alert.jsx';
import { Button } from '../ui/Button.jsx';
import { CountrySelect } from '../ui/CountrySelect.jsx';
import { Field } from '../ui/Field.jsx';
import { Input } from '../ui/Input.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Select } from '../ui/Select.jsx';
import { VerifiedTick } from '../ui/VerifiedTick.jsx';
import { ChevronDownIcon } from '../ui/icons.jsx';

/**
 * M4 screen 2 — the enquiry form.
 *
 * A structured FORM, not a free-text box (M4-7), but the note is the only
 * REQUIRED field and the only free text. Everything else is optional, so the
 * details sit behind a disclosure: a buyer who just wants to ask a question
 * should not have to walk past six inputs to do it (owner's call).
 *
 * Field sets follow the sub-category's `type` exactly as the product form does
 * (M4-9). The server REJECTS unknown keys rather than stripping them, so only
 * the leaf's own set is ever submitted.
 *
 * 🔴 There is no "Enquiry sent!" confirmation. The thread IS the confirmation
 * (M4-35), and nothing here may imply an email or phone follow-up — contact
 * details are hidden platform-wide by design, and this conversation is the only
 * channel that exists.
 */
const NOTE_MAX = 200;

// The amounts a buyer can state. Full ISO list lives on the server; these are
// the ones a B2B enquiry realistically quotes in.
const CURRENCY_OPTIONS = [
  { value: '', label: 'Select a currency' },
  ...['USD', 'EUR', 'GBP', 'INR', 'AED', 'AUD', 'CAD', 'JPY', 'SGD', 'CNY'].map((c) => ({
    value: c,
    label: c,
  })),
];

export function EnquiryModal({ product, onClose, onCreated }) {
  const isService = product?.category?.type === 'service';
  const [note, setNote] = useState('');
  const [fields, setFields] = useState({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [fieldError, setFieldError] = useState(null);

  const set = (key, value) => setFields((prev) => ({ ...prev, [key]: value }));

  const create = useMutation({
    mutationFn: () =>
      inquiriesApi.create({
        productId: product.id,
        note: note.trim(),
        fields,
        categoryType: isService ? 'service' : 'goods',
      }),
    onSuccess: (conversationId) => onCreated(conversationId),
  });

  const submit = (e) => {
    e.preventDefault();
    setFieldError(null);

    // Mirrors the server rule so the buyer is told before a round trip; the
    // server is still authoritative and refuses it independently.
    const amount = isService ? fields.budget : fields.targetPrice;
    if (amount && !fields.currency) {
      setDetailsOpen(true);
      setFieldError('Please choose a currency for the amount you entered.');
      return;
    }
    create.mutate();
  };

  const remaining = NOTE_MAX - note.length;

  return (
    <Modal open onClose={onClose} title="Create enquiry">
      <form onSubmit={submit} className="space-y-5">
        {/* What am I enquiring about — the buyer must see it while typing. */}
        <div className="flex items-center gap-3 rounded-xl border border-surface-border bg-ink-50 p-3">
          {product.images?.[0] ? (
            <img
              src={product.images[0]}
              alt=""
              className="h-12 w-12 shrink-0 rounded-lg object-cover"
              width={48}
              height={48}
            />
          ) : (
            <span className="h-12 w-12 shrink-0 rounded-lg bg-ink-200" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink-900">{product.name}</p>
            <p className="flex items-center gap-1.5 truncate text-xs text-muted">
              {product.seller?.name}
              <VerifiedTick verified={product.seller?.verified} compact />
            </p>
          </div>
        </div>

        {create.isError && <Alert tone="danger">{apiError(create.error)}</Alert>}
        {fieldError && <Alert tone="warning">{fieldError}</Alert>}

        <Field
          label="Your message"
          helper="Describe what you need — this starts the conversation."
          trailing={
            <span className={`text-xs ${remaining < 20 ? 'text-danger' : 'text-muted'}`}>
              {remaining} left
            </span>
          }
        >
          {(id) => (
            <textarea
              id={id}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={NOTE_MAX}
              rows={4}
              required
              placeholder="e.g. We need 12 MT monthly of 30s combed cotton, Oeko-Tex certified, delivered to Sydney."
              className="block w-full rounded-lg border border-surface-border px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-500 transition-all focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
            />
          )}
        </Field>

        {/* Optional structure, behind one disclosure. */}
        <div className="rounded-xl border border-surface-border">
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            aria-expanded={detailsOpen}
            className="flex w-full items-center justify-between px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            <span className="text-sm font-semibold text-ink-800">
              {isService ? 'Add budget and timeline' : 'Add quantity, price and delivery'}
              <span className="ml-2 font-normal text-muted">Optional</span>
            </span>
            <ChevronDownIcon
              className={`h-4 w-4 text-ink-500 transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          {detailsOpen && (
            <div className="grid gap-4 border-t border-surface-border p-4 sm:grid-cols-2">
              {/* `Input`, `Select` and `CountrySelect` each render their OWN
                  `Field` wrapper — wrapping them in another one would produce
                  two labels for one control. */}
              {isService ? (
                <>
                  <Input
                    label="Engagement type"
                    optional
                    value={fields.engagementType ?? ''}
                    onChange={(e) => set('engagementType', e.target.value)}
                    placeholder="e.g. one-time project"
                  />
                  <Input
                    label="Budget"
                    optional
                    type="number"
                    min="0"
                    value={fields.budget ?? ''}
                    onChange={(e) => set('budget', e.target.value)}
                  />
                  <Select
                    label="Currency"
                    optional
                    options={CURRENCY_OPTIONS}
                    value={fields.currency ?? ''}
                    onChange={(e) => set('currency', e.target.value)}
                  />
                  <Input
                    label="Timeline"
                    optional
                    value={fields.timeline ?? ''}
                    onChange={(e) => set('timeline', e.target.value)}
                    placeholder="e.g. within 6 weeks"
                  />
                  <Input
                    label="Delivery model"
                    optional
                    value={fields.deliveryModel ?? ''}
                    onChange={(e) => set('deliveryModel', e.target.value)}
                    placeholder="e.g. remote"
                  />
                </>
              ) : (
                <>
                  <Input
                    label="Quantity"
                    optional
                    type="number"
                    min="0"
                    value={fields.quantity ?? ''}
                    onChange={(e) => set('quantity', e.target.value)}
                  />
                  <Input
                    label="Unit"
                    optional
                    value={fields.unit ?? ''}
                    onChange={(e) => set('unit', e.target.value)}
                    placeholder="e.g. kg, pieces, containers"
                  />
                  <Input
                    label="Target price"
                    optional
                    type="number"
                    min="0"
                    step="0.01"
                    value={fields.targetPrice ?? ''}
                    onChange={(e) => set('targetPrice', e.target.value)}
                  />
                  <Select
                    label="Currency"
                    optional
                    options={CURRENCY_OPTIONS}
                    value={fields.currency ?? ''}
                    onChange={(e) => set('currency', e.target.value)}
                  />
                  <CountrySelect
                    label="Deliver to"
                    optional
                    value={fields.deliveryCountry ?? ''}
                    onChange={(value) => set('deliveryCountry', value)}
                  />
                  <Input
                    label="Delivery timeline"
                    optional
                    value={fields.deliveryTimeline ?? ''}
                    onChange={(e) => set('deliveryTimeline', e.target.value)}
                    placeholder="e.g. within 6 weeks"
                  />
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending} disabled={note.trim().length === 0}>
            Send enquiry
          </Button>
        </div>
      </form>
    </Modal>
  );
}
