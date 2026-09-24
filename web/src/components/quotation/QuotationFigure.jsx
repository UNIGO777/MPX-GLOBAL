import { formatMinor } from '../../lib/money.js';

/**
 * What is on the table, and where the quotation stands.
 *
 * 🔴 ONE renderer, used in exactly one place at a time (owner, 2026-09-25).
 * Before any counter-offer it sits on the document card, because the card IS the
 * offer. From the first counter-offer on it moves to the newest offer notice and
 * disappears from the card — the live figure changes with every offer, and a
 * second copy of it further up the thread is a stale number sitting in a
 * transcript, which is exactly how two companies end up quoting each other
 * different totals.
 *
 * 🔴 Colour is never the only signal: the status is spelled out beside the
 * figure, not implied by the chip's tint (`web-design.md`).
 */
const STATUS = {
  sent: { label: 'Awaiting an answer', className: 'bg-ink-100 text-ink-700' },
  negotiating: { label: 'Negotiating', className: 'bg-warning-50 text-warning-700 ring-1 ring-warning-200' },
  accepted: { label: 'Accepted', className: 'bg-success-50 text-success-700 ring-1 ring-success-200' },
  declined: { label: 'Declined', className: 'bg-danger-50 text-danger-700 ring-1 ring-danger-200' },
  expired: { label: 'Expired', className: 'bg-ink-100 text-ink-600' },
  withdrawn: { label: 'Withdrawn', className: 'bg-ink-100 text-ink-600' },
};

export function QuotationFigure({ quotation, className = '' }) {
  const q = quotation;
  const status = STATUS[q.status] ?? STATUS.sent;
  const figure = q.currentFigureMinor ?? q.totalMinor;
  // The printed total is only worth repeating once it is NOT the live figure.
  const negotiated = q.offers?.length > 0 && figure !== q.totalMinor;

  return (
    <div className={`flex items-end justify-between gap-3 ${className}`}>
      <span>
        <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted">
          {negotiated ? 'On the table' : 'Total'}
        </span>
        <span className="block font-serif text-lg leading-tight text-ink-900">
          {formatMinor(figure, q.currency)}
        </span>
        {negotiated && (
          <span className="block text-[11px] text-muted">Quoted {formatMinor(q.totalMinor, q.currency)}</span>
        )}
      </span>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>
        {status.label}
      </span>
    </div>
  );
}
