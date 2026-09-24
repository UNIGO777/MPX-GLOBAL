import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { conversationKeys } from '../../api/conversations.js';
import { bankAccountsApi, quotationsApi, quotationKeys } from '../../api/quotations.js';
import { apiError } from '../../lib/format.js';
import { formatMinor, minorToInput, toMinor } from '../../lib/money.js';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { FlashMessage } from '../../components/ui/FlashMessage.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { ItemPicker } from './ItemPicker.jsx';
import { PortalLayout } from '../../layouts/PortalLayout.jsx';
import { EXPORTER_NAV } from './exporterNav.js';
import { PlusIcon, SparkleIcon, TrashIcon } from '../../components/ui/icons.jsx';

/**
 * Module 4 — the exporter's quotation builder (month 2).
 *
 * 🔴 The figures on screen are a PREVIEW. The server recomputes every total from
 * the line items on save and on send, and no total is ever sent up. If the two
 * ever disagree the server wins — which is why nothing here writes a total into
 * state and then submits it.
 *
 * 🔴 Money is typed in MAJOR units and converted at the edge (`lib/money.js`).
 * Nothing between the input and the request holds a decimal.
 *
 * 🔴 Every row carries a stable `uid`. React keys were the array INDEX until
 * 2026-09-25: deleting a row then re-pointed every later row's DOM node at its
 * neighbour's values, so focus and half-typed text jumped rows while the object
 * being edited had already moved. Index keys on an editable list are a bug, not
 * a style choice.
 *
 * AI drafting of the payment schedule is live (2026-09-25) — see the Payment
 * schedule section. The AI-edit-the-whole-quotation step is still not built.
 */
let rowSeq = 0;
const uid = () => {
  rowSeq += 1;
  return `r${rowSeq}`;
};

/** Client-side preview only — `quotationTotals.js` on the server is the truth. */
function previewTotals(items, charges, taxes, milestones) {
  const lines = items.map((i) => ({ ...i, amountMinor: Math.round((Number(i.qty) || 0) * toMinor(i.rate)) }));
  const subtotalMinor = lines.reduce((s, l) => s + l.amountMinor, 0);
  const chargeMinor = charges.reduce((s, c) => s + (c.amount === '' ? 0 : toMinor(c.amount)), 0);
  const taxableMinor = subtotalMinor + chargeMinor;
  const taxLines = taxes.map((t) => ({
    label: t.label || 'Tax',
    amountMinor: Math.round((taxableMinor * (Number(t.ratePct) || 0)) / 100),
  }));
  const taxMinor = taxLines.reduce((s, t) => s + t.amountMinor, 0);
  const totalMinor = taxableMinor + taxMinor;
  const percentTotal = milestones.reduce((s, m) => s + (Number(m.percent) || 0), 0);
  return { subtotalMinor, chargeMinor, taxableMinor, taxLines, totalMinor, percentTotal };
}

function Section({ title, hint, children, action }) {
  return (
    <section className="rounded-2xl border border-surface-border bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-ink-900">{title}</h2>
          {hint && <p className="mt-0.5 text-[13px] leading-snug text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * A cell that matches a field's shape but whose control is NOT an input — a
 * figure, or a button.
 *
 * 🔴 Deliberately not the shared `Field`. That renders a real `<label for=…>`,
 * and pointing one at a `<p>` or a `<button>` is a dangling label: a screen
 * reader announces a form control that does not exist. This mirrors Field's
 * spacing so the columns still line up.
 *
 * `hideLabel` is the spacer case — it keeps the control level with the inputs
 * beside it instead of the hand-tuned `pb-3` that drifted the moment a field
 * showed a helper or an error.
 */
function StaticField({ label, children, hideLabel = false }) {
  return (
    <div className="space-y-1.5">
      <p
        className={`text-sm font-medium text-ink-900 ${hideLabel ? 'invisible' : ''}`}
        aria-hidden={hideLabel || undefined}
      >
        {hideLabel ? '\u00A0' : label}
      </p>
      {children}
    </div>
  );
}

/** A row's delete control. 44px — the minimum touch target (`web-design.md`). */
function RemoveButton({ label, onClick }) {
  return (
    <StaticField hideLabel>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </StaticField>
  );
}

/**
 * "Tell it, and it writes this section" — the same control in three places
 * (owner, 2026-09-25).
 *
 * 🔴 It DRAFTS; the exporter decides. Every one of these replaces what is in the
 * form below it and nothing else — the save is still the exporter's own action,
 * and the server refuses an answer it cannot validate rather than repairing it,
 * so what lands here is always usable.
 */
function AiBox({ label, placeholder, helper, value, onChange, onDraft, pending, error, done, onDismissDone }) {
  return (
    <div className="mb-4 rounded-xl border border-surface-border bg-surface-subtle p-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <Input
          label={label}
          placeholder={placeholder}
          value={value}
          maxLength={300}
          disabled={pending}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim().length >= 3) {
              e.preventDefault();
              onDraft();
            }
          }}
          helper={helper}
        />
        {/* A spacer keeps the button level with the input, without a magic
            offset and without a label pointing at nothing. */}
        <StaticField hideLabel>
          <Button
            variant="secondary"
            loading={pending}
            disabled={value.trim().length < 3}
            onClick={onDraft}
            className="w-full sm:w-auto"
          >
            <SparkleIcon className="h-4 w-4" />
            Draft with AI
          </Button>
        </StaticField>
      </div>
      {error && <Alert tone="danger" className="mt-3">{error}</Alert>}
      {done && (
        <FlashMessage tone="success" className="mt-3" onDismiss={onDismissDone}>
          {done}
        </FlashMessage>
      )}
    </div>
  );
}

function RowsEmpty({ children }) {
  return (
    <p className="rounded-xl border border-dashed border-surface-border bg-surface-subtle px-4 py-5 text-center text-[13px] text-muted">
      {children}
    </p>
  );
}

export function QuotationBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const q = useQuery({ queryKey: quotationKeys.one(id), queryFn: () => quotationsApi.get(id) });
  const banks = useQuery({ queryKey: ['bank-accounts'], queryFn: bankAccountsApi.list });

  const [form, setForm] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [sentNotice, setSentNotice] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // One entry per AI box, keyed by the server's target name.
  const [aiPrompt, setAiPrompt] = useState({ milestones: '', charges: '', details: '' });
  const [aiError, setAiError] = useState({});
  const [aiDone, setAiDone] = useState({});
  // DERIVED, not seeded by an effect: the default is whatever the exporter
  // marked default (else the first), until they pick another. An effect here
  // would be a second source of truth for a value the list already implies.
  const [pickedBank, setPickedBank] = useState(null);

  /* eslint-disable react-hooks/set-state-in-effect -- seeding an EDITABLE form
     from fetched data; the query owns the server copy, this owns the draft. */
  useEffect(() => {
    if (!q.data || form) return;
    setForm({
      validUntil: q.data.validUntil ? String(q.data.validUntil).slice(0, 10) : '',
      incoterm: q.data.incoterm ?? '',
      portOfLoading: q.data.portOfLoading ?? '',
      portOfDischarge: q.data.portOfDischarge ?? '',
      leadTime: q.data.leadTime ?? '',
      items: (q.data.items ?? []).map((i) => ({
        uid: uid(),
        name: i.name ?? '',
        spec: i.spec ?? '',
        hsCode: i.hsCode ?? '',
        qty: i.qty ?? '',
        unit: i.unit ?? '',
        rate: minorToInput(i.rateMinor),
      })),
      charges: (q.data.charges ?? []).map((c) => ({ uid: uid(), label: c.label, amount: minorToInput(c.amountMinor) })),
      taxes: (q.data.taxes ?? []).map((t) => ({ uid: uid(), label: t.label, ratePct: t.ratePct })),
      milestones: (q.data.payment?.milestones ?? []).map((m) => ({ uid: uid(), label: m.label, percent: m.percent })),
      paymentNote: q.data.payment?.note ?? '',
      taxNote: q.data.taxNote ?? '',
      additionalDetails: q.data.additionalDetails ?? '',
    });
  }, [q.data, form]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const bankId =
    pickedBank ?? banks.data?.find((b) => b.isDefault)?.id ?? banks.data?.[0]?.id ?? null;

  const totals = useMemo(
    () => (form ? previewTotals(form.items, form.charges, form.taxes, form.milestones) : null),
    [form],
  );

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const setRow = (key, rowUid, patch) =>
    setForm((f) => ({ ...f, [key]: f[key].map((r) => (r.uid === rowUid ? { ...r, ...patch } : r)) }));
  const addRow = (key, blank) => setForm((f) => ({ ...f, [key]: [...f[key], { uid: uid(), ...blank }] }));
  const dropRow = (key, rowUid) => setForm((f) => ({ ...f, [key]: f[key].filter((r) => r.uid !== rowUid) }));

  /** Major → minor happens HERE, once, on the way out. */
  const payload = useCallback(() => ({
    validUntil: form.validUntil || undefined,
    incoterm: form.incoterm || undefined,
    portOfLoading: form.portOfLoading || undefined,
    portOfDischarge: form.portOfDischarge || undefined,
    leadTime: form.leadTime || undefined,
    items: form.items
      .filter((i) => i.name.trim())
      .map((i) => ({
        name: i.name.trim(),
        ...(i.spec.trim() ? { spec: i.spec.trim() } : {}),
        ...(i.hsCode.trim() ? { hsCode: i.hsCode.trim() } : {}),
        qty: Number(i.qty) || 0,
        ...(i.unit.trim() ? { unit: i.unit.trim() } : {}),
        rateMinor: toMinor(i.rate),
      })),
    charges: form.charges
      .filter((c) => c.label.trim())
      // '' is "Included" and must stay null — 0 would print as free.
      .map((c) => ({ label: c.label.trim(), amountMinor: c.amount === '' ? null : toMinor(c.amount) })),
    taxes: form.taxes.filter((t) => t.label.trim()).map((t) => ({ label: t.label.trim(), ratePct: Number(t.ratePct) || 0 })),
    payment: {
      milestones: form.milestones
        .filter((m) => m.label.trim())
        .map((m) => ({ label: m.label.trim(), percent: Number(m.percent) || 0 })),
      ...(form.paymentNote.trim() ? { note: form.paymentNote.trim() } : {}),
    },
    ...(form.taxNote.trim() ? { taxNote: form.taxNote.trim() } : {}),
    ...(form.additionalDetails.trim() ? { additionalDetails: form.additionalDetails.trim() } : {}),
  }), [form]);

  const save = useMutation({
    mutationFn: () => quotationsApi.update(id, payload()),
    onSuccess: (updated) => {
      queryClient.setQueryData(quotationKeys.one(id), updated);
      setSaveError(null);
      setSavedAt(new Date());
    },
    onError: (e) => setSaveError(apiError(e, 'Could not save.').message),
  });

  /**
   * 🔴 The result goes into the FORM, not to the server. Saving is still the
   * exporter's own action, so a draft they disagree with is one keystroke from
   * being changed and is never on a document they did not send.
   */
  const draftAi = useMutation({
    mutationFn: (target) => quotationsApi.draftWithAi(id, target, aiPrompt[target].trim()),
    onSuccess: (data, target) => {
      setForm((f) => {
        if (target === 'milestones') {
          return {
            ...f,
            milestones: data.milestones.map((m) => ({ uid: uid(), label: m.label, percent: m.percent })),
          };
        }
        if (target === 'charges') {
          return {
            ...f,
            charges: data.charges.map((c) => ({ uid: uid(), label: c.label, amount: minorToInput(c.amountMinor) })),
            taxes: data.taxes.map((t) => ({ uid: uid(), label: t.label, ratePct: t.ratePct })),
          };
        }
        return { ...f, additionalDetails: data.details };
      });
      setAiError((e) => ({ ...e, [target]: null }));
      setAiDone((d) => ({
        ...d,
        [target]:
          target === 'milestones'
            ? `Drafted ${data.milestones.length} milestone${data.milestones.length === 1 ? '' : 's'}. Check them — you are still the one sending this.`
            : target === 'charges'
              ? `Drafted ${data.charges.length} charge${data.charges.length === 1 ? '' : 's'} and ${data.taxes.length} tax${data.taxes.length === 1 ? '' : 'es'}. Check the amounts.`
              : 'Drafted the note. Read it before you send — it prints on the document.',
      }));
    },
    onError: (e, target) => {
      setAiDone((d) => ({ ...d, [target]: null }));
      setAiError((prev) => ({ ...prev, [target]: apiError(e, 'Could not draft that.').message }));
    },
  });

  const aiBoxProps = (target) => ({
    value: aiPrompt[target],
    onChange: (v) => setAiPrompt((p) => ({ ...p, [target]: v })),
    onDraft: () => draftAi.mutate(target),
    pending: draftAi.isPending && draftAi.variables === target,
    error: aiError[target],
    done: aiDone[target],
    onDismissDone: () => setAiDone((d) => ({ ...d, [target]: null })),
  });

  /**
   * 🔴 AUTOSAVE — because the owner removed the Save draft button (2026-09-25),
   * and a form that can only be saved by SENDING would lose an afternoon's work
   * to a closed tab. This is what the button did, on a 1.5s debounce.
   *
   * It compares the SERIALISED payload, not the form object: seeding the form,
   * re-rendering, or typing a character and deleting it all produce an identical
   * payload and must not cost a request.
   *
   * It never runs on a sent quotation — that document is a record.
   */
  const savedPayload = useRef(null);
  const saveRef = useRef(save);
  // Written in an effect, never during render: a render can be discarded, and a
  // ref mutated during one would point at an abandoned attempt.
  useEffect(() => {
    saveRef.current = save;
  });

  const isSent = Boolean(q.data) && q.data.status !== 'draft';

  useEffect(() => {
    if (!form || isSent) return undefined;
    const body = JSON.stringify(payload());
    // First pass after seeding: record what the server already has, save nothing.
    if (savedPayload.current === null) {
      savedPayload.current = body;
      return undefined;
    }
    if (body === savedPayload.current) return undefined;

    const timer = setTimeout(() => {
      savedPayload.current = body;
      saveRef.current.mutate();
    }, 1500);
    return () => clearTimeout(timer);
  }, [form, isSent, payload]);

  const send = useMutation({
    // Save first: sending validates the SERVER's copy, so an unsaved edit would
    // be judged against stale data and either pass wrongly or fail confusingly.
    mutationFn: async () => {
      await quotationsApi.update(id, payload());
      return quotationsApi.send(id, bankId ?? undefined);
    },
    onSuccess: (sent) => {
      queryClient.setQueryData(quotationKeys.one(id), sent);
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      setSendOpen(false);

      /**
       * The thread now has a notice the cache has not seen. The socket patches
       * an OPEN thread, but this one may have been read earlier in the session
       * and left — arriving at a cached transcript with the quotation missing
       * is the obvious failure of navigating straight there.
       */
      if (sent.conversationId) {
        queryClient.invalidateQueries({ queryKey: conversationKeys.messages(sent.conversationId) });
        queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
      }

      /**
       * Straight to the thread it was sent into (owner, 2026-09-25). A quotation
       * is not filed somewhere — it LANDS IN THE CHAT as a document card, and
       * what the exporter wants next is to see what the buyer now sees, and to
       * say something alongside it.
       *
       * ⚠️ Only when the quotation actually has a conversation. It always does
       * today (a draft is started from a thread), but a quotation created any
       * other way later would otherwise navigate to `/exporter/chat/undefined`,
       * which the inbox reads as a thread id and 404s on. Without one, the page
       * stays in its read-only sent state, which is still a correct place to be.
       */
      if (sent.conversationId) {
        navigate(`/exporter/chat/${sent.conversationId}`);
        return;
      }
      setSentNotice(`${sent.number} sent to the buyer.`);
    },
    onError: (e) => setSaveError(apiError(e, 'Could not send.').message),
  });

  if (q.isError) return <PortalLayout nav={EXPORTER_NAV} wide><ErrorState onRetry={q.refetch} /></PortalLayout>;
  if (!form || q.isPending) {
    return (
      <PortalLayout nav={EXPORTER_NAV} wide>
        <div className="space-y-4">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </PortalLayout>
    );
  }

  // The same value as `isSent` above — that one is derived BEFORE the early
  // returns because the autosave effect needs it, and a hook cannot run
  // conditionally. One source, two names, no second derivation.
  const sent = isSent;
  const milestonesOff = form.milestones.length > 0 && Math.abs(totals.percentTotal - 100) > 0.001;
  const currency = q.data.currency;

  /**
   * 🔴 What is still missing, said BEFORE the button is pressed.
   *
   * The server refuses an incomplete quotation (`validateForSend`) and it stays
   * the authority — this only stops the exporter filling a long form, pressing
   * Send and learning about a missing date from a red box. The two lists must
   * say the same things; if the server gains a rule, add it here too.
   */
  const blockers = [
    form.items.filter((i) => i.name.trim()).length === 0 && 'Add at least one item.',
    !form.validUntil && 'Set a validity date.',
    milestonesOff && `Milestones total ${totals.percentTotal}%, not 100%.`,
  ].filter(Boolean);

  return (
    <PortalLayout nav={EXPORTER_NAV} wide>
      <header className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-primary-700">Quotation</p>
        <h1 className="font-serif text-2xl text-ink-900">{q.data.number}</h1>
        <p className="mt-1 text-sm text-muted">
          For {q.data.buyer?.name ?? 'the buyer'} · {currency}
        </p>
      </header>

      {/* Reports something that JUST happened, so it goes by itself
          (`web-design.md` — confirmations disappear). */}
      {sentNotice && (
        <FlashMessage tone="success" className="mb-4" onDismiss={() => setSentNotice(null)}>
          {sentNotice}
        </FlashMessage>
      )}
      {/* A STATE, not an event — it stays until the state changes. */}
      {sent && (
        <Alert tone="info" className="mb-4">
          This quotation has been sent and is now a record. To change anything, create a revision.
        </Alert>
      )}
      {saveError && <Alert tone="danger" className="mb-4">{saveError}</Alert>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0 space-y-4">
          <Section title="Validity and shipping">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Valid until"
                type="date"
                value={form.validUntil}
                onChange={(e) => set('validUntil')(e.target.value)}
                disabled={sent}
                error={!form.validUntil && !sent ? 'Needed before you can send.' : undefined}
              />
              <Input label="Lead time" value={form.leadTime} onChange={(e) => set('leadTime')(e.target.value)} disabled={sent} optional placeholder="e.g. 2 weeks" />
              <Input label="Incoterm" value={form.incoterm} onChange={(e) => set('incoterm')(e.target.value)} disabled={sent} optional placeholder="e.g. CIF Jebel Ali" />
              <Input label="Port of loading" value={form.portOfLoading} onChange={(e) => set('portOfLoading')(e.target.value)} disabled={sent} optional placeholder="e.g. Mundra" />
              <Input label="Port of discharge" value={form.portOfDischarge} onChange={(e) => set('portOfDischarge')(e.target.value)} disabled={sent} optional placeholder="e.g. Jebel Ali" />
            </div>
          </Section>

          <Section
            title="Items"
            hint={`Rates are per unit, in ${currency}.`}
            action={
              !sent && (
                <Button size="sm" variant="secondary" onClick={() => setPickerOpen(true)}>
                  <PlusIcon className="h-4 w-4" /> Add item
                </Button>
              )
            }
          >
            {form.items.length === 0 ? (
              <RowsEmpty>
                No items yet. “Add item” picks from your catalogue, or adds a blank line to type.
              </RowsEmpty>
            ) : (
              <ul className="space-y-3">
                {form.items.map((item) => (
                  <li key={item.uid} className="rounded-xl border border-surface-border bg-surface-subtle p-3">
                    {/* Two bands: WHAT it is, then HOW MUCH. Six equal columns
                        squeezed HS code, qty and unit to a sixth of the width
                        each, which is unusable at laptop width beside the
                        320px totals rail. */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input label="Description" value={item.name} onChange={(e) => setRow('items', item.uid, { name: e.target.value })} disabled={sent} />
                      <Input label="Specification" value={item.spec} onChange={(e) => setRow('items', item.uid, { spec: e.target.value })} disabled={sent} optional placeholder="Grade, GSM, packing…" />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-surface-border pt-3 sm:grid-cols-[1fr_0.8fr_0.8fr_1fr_auto_auto] sm:items-start">
                      <Input label="HS code" value={item.hsCode} onChange={(e) => setRow('items', item.uid, { hsCode: e.target.value })} disabled={sent} optional />
                      <Input label="Qty" type="number" min="0" inputMode="decimal" value={item.qty} onChange={(e) => setRow('items', item.uid, { qty: e.target.value })} disabled={sent} />
                      <Input label="Unit" value={item.unit} onChange={(e) => setRow('items', item.uid, { unit: e.target.value })} disabled={sent} optional placeholder="MT" />
                      <Input label={`Rate (${currency})`} type="number" min="0" step="0.01" inputMode="decimal" value={item.rate} onChange={(e) => setRow('items', item.uid, { rate: e.target.value })} disabled={sent} />
                      {/* Labelled like every other cell — it is a figure on the
                          document, not a decoration beside the inputs. */}
                      <StaticField label="Amount">
                        <p className="flex h-11 items-center justify-end whitespace-nowrap px-1 text-sm font-bold tabular-nums text-ink-900">
                          {formatMinor(Math.round((Number(item.qty) || 0) * toMinor(item.rate)), currency)}
                        </p>
                      </StaticField>
                      {!sent && (
                        <RemoveButton label={`Remove ${item.name || 'item'}`} onClick={() => dropRow('items', item.uid)} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Charges and taxes"
            hint="Leave a charge's amount blank to print it as “Included”."
            action={
              !sent && (
                <span className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => addRow('charges', { label: '', amount: '' })}>Add charge</Button>
                  <Button size="sm" variant="secondary" onClick={() => addRow('taxes', { label: '', ratePct: '' })}>Add tax</Button>
                </span>
              )
            }
          >
            {!sent && (
              <AiBox
                label="Describe the charges and taxes"
                placeholder="Ocean freight 25000, insurance included, IGST 18%"
                helper="It replaces the rows below. Amounts are in the quotation's currency — check them."
                {...aiBoxProps('charges')}
              />
            )}

            {form.charges.length === 0 && form.taxes.length === 0 ? (
              <RowsEmpty>No charges or taxes. The total is the sum of the items.</RowsEmpty>
            ) : (
              <div className="space-y-2">
                {form.charges.map((c) => (
                  <div key={c.uid} className="grid grid-cols-[minmax(0,1fr)_130px_auto] gap-2 sm:gap-3">
                    <Input label="Charge" value={c.label} onChange={(e) => setRow('charges', c.uid, { label: e.target.value })} disabled={sent} placeholder="Freight" />
                    <Input label={`Amount (${currency})`} type="number" min="0" step="0.01" inputMode="decimal" value={c.amount} onChange={(e) => setRow('charges', c.uid, { amount: e.target.value })} disabled={sent} optional placeholder="Included" />
                    {!sent && <RemoveButton label={`Remove ${c.label || 'charge'}`} onClick={() => dropRow('charges', c.uid)} />}
                  </div>
                ))}
                {form.taxes.map((t) => (
                  <div key={t.uid} className="grid grid-cols-[minmax(0,1fr)_130px_auto] gap-2 sm:gap-3">
                    <Input label="Tax" value={t.label} onChange={(e) => setRow('taxes', t.uid, { label: e.target.value })} disabled={sent} placeholder="IGST" />
                    <Input label="Rate %" type="number" min="0" max="100" step="0.01" inputMode="decimal" value={t.ratePct} onChange={(e) => setRow('taxes', t.uid, { ratePct: e.target.value })} disabled={sent} placeholder="18" />
                    {!sent && <RemoveButton label={`Remove ${t.label || 'tax'}`} onClick={() => dropRow('taxes', t.uid)} />}
                  </div>
                ))}
              </div>
            )}
            <Input className="mt-3" label="Tax note" value={form.taxNote} onChange={(e) => set('taxNote')(e.target.value)} disabled={sent} optional placeholder="e.g. Taxes as applicable at the time of shipment" />
          </Section>

          <Section
            title="Payment schedule"
            hint="Must add up to 100%. The last milestone absorbs any rounding, so the parts always equal the total."
            action={
              !sent && (
                <Button size="sm" variant="secondary" onClick={() => addRow('milestones', { label: '', percent: '' })}>
                  Add milestone
                </Button>
              )
            }
          >
            {/* 🔴 AI DRAFTS, the exporter DECIDES (owner, 2026-09-25: "i just
                tell and milestone will create by ai"). The rows land in the form
                below and are saved by the ordinary Save — nothing here writes to
                the quotation, and a sent one has no AI box at all. The server
                refuses a schedule that does not add to 100 rather than
                repairing it, so what arrives here is always usable. */}
            {!sent && (
              <AiBox
                label="Describe the payment stages"
                placeholder="30% advance, 60% against B/L, rest after delivery"
                helper="It replaces the rows below. Read them before you send — they go on the document."
                {...aiBoxProps('milestones')}
              />
            )}

            {form.milestones.length === 0 ? (
              <RowsEmpty>No schedule yet. Describe it above, or add the stages by hand.</RowsEmpty>
            ) : (
              <>
                <div className="space-y-2">
                  {form.milestones.map((m) => (
                    <div key={m.uid} className="grid grid-cols-[minmax(0,1fr)_110px_auto] gap-2 sm:gap-3">
                      <Input label="Milestone" value={m.label} onChange={(e) => setRow('milestones', m.uid, { label: e.target.value })} disabled={sent} placeholder="Advance with order" />
                      <Input label="%" type="number" min="0" max="100" step="0.01" inputMode="decimal" value={m.percent} onChange={(e) => setRow('milestones', m.uid, { percent: e.target.value })} disabled={sent} />
                      {!sent && <RemoveButton label={`Remove ${m.label || 'milestone'}`} onClick={() => dropRow('milestones', m.uid)} />}
                    </div>
                  ))}
                </div>
                {/* Running total, always — not only when it is wrong. Watching it
                    reach 100 is easier than being told afterwards that it did not. */}
                <p
                  className={`mt-2 text-right text-[13px] font-semibold ${
                    milestonesOff ? 'text-warning-700' : 'text-muted'
                  }`}
                >
                  {totals.percentTotal}% of 100%
                </p>
              </>
            )}
            {milestonesOff && (
              <Alert tone="warning" className="mt-3">
                Milestones add up to {totals.percentTotal}%, not 100%. This blocks sending.
              </Alert>
            )}
            <Input className="mt-3" label="Payment note" value={form.paymentNote} onChange={(e) => set('paymentNote')(e.target.value)} disabled={sent} optional placeholder="e.g. All payments by T/T" />
          </Section>

          <Section title="Additional details" hint="Anything else the buyer should know. Printed as a note — never as a contractual term.">
            {!sent && (
              <AiBox
                label="What should the buyer know?"
                placeholder="Packing, sampling, inspection, anything worth saying"
                helper="It replaces the note below. The server discards a draft carrying contact details."
                {...aiBoxProps('details')}
              />
            )}
            {/* A real <label>, via the shared Field — this was a bare textarea
                with no label at all, which no screen reader could announce. */}
            <Field
              label="Notes"
              optional
              helper={`${form.additionalDetails.length}/2000`}
            >
              {(fieldId, hasError) => (
                <textarea
                  id={fieldId}
                  rows={4}
                  value={form.additionalDetails}
                  onChange={(e) => set('additionalDetails')(e.target.value)}
                  disabled={sent}
                  maxLength={2000}
                  /* The input styling minus its fixed height — `inputClasses`
                     hard-codes `h-11`, and adding `h-auto` next to it is a
                     coin-flip on which class the stylesheet emits last. */
                  className={[
                    'w-full rounded-lg border px-4 py-3 text-sm text-ink-900 placeholder:text-ink-500 transition-all',
                    'focus:outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20',
                    'disabled:bg-ink-100 disabled:text-ink-500 disabled:cursor-not-allowed',
                    hasError ? 'border-danger bg-danger-50' : 'border-surface-border bg-white',
                  ].join(' ')}
                />
              )}
            </Field>
          </Section>
        </div>

        {/* Totals + the send step. Sticky, because the number is what the
            exporter is watching while they type. */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          <section className="rounded-2xl border border-primary-100 bg-primary-50 p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-primary-700">Total</h2>
            <p className="mt-1 font-serif text-2xl text-ink-900">{formatMinor(totals.totalMinor, currency)}</p>
            <dl className="mt-3 space-y-1 border-t border-primary-100 pt-3 text-[13px] text-muted">
              <div className="flex justify-between gap-3">
                <dt>Items</dt>
                <dd className="tabular-nums">{formatMinor(totals.subtotalMinor, currency)}</dd>
              </div>
              {totals.chargeMinor > 0 && (
                <div className="flex justify-between gap-3">
                  <dt>Charges</dt>
                  <dd className="tabular-nums">{formatMinor(totals.chargeMinor, currency)}</dd>
                </div>
              )}
              {/* Each tax by name. One merged "tax" line is not what prints on
                  the document, and the two disagreeing is the confusion. */}
              {totals.taxLines.map((t, i) => (
                <div key={`${t.label}-${i}`} className="flex justify-between gap-3">
                  <dt className="truncate">{t.label}</dt>
                  <dd className="tabular-nums">{formatMinor(t.amountMinor, currency)}</dd>
                </div>
              ))}
            </dl>
            {/* Said plainly, because it is true and it explains any difference. */}
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              A preview. The server recalculates every figure when you save and when you send.
            </p>
          </section>

          {!sent && (
            <div className="space-y-2">
              <Button
                fullWidth
                loading={send.isPending}
                disabled={blockers.length > 0}
                onClick={() => setSendOpen(true)}
              >
                Send to buyer
              </Button>

              {/* 🔴 The Save draft button is gone (owner, 2026-09-25), so the
                  saving has to be VISIBLE instead — a form that saves silently
                  and a form that is not saving look identical until the work is
                  gone. The failure case keeps a real button: an autosave that
                  quietly gave up would be the worst of both. */}
              {saveError ? (
                <div className="rounded-xl border border-danger-200 bg-danger-50 p-3">
                  <p className="text-[12.5px] font-medium text-danger-700">{saveError}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    loading={save.isPending}
                    onClick={() => save.mutate()}
                  >
                    Try saving again
                  </Button>
                </div>
              ) : (
                <p className="text-center text-[12px] text-muted" aria-live="polite">
                  {save.isPending
                    ? 'Saving…'
                    : savedAt
                      ? `Saved automatically at ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'Changes save automatically.'}
                </p>
              )}

              {/* WHY the button is disabled, next to the button. A dead control
                  with no explanation is the thing `web-design.md` bans. */}
              {blockers.length > 0 && (
                <ul className="space-y-1 rounded-xl bg-surface-subtle p-3 text-[12.5px] text-muted">
                  {blockers.map((b) => (
                    <li key={b}>· {b}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </aside>
      </div>

      <ItemPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(line) => addRow('items', line)}
      />

      {/* 🔴 The bank step is a CONFIRMATION, not a pre-fill. The exporter sees
          the details that will be printed and says yes — silent auto-fill is how
          tampered details reach a buyer unnoticed. */}
      <Modal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        title="Send this quotation?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSendOpen(false)}>Cancel</Button>
            <Button loading={send.isPending} onClick={() => { setSaveError(null); send.mutate(); }}>
              Send to buyer
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-700">
          Once sent, this quotation is a record — the figures, the bank details and both companies&apos;
          details are frozen exactly as they are now. Changing your saved bank account later will not
          change this document.
        </p>

        <dl className="mt-4 flex justify-between gap-3 rounded-xl bg-surface-subtle p-3 text-sm">
          <dt className="text-muted">Total the buyer will see</dt>
          <dd className="font-bold text-ink-900">{formatMinor(totals.totalMinor, currency)}</dd>
        </dl>

        <h3 className="mt-4 text-sm font-semibold text-ink-900">Bank details to print</h3>
        {banks.data?.length ? (
          <ul className="mt-2 space-y-2">
            {banks.data.map((b) => (
              <li key={b.id}>
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${bankId === b.id ? 'border-primary-600 bg-primary-50' : 'border-surface-border'}`}>
                  <input type="radio" name="bank" checked={bankId === b.id} onChange={() => setPickedBank(b.id)} className="mt-1" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink-900">{b.label}</span>
                    <span className="block text-[13px] text-muted">
                      {b.beneficiary} · {b.bankName} · {b.masked}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          /* 🔴 Honest, because the screen it used to point at does not exist:
             this said "add them in your company settings", and there is no such
             section anywhere in the web app yet (logged in docs/UiWebNotes.md).
             Sending someone to look for a thing that is not there is worse than
             telling them it is coming.

             The comment is a plain JS one, NOT a `{…}` JSX comment: inside a
             ternary branch that makes two adjacent nodes and the file stops
             parsing. That trap has now cost four separate sessions. */
          <Alert tone="warning" className="mt-2">
            No saved bank details, so this quotation will print without payment details. Adding them
            from the app is not built yet — you can still send, and the buyer can be given the
            details in the chat.
          </Alert>
        )}
      </Modal>
    </PortalLayout>
  );
}
