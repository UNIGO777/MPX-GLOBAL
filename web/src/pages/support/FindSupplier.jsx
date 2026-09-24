import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { LEAD_STATUS, leadsApi, leadsKeys } from '../../api/support.js';
import { apiError, formatDate } from '../../lib/format.js';
import { countryName } from '../../lib/countries.js';
import { TRADE_UNITS } from '../../lib/units.js';
import { PortalLayout } from '../../layouts/PortalLayout.jsx';
import { BUYER_NAV } from '../buyer/buyerNav.js';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { CountrySelect } from '../../components/ui/CountrySelect.jsx';
import { CreatableCombobox } from '../../components/ui/CreatableCombobox.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Field, inputClasses } from '../../components/ui/Field.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { ChatIcon, ChevronRightIcon, EyeIcon, HandshakeIcon, LockIcon, PlusIcon } from '../../components/ui/icons.jsx';
import { StepTitle } from '../../components/support/StepTitle.jsx';

/**
 * `/buyer/find-supplier` — "Help me find a supplier" (Step 1d, quote Module 6
 * enquiry routing). The buyer describes what they need; the MPX Global team
 * finds matching exporters and connects them — each connection is a normal
 * enquiry chat in the buyer's inbox. The buyer never sees which employee
 * handled it.
 */
export function FindSupplier() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Find a supplier — MPX Global';
    return () => { document.title = previous; };
  }, []);

  const list = useQuery({ queryKey: leadsKeys.mine, queryFn: leadsApi.mine });
  const create = useMutation({
    mutationFn: leadsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leadsKeys.mine });
      setOpen(false);
    },
  });
  const rows = list.data ?? [];

  return (
    <PortalLayout nav={BUYER_NAV} wide>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight text-ink-900 sm:text-2xl">Find a supplier</h1>
          <p className="mt-1 hidden text-sm text-muted sm:block">
            Tell us what you need — our team finds matching Indian exporters and connects you.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { create.reset(); setOpen(true); }}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-700"
        >
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          New request
        </button>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="space-y-3">
          {list.isLoading && <SkeletonRows rows={3} />}
          {list.error && <ErrorState message={apiError(list.error).message} onRetry={list.refetch} />}
          {list.isSuccess && rows.length === 0 && (
            <div className="rounded-2xl border border-surface-border bg-white px-6 py-12 text-center shadow-card">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                <HandshakeIcon className="h-7 w-7" />
              </span>
              <p className="mt-4 text-base font-bold text-ink-900">Can&apos;t find the right supplier?</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                Describe the product and quantity — we&apos;ll connect you with exporters who make it.
              </p>
              <Button size="sm" className="mt-5" onClick={() => setOpen(true)}>Make a request</Button>
            </div>
          )}
          {rows.map((l) => {
            const st = LEAD_STATUS[l.status] ?? LEAD_STATUS.new;
            return (
              <article key={l.id} className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
                <div className="flex items-start gap-3 p-4 sm:p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                    <HandshakeIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="w-full min-w-0 break-words text-[15px] font-bold text-ink-900 sm:w-auto sm:flex-1">{l.what}</h2>
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      <span className="font-mono">{l.ref}</span>
                      {l.quantity ? ` · ${l.quantity.toLocaleString()} ${l.unit ?? ''}` : ''}
                      {l.destinationCountry ? ` · to ${countryName(l.destinationCountry) ?? l.destinationCountry}` : ''}
                      {` · ${formatDate(l.createdAt)}`}
                    </p>
                  </div>
                </div>
                {l.suppliers.length > 0 ? (
                  <ul className="divide-y divide-surface-border border-t border-surface-border bg-ink-50/40">
                    {l.suppliers.map((s) => (
                      <li key={s.conversationId}>
                        <Link to={`/buyer/chat/${s.conversationId}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white sm:px-5">
                          <ChatIcon className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-semibold text-ink-900">{s.exporter}</span>
                            <span className="block truncate text-xs text-muted">{s.product}</span>
                          </span>
                          <span className="shrink-0 text-[12.5px] font-semibold text-primary-700">Open chat</span>
                          <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  l.status !== 'closed' && (
                    <p className="border-t border-surface-border bg-ink-50/40 px-4 py-3 text-[13px] text-muted sm:px-5">
                      Our team is looking for suppliers. Connected suppliers will appear here and in your chats.
                    </p>
                  )
                )}
              </article>
            );
          })}
        </section>

        <aside className="rounded-2xl border border-surface-border bg-white p-5 shadow-card">
          <h2 className="text-[15px] font-bold text-ink-900">How it works</h2>
          <ol className="mt-3 space-y-3">
            {[
              ['Tell us what you need', 'The product, quantity and where it should go.'],
              ['We find exporters', 'Our team matches your request with suppliers who make it.'],
              ['Chat directly', 'Each supplier we connect opens a chat in your inbox.'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[12px] font-bold text-primary-700">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-ink-900">{t}</span>
                  <span className="block text-[12.5px] leading-snug text-muted">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      <RequestDrawer
        open={open}
        onClose={() => setOpen(false)}
        saving={create.isPending}
        error={create.error ? apiError(create.error).message : null}
        onSubmit={(v) => create.mutate(v)}
      />
    </PortalLayout>
  );
}

/** Starters for the "what" box — a tap fills a pattern the buyer then edits. */
const EXAMPLES = [
  'Organic cotton fabric, 180 gsm, white',
  'Basmati rice, 1121 sella, 25 kg bags',
  'Stainless steel kitchen sinks, 304 grade',
];

function RequestDrawer({ open, onClose, saving, error, onSubmit }) {
  const [what, setWhat] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [country, setCountry] = useState(null);
  const [note, setNote] = useState('');
  const close = () => {
    if (saving) return;
    setWhat(''); setQuantity(''); setUnit(''); setCountry(null); setNote('');
    onClose();
  };
  const whatOk = what.trim().length >= 3;
  const qtyBad = quantity !== '' && !(Number(quantity) > 0);
  const missing = !whatOk ? 'Add the product' : qtyBad ? 'Check the quantity' : null;
  const detailsDone = Boolean(quantity || unit || country);

  return (
    <Drawer
      open={open}
      onClose={close}
      icon={HandshakeIcon}
      title="Find me a supplier"
      subtitle="Tell us what you need. Our team finds exporters who make it and connects you in chat."
      footer={
        <>
          <span className="mr-auto self-center text-[12.5px] font-medium text-muted" aria-live="polite">
            {missing ?? 'Ready to send'}
          </span>
          <Button variant="secondary" onClick={close} disabled={saving}>Cancel</Button>
          <Button
            className="whitespace-nowrap"
            loading={saving}
            disabled={Boolean(missing)}
            onClick={() =>
              onSubmit({
                what: what.trim(),
                ...(quantity ? { quantity: Number(quantity) } : {}),
                ...(unit ? { unit } : {}),
                ...(country ? { destinationCountry: country } : {}),
                ...(note.trim() ? { note: note.trim() } : {}),
              })
            }
          >
            Send request
          </Button>
        </>
      }
    >
      <div className="space-y-7">
        {error && <Alert tone="danger">{error}</Alert>}

        <section aria-label="What you need">
          <StepTitle n={1} done={whatOk}>What are you looking for?</StepTitle>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="lead-what" className="text-sm font-semibold text-ink-900">Product</label>
            <span className="text-xs tabular-nums text-muted">{what.length}/200</span>
          </div>
          <textarea
            id="lead-what"
            rows={3}
            maxLength={200}
            className={inputClasses(false, 'h-auto py-3')}
            placeholder="Name the product and the specs that matter — material, grade, size, packing."
            value={what}
            onChange={(e) => setWhat(e.target.value)}
          />
          {!what && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="self-center text-[12px] text-muted">For example:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setWhat(ex)}
                  className="rounded-full border border-surface-border bg-white px-2.5 py-1 text-[12px] font-medium text-ink-700 transition-colors hover:border-primary-300 hover:text-primary-700"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </section>

        <section aria-label="Quantity and delivery">
          <StepTitle n={2} done={detailsDone && !qtyBad} optional>Quantity &amp; delivery</StepTitle>
          <div className="space-y-4">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <Field label="Quantity" error={qtyBad ? 'Enter a number above 0' : undefined}>
                {(id) => (
                  <input
                    id={id}
                    type="number"
                    min={1}
                    inputMode="numeric"
                    className={inputClasses(qtyBad)}
                    placeholder="5000"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Unit">
                {(id) => <CreatableCombobox id={id} value={unit} options={TRADE_UNITS} onChange={setUnit} placeholder="e.g. metre" />}
              </Field>
            </div>
            <CountrySelect label="Deliver to" value={country} onChange={setCountry} />
          </div>
        </section>

        <section aria-label="Note for our team">
          <StepTitle n={3} done={Boolean(note.trim())} optional>Anything else?</StepTitle>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="lead-note" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900">
              <LockIcon className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
              Note for our team
            </label>
            <span className="text-xs tabular-nums text-muted">{note.length}/500</span>
          </div>
          <textarea
            id="lead-note"
            rows={3}
            maxLength={500}
            className={inputClasses(false, 'h-auto py-3')}
            placeholder="Certifications, target price, timing — only our team sees this."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </section>

        {whatOk && (
          // Exactly what goes out: the product text + quantity/unit/destination
          // become the first enquiry message (goods). The note never leaves our team.
          <section aria-label="What suppliers will see" className="rounded-xl border border-dashed border-ink-200 bg-surface-subtle p-4">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted">
              <EyeIcon className="h-3.5 w-3.5" aria-hidden="true" />
              What suppliers will see
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words text-[14px] font-medium text-ink-900">{what.trim()}</p>
            {(quantity || country) && (
              <p className="mt-1 text-[12.5px] text-ink-600">
                {quantity && !qtyBad ? `${Number(quantity).toLocaleString()} ${unit}`.trim() : ''}
                {quantity && !qtyBad && country ? ' · ' : ''}
                {country ? `to ${countryName(country) ?? country}` : ''}
              </p>
            )}
          </section>
        )}
      </div>
    </Drawer>
  );
}
