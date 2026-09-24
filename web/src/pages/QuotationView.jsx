import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { quotationsApi, quotationKeys } from '../api/quotations.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { apiError, formatDate } from '../lib/format.js';
import { formatMinor } from '../lib/money.js';
import { downloadQuotationPdf } from '../lib/quotationPdf.js';
import { Alert } from '../components/ui/Alert.jsx';
import { Logo } from '../components/ui/Logo.jsx';
import { Button } from '../components/ui/Button.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { QuotationActions } from '../components/quotation/QuotationActions.jsx';
import { PortalLayout } from '../layouts/PortalLayout.jsx';
import { BUYER_NAV } from './buyer/buyerNav.js';
import { EXPORTER_NAV } from './exporter/exporterNav.js';

/**
 * The quotation document — the same page for BOTH parties.
 *
 * 🔴 One renderer, not two. A buyer's copy and a supplier's copy of the same
 * document that are built by different code are two chances to disagree about a
 * price. The only difference is the ACTIONS: the buyer can accept or decline,
 * the supplier can only watch.
 *
 * 🔴 Everything here comes from the SERVER's frozen snapshot — the totals, both
 * companies and the bank details as they were when it was sent. Nothing is
 * recomputed in the browser, so what the buyer reads is what was issued.
 *
 * ⚠️ Printing is the browser's own (`window.print()`), which is also how the PDF
 * is produced. No server-side PDF renderer: that means headless Chrome, a heavy
 * dependency, for a page the browser already prints correctly.
 */
function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-6 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink-900">{value}</dd>
    </div>
  );
}

function Party({ title, party }) {
  if (!party) return null;
  const where = [party.address, party.city, party.state, party.postcode, party.country]
    .filter(Boolean)
    .join(', ');
  const ids = [party.gstin && `GSTIN ${party.gstin}`, party.iec && `IEC ${party.iec}`, party.taxId]
    .filter(Boolean)
    .join(' · ');
  return (
    <section>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{title}</p>
      <p className="mt-1 text-[15px] font-bold text-ink-900">{party.name}</p>
      {where && <p className="text-sm text-muted">{where}</p>}
      {ids && <p className="text-sm text-muted">{ids}</p>}
      {party.contactName && <p className="text-sm text-muted">Contact: {party.contactName}</p>}
    </section>
  );
}

export function QuotationView() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const q = useQuery({ queryKey: quotationKeys.one(id), queryFn: () => quotationsApi.get(id) });

  // Declining only. Accepting is the two-step confirmed flow in
  // <QuotationActions> — there is no single-shot accept on the server, and a
  // second path to the same state here would be the bypass.
  const answer = useMutation({
    mutationFn: () => quotationsApi.decline(id, reason.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.one(id) });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      setDeclineOpen(false);
    },
    onError: (e) => setError(apiError(e, 'Could not answer this quotation.').message),
  });

  const nav = user?.role === 'exporter' ? EXPORTER_NAV : BUYER_NAV;

  if (q.isError) return <PortalLayout nav={nav}><ErrorState onRetry={q.refetch} /></PortalLayout>;
  if (q.isPending) {
    return (
      <PortalLayout nav={nav}>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </PortalLayout>
    );
  }

  const d = q.data;
  const t = d.totals ?? {};
  const isBuyer = user?.role === 'buyer';
  const viewerSide = user?.role === 'exporter' ? 'exporter' : 'buyer';
  // A quotation mid-negotiation is still live — it can be answered, and a page
  // that treats it as closed hides the buttons on a deal that is working.
  const open = d.status === 'sent' || d.status === 'negotiating';

  return (
    <PortalLayout nav={nav} wide>
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary-700">Quotation</p>
          <h1 className="font-serif text-2xl text-ink-900">{d.number}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* A real text PDF, built from the same frozen snapshot this page
              renders — see lib/quotationPdf.js. pdfmake loads on demand, so the
              ~1 MB of library and fonts costs nothing on first paint. */}
          <Button
            variant="secondary"
            loading={downloading}
            onClick={async () => {
              setError(null);
              setDownloading(true);
              try {
                await downloadQuotationPdf(d);
              } catch {
                // Never a silent no-op: a Download button that does nothing is
                // read as the document being broken.
                setError('Could not build the PDF. Try again, or use your browser’s print to PDF.');
              } finally {
                setDownloading(false);
              }
            }}
          >
            Download PDF
          </Button>
          {isBuyer && open && (
            <Button variant="secondary" onClick={() => setDeclineOpen(true)}>Decline</Button>
          )}
          {open && (
            <QuotationActions
              quotation={d}
              viewerSide={viewerSide}
              onChanged={() => setError(null)}
            />
          )}
        </div>
      </div>

      {/* The negotiation, oldest first. It lives OUTSIDE the document: the
          printed quotation is a frozen record of what was issued, and writing
          later offers into it would make the document disagree with itself. */}
      {d.offers?.length > 0 && (
        <section className="mb-4 rounded-2xl border border-surface-border bg-white p-4 print:hidden">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted">Negotiation</h2>
          <ol className="mt-2 space-y-1.5">
            {d.offers.map((o, i) => (
              <li key={`${o.at}-${i}`} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-semibold text-ink-900">
                  {o.by === 'buyer' ? 'Buyer' : 'Supplier'} offered {formatMinor(o.totalMinor, d.currency)}
                </span>
                <span className="text-muted">{formatDate(o.at)}</span>
                {o.note && <span className="w-full text-[13px] text-muted">“{o.note}”</span>}
              </li>
            ))}
          </ol>
          {d.acceptance?.initiatedBy && !d.acceptance.confirmedBy && (
            <p className="mt-3 text-[13px] font-medium text-warning-700">
              The {d.acceptance.initiatedBy === 'buyer' ? 'buyer' : 'supplier'} has confirmed{' '}
              {formatMinor(d.acceptance.agreedTotalMinor, d.currency)} — waiting for the other party.
            </p>
          )}
        </section>
      )}

      {/* Status is stated, never implied by colour alone. */}
      {d.status !== 'sent' && (
        <Alert tone={d.status === 'accepted' ? 'success' : 'info'} className="mb-4 print:hidden">
          This quotation is {d.status}
          {d.status === 'accepted' && d.acceptance?.agreedTotalMinor != null
            ? ` at ${formatMinor(d.acceptance.agreedTotalMinor, d.currency)}, confirmed by both companies`
            : ''}
          {d.declineReason ? ` — “${d.declineReason}”` : ''}.
        </Alert>
      )}

      <article className="rounded-2xl border border-surface-border bg-white p-6 sm:p-8">
        {/* The masthead the PDF prints, so the page and the file open the same
            way: the navy rule with its red leading segment, the real mark, and
            the document's own name. */}
        <div className="mb-5 flex h-1 w-full overflow-hidden" aria-hidden="true">
          <span className="w-[17%] bg-paper-accent" />
          <span className="flex-1 bg-paper-ink" />
        </div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <Logo size="md" />
          <p className="font-serif text-xl tracking-[0.18em] text-paper-ink">QUOTATION</p>
        </div>

        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-surface-border pb-5">
          <div>
            <p className="font-serif text-xl text-ink-900">{d.number}</p>
            <p className="text-sm text-muted">
              Issued {formatDate(d.issueDate)} · Valid until {formatDate(d.validUntil)}
            </p>
          </div>
          <p className="text-right">
            <span className="block text-[11px] uppercase tracking-widest text-muted">Total</span>
            <span className="font-serif text-2xl text-ink-900">{formatMinor(t.totalMinor, d.currency)}</span>
          </p>
        </header>

        <div className="grid gap-6 border-b border-surface-border py-5 sm:grid-cols-2">
          <Party title="From · Supplier" party={d.supplier} />
          <Party title="To · Buyer" party={d.buyer} />
        </div>

        {(d.incoterm || d.portOfLoading || d.portOfDischarge || d.leadTime) && (
          <dl className="grid gap-x-8 border-b border-surface-border py-4 sm:grid-cols-2">
            <Row label="Incoterm" value={d.incoterm} />
            <Row label="Lead time" value={d.leadTime} />
            <Row label="Port of loading" value={d.portOfLoading} />
            <Row label="Port of discharge" value={d.portOfDischarge} />
          </dl>
        )}

        <table className="mt-5 w-full text-sm">
          <thead>
            <tr className="border-b border-ink-900 text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="py-2">Description</th>
              <th className="py-2">HS code</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Rate</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(t.lines ?? d.items ?? []).map((l, i) => (
              <tr key={i} className="border-b border-surface-border align-top">
                <td className="py-2.5">
                  <span className="block font-semibold text-ink-900">{l.name}</span>
                  {l.spec && <span className="block text-[13px] text-muted">{l.spec}</span>}
                </td>
                <td className="py-2.5 text-muted">{l.hsCode || '—'}</td>
                <td className="py-2.5 text-right">{l.qty}{l.unit ? ` ${l.unit}` : ''}</td>
                <td className="py-2.5 text-right">{formatMinor(l.rateMinor, d.currency)}</td>
                <td className="py-2.5 text-right font-semibold">{formatMinor(l.amountMinor, d.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <div>
            {(t.payments ?? []).length > 0 && (
              <section className="rounded-xl border border-surface-border p-4">
                <h2 className="text-[13px] font-bold text-ink-900">Payment schedule</h2>
                <dl className="mt-1">
                  {t.payments.map((p, i) => (
                    <Row key={i} label={p.label} value={formatMinor(p.amountMinor, d.currency)} />
                  ))}
                </dl>
                {d.payment?.note && <p className="mt-2 text-[13px] text-muted">{d.payment.note}</p>}
              </section>
            )}
            {d.additionalDetails && (
              <section className="mt-4 rounded-xl bg-surface-subtle p-4">
                <h2 className="text-[13px] font-bold text-ink-900">Additional details</h2>
                <p className="mt-1 whitespace-pre-wrap text-[13px] text-ink-700">{d.additionalDetails}</p>
              </section>
            )}
          </div>

          <dl className="self-start rounded-xl border border-primary-100 bg-primary-50 p-4">
            <Row label="Subtotal" value={formatMinor(t.subtotalMinor, d.currency)} />
            {(t.charges ?? []).map((c, i) => (
              <Row key={i} label={c.label} value={c.included ? 'Included' : formatMinor(c.amountMinor, d.currency)} />
            ))}
            {(t.taxes ?? []).map((tx, i) => (
              <Row key={i} label={tx.label} value={formatMinor(tx.amountMinor, d.currency)} />
            ))}
            <div className="mt-2 flex justify-between border-t border-primary-100 pt-2">
              <dt className="font-bold text-ink-900">Total</dt>
              <dd className="font-serif text-lg text-ink-900">{formatMinor(t.totalMinor, d.currency)}</dd>
            </div>
            {d.taxNote && <p className="mt-2 text-[12px] text-muted">{d.taxNote}</p>}
          </dl>
        </div>

        {d.bank && (
          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-surface-border p-4">
              <h2 className="text-[13px] font-bold text-ink-900">Supplier bank details</h2>
              <dl className="mt-1">
                <Row label="Beneficiary" value={d.bank.beneficiary} />
                <Row label="Bank" value={[d.bank.bankName, d.bank.branch].filter(Boolean).join(', ')} />
                <Row label="Account" value={d.bank.accountNumber ?? d.bank.masked} />
                <Row label="SWIFT / IFSC" value={[d.bank.swift, d.bank.ifsc].filter(Boolean).join(' / ')} />
              </dl>
            </div>
            {/* 🔴 The warning the design asked for, and it is not decoration:
                altered bank details on a genuine-looking document is the single
                most common way a buyer loses money on a deal like this. */}
            <div className="rounded-xl bg-danger-50 p-4">
              <p className="text-[13px] font-bold text-danger-700">Before you pay</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-700">
                Confirm these details with the supplier in MPX chat. Never pay to details sent by
                email alone, and treat any request to change them as a warning sign.
              </p>
            </div>
          </section>
        )}

        <p className="mt-6 border-t border-surface-border pt-4 text-[11.5px] leading-relaxed text-muted">
          Issued by the supplier through MPX Global. MPX Global is a marketplace and is not a party
          to this quotation or any resulting contract.
        </p>
      </article>

      <Modal
        open={declineOpen}
        onClose={() => setDeclineOpen(false)}
        title="Decline this quotation?"
        danger
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeclineOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={answer.isPending} onClick={() => { setError(null); answer.mutate(); }}>
              Decline
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-700">
          The supplier is told you declined. You can carry on in chat and ask for a revised
          quotation — declining does not close the conversation.
        </p>
        <label htmlFor="decline-reason" className="mt-4 block text-sm font-semibold text-ink-900">
          Reason <span className="font-normal text-muted">(optional, shown to the supplier)</span>
        </label>
        <textarea
          id="decline-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          className="mt-2 w-full rounded-lg border border-surface-border p-3 text-sm"
        />
      </Modal>
    </PortalLayout>
  );
}
