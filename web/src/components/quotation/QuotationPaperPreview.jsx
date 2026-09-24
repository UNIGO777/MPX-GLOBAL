import { formatDate } from '../../lib/format.js';
import { isExpired, shippingStrip } from '../../lib/quotationPdf.js';
import { Logo } from '../ui/Logo.jsx';

/**
 * The first page of the quotation PDF, drawn in HTML.
 *
 * 🔴 **Why not render the real PDF.** Rasterising page 1 means pdf.js (a new
 * dependency) or building the document with pdfmake — ~1 MB of library and fonts
 * — for every card in every thread, just to show a thumbnail. This draws the same
 * page from the same data at no cost, and the buyer still gets a real text PDF
 * when they press download.
 *
 * 🔴 **It must not drift from the file.** Everything here comes from the SERVER'S
 * frozen snapshot — the same object `quotationPdf.js` prints — and the shipping
 * strip is built by that module's own `shippingStrip`, so "which terms appear and
 * in what order" has one definition. A preview that quietly differs from the
 * document is worse than no preview: it shows someone a page they will not
 * receive.
 *
 * 🔴 **The `paper-*` tokens are the DOCUMENT's palette, not the UI's** (see
 * tailwind.config.js). That is the whole point — this is a picture of a printed
 * page, so it carries the page's navy and ivory rather than the interface's red.
 *
 * `aria-hidden`: every fact on it is stated in text beside the card, so a screen
 * reader gains nothing from a second pass through a miniature page.
 */
function Cell({ label, value }) {
  return (
    <div className="min-w-0 flex-1 px-1.5 py-1">
      <p className="truncate text-[5px] font-medium uppercase tracking-[0.08em] text-paper-muted">{label}</p>
      <p className="truncate text-[7px] font-bold text-paper-ink">{value || '—'}</p>
    </div>
  );
}

function Party({ title, party }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-[5px] font-medium uppercase tracking-[0.1em] text-paper-muted">{title}</p>
      <p className="truncate text-[8px] font-bold text-paper-ink">{party?.name || '—'}</p>
      <p className="truncate text-[6px] text-paper-muted">{party?.country || ''}</p>
    </div>
  );
}

export function QuotationPaperPreview({ quotation }) {
  const q = quotation;
  const strip = shippingStrip(q);
  const expired = isExpired(q);

  return (
    <div aria-hidden="true" className="relative bg-white">
      <div className="px-3 pt-3">
        {/* The masthead rule: navy band with a red leading segment, as printed. */}
        <div className="flex h-[3px] w-full overflow-hidden">
          <span className="w-[17%] bg-paper-accent" />
          <span className="flex-1 bg-paper-ink" />
        </div>

        <div className="mt-2 flex items-start justify-between gap-2">
          {/* The real mark, as the PDF prints it — one lockup, one source
              (`Logo`), never a typed imitation of it. `Logo` sets its height
              inline so the artwork can never stretch, which also means a
              className cannot resize it: the size comes from the prop. */}
          <Logo size="xs" />
          <div className="text-right">
            <p className="text-[11px] font-extrabold leading-none tracking-[0.14em] text-paper-ink">QUOTATION</p>
            <p className={`mt-[2px] text-[5.5px] font-bold ${expired ? 'text-paper-accent' : 'text-success-700'}`}>
              {expired ? 'Expired' : 'Valid until'} {formatDate(q.validUntil) || '—'}
            </p>
          </div>
        </div>

        {/* Meta — four cells in one ruled box, as the document draws it. */}
        <div className="mt-2 flex divide-x divide-paper-line rounded-[2px] border border-paper-line">
          <Cell label="Quote no." value={q.number} />
          <Cell label="Issue date" value={formatDate(q.issueDate)} />
          <Cell label="Revision" value={`R${q.revision ?? 1}`} />
          <Cell label="Currency" value={q.currency} />
        </div>

        <div className="mt-2 flex gap-3">
          <Party title="From · Supplier" party={q.supplier} />
          <Party title="To · Buyer" party={q.buyer} />
        </div>

        {strip.length > 0 && (
          <div className="mt-2 flex bg-paper-ivory">
            {strip.map(([label, value]) => (
              <Cell key={label} label={label} value={value} />
            ))}
          </div>
        )}

        {/* The table's head — the page continues past the fold, which is what
            the fade below says. */}
        <div className="mt-2 flex gap-1 border-t-[1.5px] border-paper-ink pt-1 text-[5px] font-medium uppercase tracking-[0.08em] text-paper-muted">
          <span className="w-3">#</span>
          <span className="flex-1">Description</span>
          <span className="w-8">HS code</span>
          <span className="w-6 text-right">Qty</span>
          <span className="w-8 text-right">Rate</span>
          <span className="w-9 text-right">Amount</span>
        </div>
        <div className="mt-1 border-t border-paper-rule pt-1">
          {(q.items ?? []).slice(0, 2).map((item, i) => (
            <div key={`${item.name}-${i}`} className="flex gap-1 py-[2px] text-[6px] text-paper-ink">
              <span className="w-3 text-paper-muted">{i + 1}</span>
              <span className="flex-1 truncate font-semibold">{item.name}</span>
              <span className="w-8 truncate">{item.hsCode || '—'}</span>
              <span className="w-6 text-right">{item.qty}</span>
              <span className="w-8" />
              <span className="w-9" />
            </div>
          ))}
        </div>
      </div>

      {/* The page runs on — a hard edge would read as the whole document. */}
      <div className="h-6 bg-gradient-to-b from-transparent to-white" />
    </div>
  );
}
