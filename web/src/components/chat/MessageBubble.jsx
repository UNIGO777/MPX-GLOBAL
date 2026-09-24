import { useState } from 'react';

import { formatTime } from '../../lib/format.js';
import { Lightbox } from '../ui/Lightbox.jsx';
import { AlertIcon, CheckIcon, ClockIcon, DownloadIcon, QuoteIcon, ShieldIcon, SlashIcon } from '../ui/icons.jsx';
import { fileBadge, formatFileSize } from '../../lib/chatFiles.js';
import { WARNING_TONES } from './warningTones.js';
import { QuotationChatCard } from './QuotationChatCard.jsx';
import { QuotationNoticeActions } from './QuotationNoticeActions.jsx';

/**
 * D10 · a document in a bubble: badge, name, size — and, once sent, a DOWNLOAD
 * link. The url is the server's short-lived signed one with a forced
 * `attachment` disposition, so it saves to disk rather than opening inside our
 * tab. While the bubble is still uploading there is no link yet.
 */
function DocumentCard({ doc, own, compact }) {
  const hover = own ? 'hover:bg-white/20' : 'hover:bg-ink-100';
  /**
   * Save under the REAL name. The signed url is on Cloudinary's origin, where a
   * browser ignores the `download` attribute and Cloudinary names every raw
   * download "file.pdf" (verified 2026-09-24; its filename options either do
   * nothing or flip the disposition to inline). So fetch the bytes and save them
   * from a blob with our cleaned name. The blob is only ever SAVED, never shown
   * in the page. If the fetch fails, the plain link still downloads.
   */
  const save = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(doc.url);
      if (!res.ok) throw new Error(`download ${res.status}`);
      const blobUrl = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      // Not silent: the fallback IS the handling — the browser's own download
      // of the same signed url, just under Cloudinary's generic name.
      window.location.assign(doc.url);
    }
  };

  const info = (
    <>
      <span
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center rounded-lg bg-white font-bold tracking-wide text-primary-700 ${
          compact ? 'h-9 w-9 text-[9.5px]' : 'h-10 w-10 text-[10.5px]'
        } ${own ? '' : 'ring-1 ring-primary-100'}`}
      >
        {fileBadge(doc.format ?? doc.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{doc.name}</span>
        <span className={`block text-[11px] ${own ? 'text-white/75' : 'text-muted'}`}>
          {formatFileSize(doc.bytes)}
          {doc.viewUrl && ' · Click to open'}
        </span>
      </span>
    </>
  );
  const main = `flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 text-left transition-colors ${doc.url ? hover : ''}`;

  return (
    <div
      className={`mb-1.5 flex min-w-[220px] max-w-full items-center gap-1 rounded-xl p-1 ${
        own ? 'bg-white/15 text-white' : 'bg-ink-50 text-ink-900'
      }`}
    >
      {/* OPEN — a PDF opens in the browser's own viewer in a new tab, on
          Cloudinary's origin (see signedChatDocumentUrl). Word / Excel have no
          in-browser viewer, so for them the card itself downloads. */}
      {doc.viewUrl ? (
        <a href={doc.viewUrl} target="_blank" rel="noopener noreferrer" className={main} aria-label={`Open ${doc.name}`}>
          {info}
        </a>
      ) : doc.url ? (
        <button type="button" onClick={save} className={main} aria-label={`Download ${doc.name}`}>
          {info}
        </button>
      ) : (
        <div className={main}>{info}</div>
      )}

      {doc.url && (
        <button
          type="button"
          onClick={save}
          title="Download"
          aria-label={`Download ${doc.name}`}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${hover} ${
            own ? 'text-white' : 'text-ink-600'
          }`}
        >
          <DownloadIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/**
 * One line in a thread.
 *
 * 🔒 M4-17/G2 — attribution is COMPANY-LEVEL, always. The server sends
 * `senderType` (`buyer` | `exporter` | `system`) and nothing else: no person's
 * name, no user id, no avatar of a human. A design that needs one cannot be
 * built, because the data does not exist.
 *
 * M4-13 — sent messages can never be edited or deleted, by anyone. So there are
 * no hover actions here beyond selecting text.
 *
 * 🚫 NO DELIVERY OR READ TICKS. Messaging apps put ✓✓ under a bubble; we do not
 * have that data and must not imply it. Unread is a per-THREAD boolean derived
 * from two timestamps (§7.5) — there is no per-message delivered/seen state on
 * the server, so a tick here would be decoration pretending to be a receipt.
 * The only status shown is the sender's own "Sending…" while a send is in
 * flight, and "Not sent" when it failed.
 *
 * ✳️ The `kind` dispatch is a deliberate SEAM. Every message today is plain
 * text; Phase 2's quotation work will want a card-shaped line in this same
 * timeline, and routing through one dispatch means that lands as a new branch
 * rather than a rewrite. No unused branch ships.
 */

/**
 * Per-party name colours. A thread has exactly two companies, and in the staff
 * viewer BOTH are labelled — identical grey names made buyer and seller
 * impossible to tell apart at a glance, which is the one thing that screen is
 * for. Blue for the buying side, amber for the selling side: distinct in hue
 * AND in lightness, so they survive greyscale and colour-blindness.
 */
const SENDER_TONE = {
  buyer: 'text-primary-700',
  exporter: 'text-warning-700',
};

/**
 * What each platform notice looks like, keyed on the server's `systemKind`.
 *
 * 🔴 M4-19 — the LABEL changes with the colour, never the colour alone. "Blocked"
 * and "Reopened" are legible in greyscale, to a colour-blind reader, and to a
 * screen reader; the tint only makes the scan faster.
 *
 * ⚠️ Notices sent before 2026-08-18 carry no kind, and never will — messages are
 * append-only (M4-13), so there is no backfill. `DEFAULT` is what they render as,
 * and it must stay a sensible neutral rather than a placeholder.
 */
/*
 * 2026-09-24 redesign — a SEVERITY LADDER, readable before a word is:
 *   white card + coloured edge → information (welcome, reopened, restored)
 *   tinted card                → a warning (warningTones.js)
 *   SOLID card                 → the conversation is blocked
 * Information used to be tinted pink/green like everything else, so a thread
 * full of notices read as one wall of colour.
 */
// The WELCOME keeps its warm brand tint (owner, 2026-09-24: "should be same as
// before") — it is the platform introducing itself, the one notice meant to be
// noticed on arrival. Also the look of untagged pre-2026-08-18 notices, most of
// which are welcomes.
const NOTICE_DEFAULT = {
  label: 'Platform notice',
  Icon: ShieldIcon,
  bar: 'bg-primary-600',
  wrap: 'from-primary-100 to-primary-50/30 ring-primary-200/60',
  head: 'text-primary-700',
  dot: 'text-primary-300',
};

/**
 * Module 4 (month 2) — quotation notices. INFORMATION on the ladder above: a
 * white card with a coloured edge, not a tint. A quotation moving is a fact
 * about the deal, not a warning about the conversation, and tinting it would
 * put it on the same footing as "Product under review".
 *
 * The notice carries the NUMBER only. The document itself is opened from the
 * strip above the composer — a price repeated into the timeline is a second
 * copy that can end up disagreeing with the quotation.
 */
const QUOTATION_NOTICE = {
  label: 'Quotation',
  Icon: QuoteIcon,
  bar: 'bg-ink-900',
  wrap: 'from-white to-white ring-ink-200/80 shadow-[0_1px_2px_rgba(0,5,23,0.04)]',
  head: 'text-ink-900',
  dot: 'text-ink-300',
};

const NOTICE_KINDS = {
  welcome: NOTICE_DEFAULT,
  quotation_sent: QUOTATION_NOTICE,
  quotation_accepted: {
    ...QUOTATION_NOTICE,
    label: 'Quotation accepted',
    Icon: CheckIcon,
    bar: 'bg-success-500',
    head: 'text-success-700',
  },
  // A counter-offer is movement, not a problem — same white card, and the copy
  // carries the figure (an offer has no document of its own to disagree with).
  quotation_offer: { ...QUOTATION_NOTICE, label: 'Counter-offer' },
  // Half-accepted is its own state and has to read as one: neither "sent" nor
  // "accepted", and waiting on a named party.
  quotation_accept_pending: {
    ...QUOTATION_NOTICE,
    label: 'Acceptance confirmed by one side',
    Icon: ClockIcon,
    bar: 'bg-warning-500',
    head: 'text-warning-700',
  },
  quotation_declined: { ...QUOTATION_NOTICE, label: 'Quotation declined', bar: 'bg-danger-500', head: 'text-danger-700' },
  quotation_withdrawn: { ...QUOTATION_NOTICE, label: 'Quotation withdrawn' },
  // 🔴 The ONE filled notice (owner, 2026-09-24: after the crimson rebrand a
  // pale-maroon "blocked" was indistinguishable from the pale "Final warning").
  // A closed conversation is the strongest thing the platform says, so it is
  // the only notice drawn solid — white on maroon, readable at a glance.
  blocked: {
    label: 'Conversation blocked',
    Icon: SlashIcon,
    bar: 'bg-danger-900',
    wrap: 'from-danger-600 to-danger-500 ring-danger-700',
    head: 'text-white',
    dot: 'text-white/50',
    body: 'text-white',
  },
  unblocked: {
    label: 'Conversation reopened',
    Icon: CheckIcon,
    bar: 'bg-success-500',
    wrap: 'from-white to-white ring-ink-200/80 shadow-[0_1px_2px_rgba(0,5,23,0.04)]',
    head: 'text-success-700',
    dot: 'text-ink-300',
  },
  // Step 1d: staff connected the buyer's "find me a supplier" request here —
  // information, so a white card with a brand edge.
  routed: {
    label: 'Connected by MPX Global',
    Icon: ShieldIcon,
    bar: 'bg-primary-600',
    wrap: 'from-white to-white ring-ink-200/80 shadow-[0_1px_2px_rgba(0,5,23,0.04)]',
    head: 'text-primary-700',
    dot: 'text-ink-300',
  },
  product_takedown: {
    label: 'Product under review',
    Icon: AlertIcon,
    bar: 'bg-warning-500',
    wrap: 'from-warning-50 to-warning-50/20 ring-warning-200/60',
    head: 'text-warning-700',
    dot: 'text-warning-300',
  },
  product_restored: {
    label: 'Product available again',
    Icon: CheckIcon,
    bar: 'bg-success-500',
    wrap: 'from-white to-white ring-ink-200/80 shadow-[0_1px_2px_rgba(0,5,23,0.04)]',
    head: 'text-success-700',
    dot: 'text-ink-300',
  },
  // Neutral on purpose. The server withholds a freeze chip for the account
  // cascade so neither party is told anything about the other's account status
  // (F1-B); a red band here would say it in colour instead.
  account_paused: {
    label: 'Conversation paused',
    Icon: ShieldIcon,
    bar: 'bg-ink-300',
    wrap: 'from-ink-100 to-ink-50/30 ring-surface-border',
    head: 'text-ink-600',
    dot: 'text-ink-300',
  },
  account_restored: {
    label: 'Conversation resumed',
    Icon: CheckIcon,
    bar: 'bg-success-500',
    wrap: 'from-white to-white ring-ink-200/80 shadow-[0_1px_2px_rgba(0,5,23,0.04)]',
    head: 'text-success-700',
    dot: 'text-ink-300',
  },
  // Platform warnings, toned by nature (2026-09-24). `warning` alone is the
  // first day's kind (all amber) — kept so those notices still render.
  warning_reminder: WARNING_TONES.reminder,
  warning_caution: WARNING_TONES.caution,
  warning_serious: WARNING_TONES.serious,
  warning_final: WARNING_TONES.final,
  warning: {
    label: 'Platform warning',
    Icon: AlertIcon,
    bar: 'bg-warning-500',
    wrap: 'from-warning-50 to-warning-50/20 ring-warning-200/60',
    head: 'text-warning-700',
    dot: 'text-warning-300',
  },
};

/**
 * The number the server wrote into a quotation notice.
 *
 * 🔴 This exists for notices posted BEFORE `Message.quotationId` did (2026-09-25).
 * Messages are append-only (M4-13), so those can never be backfilled — and
 * without this every quotation sent before that day would keep rendering as a
 * line of text forever. The number in the copy is the only handle they have.
 */
const NUMBER_IN_BODY = /MPX-Q-\d{4}-\d{6}/;

/** The platform's own voice — never a chat bubble that could read as a party. */
function NoticeBand({ message, compact, children }) {
  const kind = NOTICE_KINDS[message.systemKind] ?? NOTICE_DEFAULT;
  const { Icon } = kind;

  return (
    // 🔴 An ANNOUNCEMENT, not a message — and the shape has to say so before a
    // word is read. Two earlier attempts failed for the same reason: they were
    // still a BOX floating on the canvas. A rounded card with a sender name and
    // a right-aligned time is a bubble; an inset box on a dashed rule is an
    // upload dropzone. Both are content sitting IN the stream.
    //
    // So stop drawing a box. Every message in this thread is inset from the
    // edges and rounded; a band that runs edge to edge with square corners
    // belongs to the CONTAINER instead — it is the one shape a message can
    // never take. It is also the app's existing voice for this: the takedown
    // strip above the composer is the same full-width tinted band, so the
    // platform now looks the same wherever it speaks.
    //
    // The segmentation is the point, not a side effect. A restriction really
    // does cut the thread into a before and an after, and the band draws that
    // line across the transcript.
    //
    // No name label: the server copy already says "by MPX Global" (M4-17 — the
    // platform, never a person), so a header would repeat it.
    <>
      {/* 🔴 Four attempts sit behind this block; the notes are here so the fifth
          person does not repeat them.
            · white card + sender name + time top-right  → read as a MESSAGE
            · inset box on a dashed rule                 → read as an UPLOAD zone
            · full-bleed tinted band                     → visually heavy, ugly
            · no container at all                        → read as stray text
          What it needs is a container — just not a bubble-shaped one. This is
          notice vocabulary instead, and every part of it is a thing a chat
          bubble never has: a solid accent bar down the leading edge, a tinted
          (not white) fill, a flat surface with no elevation, and an uppercase
          tracked label. Signage, not speech.
          The time rides in the label row after a middot — a timestamp parked in
          its own corner is the bubble tell that started all this. */}
      {/* The fill fades out away from the accent: anchored where the bar is,
          dissolving into the canvas at the far edge. A flat rectangle of tint
          read as a slab dropped on the thread; this sits IN it. */}
      <div
        className={`relative w-full overflow-hidden rounded-xl bg-gradient-to-r ring-1 ring-inset ${
          compact ? 'max-w-full py-1.5 pl-3 pr-2.5' : 'max-w-[28rem] py-2.5 pl-[1.125rem] pr-4'
        } ${kind.wrap}`}
      >
        <span className={`absolute inset-y-0 left-0 w-[3px] ${kind.bar}`} aria-hidden="true" />

        <div className={`flex items-center gap-1.5 ${kind.head}`}>
          <Icon
            className={`shrink-0 ${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'}`}
            aria-hidden="true"
          />
          {/* M4-17 — the platform, never a person. A category, not a name: a
              name in this position is exactly what made it look like a sender. */}
          <span
            className={`font-bold uppercase tracking-[0.14em] ${compact ? 'text-[9px]' : 'text-[10px]'}`}
          >
            {kind.label}
          </span>
          <span aria-hidden="true" className={kind.dot}>·</span>
          <time
            className={`font-semibold tabular-nums ${compact ? 'text-[9px]' : 'text-[10px]'}`}
            dateTime={message.createdAt}
          >
            {formatTime(message.createdAt)}
          </time>
        </div>

        <p
          className={`mt-0.5 whitespace-pre-wrap leading-snug ${kind.body ?? 'text-ink-800'} ${
            compact ? 'text-[11px]' : 'text-[13px]'
          }`}
        >
          {message.body}
        </p>

        {children}
      </div>
    </>
  );
}

/**
 * 🔴 A quotation arrives as a DOCUMENT CARD, not a line of text (owner,
 * 2026-09-25). It REPLACES the notice rather than sitting under it: two
 * renderings of the same event is how one of them ends up stale.
 *
 * The card resolves the quotation two ways — by `quotationId` on notices written
 * since 2026-09-25, and by the number in the copy for every notice written
 * before it (see NUMBER_IN_BODY). If neither resolves, it renders the plain band
 * instead, so a message can never vanish from a transcript.
 *
 * Staff keep the plain band — a quotation is two-party scoped, so a moderator's
 * fetch would 404, and that is the intended boundary, not a gap.
 */
const ACTIONABLE_QUOTATION_KINDS = ['quotation_offer', 'quotation_accept_pending'];

function SystemNotice({ message, compact, viewerSide, conversationId, latestQuotationNotice }) {
  /**
   * 🔴 The buttons repeat on the LATEST counter-offer notice (owner,
   * 2026-09-25). The card carries them, but after a round of offers the card is
   * scrolled far above and the thing a person is looking at — "they offered
   * ₹5,00,000" — had nothing to press. The answer belongs next to the offer.
   *
   * Only the LATEST one, and only the kinds that leave something to do. Buttons
   * on every historical offer would be four ways to answer one question, three
   * of them about a figure nobody is offering any more.
   */
  const actionable =
    latestQuotationNotice &&
    viewerSide !== 'staff' &&
    message.quotationId &&
    ACTIONABLE_QUOTATION_KINDS.includes(message.systemKind);

  const band = (
    <NoticeBand message={message} compact={compact}>
      {actionable && (
        <QuotationNoticeActions quotationId={message.quotationId} viewerSide={viewerSide} />
      )}
    </NoticeBand>
  );
  const isQuotation = message.systemKind === 'quotation_sent' && viewerSide !== 'staff';
  const number = isQuotation ? (message.body?.match(NUMBER_IN_BODY)?.[0] ?? null) : null;

  /**
   * 🔴 Aligned like a MESSAGE, not centred like a notice — right for the side
   * that sent it, left for the side receiving it (owner, 2026-09-25).
   *
   * This does not contradict the "signage, not speech" rule the band above is
   * built on. That rule exists so the PLATFORM never reads as a third sender. A
   * quotation is not the platform talking: it is a document one company sent the
   * other, so it belongs on that company's side of the thread exactly as its
   * messages do.
   *
   * The sender is always the EXPORTER — `send()` refuses any other side — so the
   * viewer's own side is all this needs. The system message itself carries no
   * sender, by design (M4-17).
   */
  if (isQuotation && (message.quotationId || number)) {
    return (
      <li className={`my-4 flex px-3 ${viewerSide === 'exporter' ? 'justify-end' : 'justify-start'}`}>
        <QuotationChatCard
          quotationId={message.quotationId}
          quotationNumber={number}
          conversationId={conversationId}
          viewerSide={viewerSide}
          createdAt={message.createdAt}
          fallback={band}
        />
      </li>
    );
  }

  return <li className="my-5 flex justify-center px-3">{band}</li>;
}

function PartyMessage({ message, align, tone, senderName, senderType, pending, failed, onRetry, startsGroup, compact }) {
  const [zoomed, setZoomed] = useState(false);
  // D10 · a sent document, or one still uploading (the File rides on the
  // pending bubble; an image has a previewUrl, a document does not).
  const doc =
    message.attachment?.kind === 'document'
      ? message.attachment
      : message.file && !message.previewUrl
        ? { name: message.file.name, bytes: message.file.size, format: null, url: null }
        : null;
  const timeText = pending ? 'Sending' : formatTime(message.createdAt);
  /* ONE source for the clock's size. The invisible spacer that reserves room for
     it on the last line must measure the same text, or a short message runs into
     its own timestamp — that bug was fixed once already today. */
  const timeSize = compact ? 'text-[9.5px]' : 'text-[10px]';
  const right = align === 'right';
  const own = tone === 'own';

  return (
    <li className={`flex px-4 ${right ? 'justify-end' : 'justify-start'} ${startsGroup ? 'mt-4' : 'mt-1'}`}>
      <div className={`flex max-w-[88%] flex-col sm:max-w-[min(68%,34rem)] ${right ? 'items-end' : 'items-start'}`}>
        <div
          className={[
            'relative rounded-[18px]',
            compact
              ? 'px-3 pb-1 pt-1.5 text-[12.5px] leading-[1.4]'
              : 'px-3.5 pb-1.5 pt-2 text-[14px] leading-[1.45]',
            // 🔴 No 1px border on the counterparty's bubble. On the tinted
            // canvas a white card separates by ELEVATION, and a border made the
            // thread look like a stack of form fields. The own-side bubble gets
            // a soft vertical gradient so a long block of accent has depth
            // instead of reading as one flat slab of brand red.
            // 2026-09-24: own = the DEEPER brand red, flat — the bright
            // primary-600 gradient turned a thread into a column of loud red
            // blocks. The other side: white with a hairline ring now that the
            // canvas is neutral grey (on the old pink it separated by shadow).
            own
              ? 'bg-primary-700 text-white shadow-[0_1px_2px_rgba(102,2,12,0.22)]'
              : 'bg-white text-ink-900 shadow-[0_1px_2px_rgba(0,5,23,0.06)] ring-1 ring-inset ring-ink-200/70',
            // The outer corner is squared on the FIRST bubble of a run, where
            // the tail attaches.
            right
              ? startsGroup ? 'rounded-tr-sm' : ''
              : startsGroup ? 'rounded-tl-sm' : '',
            pending ? 'opacity-80' : '',
          ].join(' ')}
        >
          {/* The tail — drawn only on the first bubble of a run, so a burst of
              messages reads as ONE turn with a single point of origin rather
              than as several unrelated cards. */}
          {startsGroup && (
            <span
              aria-hidden="true"
              className={`absolute top-0 h-3 w-2.5 ${
                right ? `-right-[9px] ${own ? 'bg-primary-700' : 'bg-white'}` : '-left-[9px] bg-white'
              }`}
              style={{
                clipPath: right ? 'polygon(0 0, 100% 0, 0 100%)' : 'polygon(0 0, 100% 0, 100% 100%)',
              }}
            />
          )}

          {/* The sender's COMPANY, inside the bubble and in its own colour —
              once per run, never on your own messages. */}
          {!own && startsGroup && senderName && (
            <p
              className={`font-bold leading-tight ${compact ? 'text-[10.5px]' : 'text-[12px]'} ${
                SENDER_TONE[senderType] ?? 'text-primary-700'
              }`}
            >
              {senderName}
            </p>
          )}

          {/* 🔴 The timestamp FLOWS WITH THE TEXT rather than sitting on a
              reserved row beneath it: an invisible copy is appended inline to
              reserve exactly its width on the last line, and the real one is
              positioned over that gap. A one-line message therefore grows
              sideways and stays one line tall. */}
          {/* D9 · the image, above its line of text (2026-09-23) — the text may
              be empty since 2026-09-24.
              `previewUrl` is the local blob shown while an optimistic bubble
              uploads; `attachment.url` is the server's SHORT-LIVED SIGNED url,
              minted per read. Width/height come from the server so the bubble
              reserves the right box and the thread does not jump as each image
              loads. */}
          {doc && <DocumentCard doc={doc} own={own} compact={compact} />}

          {!doc && (message.previewUrl || message.attachment?.url) && (
            <>
              {/* 🔴 A modal, not `target="_blank"` (owner, 2026-09-23). A new tab
                  was also the wrong place for THIS image specifically: the
                  server's url is a short-lived signed one, so a tab left open
                  would show a dead link minutes later, and the url itself would
                  sit in the browser's history. The lightbox keeps it on the page
                  and inside its lifetime.
                  The component is the one the product gallery uses — shared on
                  the same day rather than copied, so the focus trap, Escape,
                  scroll lock and the portal fix apply here too. */}
              <button
                type="button"
                onClick={() => setZoomed(true)}
                aria-label="View image full size"
                className="mb-1.5 block overflow-hidden rounded-xl"
              >
                <img
                  src={message.previewUrl ?? message.attachment.url}
                  alt=""
                  width={message.attachment?.width ?? undefined}
                  height={message.attachment?.height ?? undefined}
                  loading="lazy"
                  className={`max-h-72 w-auto max-w-full rounded-xl object-cover ${
                    message.pending ? 'opacity-60' : ''
                  }`}
                />
              </button>
              {zoomed && (
                <Lightbox
                  images={[message.attachment?.url ?? message.previewUrl]}
                  active={0}
                  name="Shared image"
                  onNavigate={() => {}}
                  onClose={() => setZoomed(false)}
                />
              )}
            </>
          )}

          <p className="whitespace-pre-wrap break-words">
            {message.body}
            {/* 🔴 `tabular-nums` MUST match the real timestamp below. Without it
                this spacer measured PROPORTIONAL digits while the visible clock
                rendered TABULAR ones — which are wider — so the reservation came
                up a few pixels short and a short message ("jj") ran straight into
                its own time. Any class that changes this text's metrics has to be
                changed in both places. */}
            <span
              aria-hidden="true"
              className={`invisible ml-2 inline-block select-none leading-none tabular-nums ${timeSize}`}
            >
              {timeText}
            </span>
          </p>

          <span
            className={`pointer-events-none absolute bottom-0.5 tabular-nums ${timeSize} ${
              compact ? 'right-2' : 'right-2.5'
            } ${own ? 'text-white/75' : 'text-ink-400'}`}
          >
            <time dateTime={message.createdAt}>{timeText}</time>
          </span>
        </div>

        {/* A failed send is reported ON the message — never a toast that floats
            away from the words the sender lost. */}
        {failed && (
          <span className="mt-1 inline-flex items-center gap-1.5 px-1 text-[11px] font-semibold text-danger">
            <AlertIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Not sent
            <button
              type="button"
              onClick={onRetry}
              className="rounded underline underline-offset-2 hover:text-danger-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-300"
            >
              Retry
            </button>
          </span>
        )}
      </div>
    </li>
  );
}

export function MessageBubble({
  message,
  viewerSide,
  counterpartyName,
  conversationId,
  latestQuotationNotice = false,
  onRetry,
  startsGroup = true,
  compact = false,
}) {
  if (message.senderType === 'system') {
    return (
      <SystemNotice
        message={message}
        compact={compact}
        viewerSide={viewerSide}
        conversationId={conversationId}
        latestQuotationNotice={latestQuotationNotice}
      />
    );
  }

  /**
   * 🔴 A MODERATOR is neither party (M4-2), so nothing is painted as "mine" in
   * the staff viewer — but the two companies still sit on OPPOSITE SIDES.
   * Left-aligning everything turned a negotiation into an undifferentiated
   * column and made the transcript unreadable as an exchange, which is the one
   * thing that screen exists for. Buyer left, seller right, both neutral, told
   * apart by the coloured company name inside the bubble.
   */
  const staff = viewerSide === 'staff';
  const own = !staff && message.senderType === viewerSide;
  const align = staff ? (message.senderType === 'exporter' ? 'right' : 'left') : own ? 'right' : 'left';

  return (
    <PartyMessage
      message={message}
      align={align}
      tone={own ? 'own' : 'other'}
      // The company name inside the bubble is for the STAFF viewer, where two
      // companies share one transcript. In a party's own 1:1 thread the header
      // already names the counterparty, so repeating it on every run was noise
      // (2026-09-24 redesign).
      senderName={staff ? counterpartyName : null}
      senderType={message.senderType}
      pending={message.pending}
      failed={message.failed}
      onRetry={onRetry}
      startsGroup={startsGroup}
      compact={compact}
    />
  );
}
