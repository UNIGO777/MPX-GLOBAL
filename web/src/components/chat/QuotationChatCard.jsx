import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { quotationsApi, quotationKeys } from '../../api/quotations.js';
import { formatTime } from '../../lib/format.js';
import { downloadQuotationPdf } from '../../lib/quotationPdf.js';
import { QuotationActions } from '../quotation/QuotationActions.jsx';
import { QuotationFigure } from '../quotation/QuotationFigure.jsx';
import { QuotationPaperPreview } from '../quotation/QuotationPaperPreview.jsx';
import { Skeleton } from '../ui/Skeleton.jsx';
import { DownloadIcon } from '../ui/icons.jsx';

/**
 * The quotation IN the thread, as a document card (owner, 2026-09-25).
 *
 * 🔴 It renders the quotation LIVE, not the notice it hangs off. A `quotation_sent`
 * message is a fact about a moment; the card has to say what the deal is NOW —
 * negotiating, half-confirmed, accepted — or a buyer scrolls back to buttons for
 * a deal that closed yesterday. That is why the notice carries only an id.
 *
 * 🔴 It opens with a PREVIEW OF THE PAGE (owner, 2026-09-25 — the reference was a
 * WhatsApp document card). Drawn in HTML from the same frozen snapshot the PDF
 * prints from, so it costs nothing and cannot disagree with the file; see
 * QuotationPaperPreview. The real PDF is built on demand by the same builder the
 * document page uses (lib/quotationPdf.js).
 *
 * 🔴 The figure sits here ONLY until the first counter-offer (owner,
 * 2026-09-25). After that it lives on the newest offer notice instead, because
 * it changes with every offer — and a copy of it left up here would be a stale
 * number sitting in the transcript, which is how two companies end up quoting
 * each other different totals. See QuotationFigure.
 *
 * ⚠️ Parties only. Staff monitoring a thread see the plain notice: quotations are
 * two-party scoped on the server, so a moderator's fetch is a 404 by design.
 */
export function QuotationChatCard({
  quotationId,
  quotationNumber,
  conversationId,
  viewerSide,
  createdAt,
  fallback = null,
}) {
  const [downloading, setDownloading] = useState(false);
  const [failed, setFailed] = useState(false);

  /**
   * 🔴 Notices written before `Message.quotationId` existed (2026-09-25) carry
   * only the number, and messages are append-only so they can never be
   * backfilled. For those, the thread's own quotation list resolves it. The list
   * is the SERVER's, two-party scoped like everything else, so this can only
   * ever find a quotation this viewer is already entitled to.
   */
  const list = useQuery({
    queryKey: quotationKeys.forConversation(conversationId),
    queryFn: () => quotationsApi.forConversation(conversationId),
    enabled: !quotationId && Boolean(conversationId) && Boolean(quotationNumber),
  });

  const id = quotationId ?? list.data?.find((row) => row.number === quotationNumber)?.id ?? null;

  const q = useQuery({
    queryKey: quotationKeys.one(id),
    queryFn: () => quotationsApi.get(id),
    enabled: Boolean(id),
  });

  if (!quotationId && list.isPending) {
    return <Skeleton className="h-40 w-full max-w-[22rem] rounded-2xl" />;
  }
  if (id && q.isPending) return <Skeleton className="h-40 w-full max-w-[22rem] rounded-2xl" />;
  /**
   * Unresolvable — an old notice whose quotation is gone, or a read this viewer
   * is not entitled to. The plain notice band is rendered instead: a message
   * must never disappear from a transcript because a card could not be built.
   */
  if (!id || q.isError || !q.data) return fallback;

  const d = q.data;
  // From the first counter-offer on, the live figure belongs to the newest offer
  // notice and nowhere else.
  const negotiating = (d.offers?.length ?? 0) > 0;

  const save = async () => {
    setFailed(false);
    setDownloading(true);
    try {
      await downloadQuotationPdf(d);
    } catch {
      // Never a silent no-op: a download that does nothing reads as a broken
      // document rather than a failed build.
      setFailed(true);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="w-full max-w-[22rem] overflow-hidden rounded-2xl border border-surface-border bg-white shadow-[0_1px_3px_rgba(0,5,23,0.06)]">
      {/* The page itself — the whole point of the card. It opens the document,
          which is what a person expects from a page they can see. */}
      <Link to={`/quotations/${d.id}`} className="block" aria-label={`Open quotation ${d.number}`}>
        <QuotationPaperPreview quotation={d} />
      </Link>

      {/* The file row, over the page, as a document card reads.
          🔴 The band is INK, not the reference's green: green means VERIFIED
          across this product (web-design.md), and a green chrome around every
          quotation would spend that signal on a file attachment. */}
      <div className="flex items-center gap-3 bg-ink-900 px-3 py-2.5">
        <span
          aria-hidden="true"
          className="flex h-10 w-9 shrink-0 items-center justify-center rounded-md bg-primary-600 text-[9px] font-bold tracking-wide text-white"
        >
          PDF
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-white">{d.number}.pdf</span>
          <span className="block text-[11px] text-white/70">
            {/* What we actually know. The page count and byte size would mean
                building the ~1 MB PDF for every card just to measure it. */}
            {d.items?.length ?? 0} item{(d.items?.length ?? 0) === 1 ? '' : 's'} · PDF
            {createdAt && ` · ${formatTime(createdAt)}`}
          </span>
        </span>
        <button
          type="button"
          onClick={save}
          disabled={downloading}
          title="Download PDF"
          aria-label={`Download ${d.number} as PDF`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/15 hover:text-white disabled:opacity-50"
        >
          <DownloadIcon className="h-4 w-4" />
        </button>
      </div>

      {failed && (
        <p className="bg-danger-50 px-3 py-1.5 text-[11.5px] text-danger-700" role="alert">
          Could not build the PDF. Open the quotation and try from there.
        </p>
      )}

      {!negotiating && (
        <QuotationFigure
          quotation={d}
          className="border-t border-surface-border bg-surface-subtle px-3 py-2.5"
        />
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-surface-border px-3 py-2.5">
        <Link
          to={`/quotations/${d.id}`}
          className="text-[12.5px] font-semibold text-primary-700 hover:underline"
        >
          Open document
        </Link>
        <span className="flex-1" />
        {/* The buttons STAY here even while negotiating, unlike the figure.
            The newest offer notice can be pushed out of the loaded page by a
            long conversation, and leaving no way to answer anywhere would be a
            worse failure than showing two identical buttons. Both modals state
            the amount before anything is committed, so neither is a blind
            action. */}
        <QuotationActions quotation={d} viewerSide={viewerSide} size="sm" />
      </div>
    </div>
  );
}
