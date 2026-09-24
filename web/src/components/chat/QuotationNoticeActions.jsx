import { useQuery } from '@tanstack/react-query';

import { quotationsApi, quotationKeys } from '../../api/quotations.js';
import { QuotationActions } from '../quotation/QuotationActions.jsx';
import { QuotationFigure } from '../quotation/QuotationFigure.jsx';

/**
 * Accept / Negotiate under the newest counter-offer notice (owner, 2026-09-25:
 * "make accept and negotiate button in the last offer also").
 *
 * 🔴 The SAME `QuotationActions` the document card uses, and the same query key,
 * so the two can never disagree about whose turn it is or what the figure is —
 * and the second mount costs no request, because the card has already cached it.
 *
 * 🔴 It renders NOTHING until the quotation has loaded, and nothing if it cannot
 * be read. A notice that briefly shows the wrong buttons is worse than one that
 * shows them a moment later: the whole point of putting them here is that the
 * person answers what is actually on the table.
 */
export function QuotationNoticeActions({ quotationId, viewerSide }) {
  const q = useQuery({
    queryKey: quotationKeys.one(quotationId),
    queryFn: () => quotationsApi.get(quotationId),
    enabled: Boolean(quotationId),
  });

  if (!q.data) return null;

  return (
    <div className="mt-2.5 space-y-2.5 border-t border-ink-100 pt-2.5">
      {/* What is on the table, beside the offer that put it there — this is the
          ONE place it is shown once a negotiation has started (the document card
          drops it). */}
      <QuotationFigure quotation={q.data} />
      <QuotationActions quotation={q.data} viewerSide={viewerSide} size="sm" />
    </div>
  );
}
