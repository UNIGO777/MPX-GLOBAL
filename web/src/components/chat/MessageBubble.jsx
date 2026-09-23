import { useState } from 'react';

import { formatTime } from '../../lib/format.js';
import { Lightbox } from '../ui/Lightbox.jsx';
import { AlertIcon, CheckIcon, DownloadIcon, ShieldIcon, SlashIcon } from '../ui/icons.jsx';
import { fileBadge, formatFileSize } from '../../lib/chatFiles.js';

/**
 * D10 · a document in a bubble: badge, name, size — and, once sent, a DOWNLOAD
 * link. The url is the server's short-lived signed one with a forced
 * `attachment` disposition, so it saves to disk rather than opening inside our
 * tab. While the bubble is still uploading there is no link yet.
 */
function DocumentCard({ doc, own, compact }) {
  const tone = own
    ? 'bg-white/15 text-white hover:bg-white/25'
    : 'bg-ink-50 text-ink-900 hover:bg-ink-100';
  const inner = (
    <>
      <span
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center rounded-lg font-bold tracking-wide ${
          compact ? 'h-9 w-9 text-[9.5px]' : 'h-10 w-10 text-[10.5px]'
        } ${own ? 'bg-white text-primary-700' : 'bg-white text-primary-700 ring-1 ring-primary-100'}`}
      >
        {fileBadge(doc.format ?? doc.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{doc.name}</span>
        <span className={`block text-[11px] ${own ? 'text-white/75' : 'text-muted'}`}>
          {formatFileSize(doc.bytes)}
        </span>
      </span>
      {doc.url && <DownloadIcon className="h-4 w-4 shrink-0 opacity-80" />}
    </>
  );
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
  const cls = `mb-1.5 flex min-w-[200px] max-w-full items-center gap-2.5 rounded-xl p-2 transition-colors ${tone}`;
  return doc.url ? (
    <a
      href={doc.url}
      download={doc.name}
      onClick={save}
      rel="noopener noreferrer"
      className={cls}
      aria-label={`Download ${doc.name}`}
    >
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
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
const NOTICE_DEFAULT = {
  label: 'Platform notice',
  Icon: ShieldIcon,
  bar: 'bg-primary-600',
  wrap: 'from-primary-100 to-primary-50/30 ring-primary-200/60',
  head: 'text-primary-700',
  dot: 'text-primary-300',
};

const NOTICE_KINDS = {
  welcome: NOTICE_DEFAULT,
  blocked: {
    label: 'Conversation blocked',
    Icon: SlashIcon,
    bar: 'bg-danger-500',
    wrap: 'from-danger-50 to-danger-50/20 ring-danger-200/60',
    head: 'text-danger-700',
    dot: 'text-danger-300',
  },
  unblocked: {
    label: 'Conversation reopened',
    Icon: CheckIcon,
    bar: 'bg-success-500',
    wrap: 'from-success-50 to-success-50/20 ring-success-200/60',
    head: 'text-success-700',
    dot: 'text-success-300',
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
    wrap: 'from-success-50 to-success-50/20 ring-success-200/60',
    head: 'text-success-700',
    dot: 'text-success-300',
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
    wrap: 'from-success-50 to-success-50/20 ring-success-200/60',
    head: 'text-success-700',
    dot: 'text-success-300',
  },
};

/** The platform's own voice — never a chat bubble that could read as a party. */
function SystemNotice({ message, compact }) {
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
    <li className="my-4 flex justify-center px-3">
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
        className={`relative w-full overflow-hidden rounded-lg bg-gradient-to-r ring-1 ring-inset ${
          compact ? 'max-w-full py-1 pl-2.5 pr-2' : 'max-w-[30rem] py-2 pl-[1.125rem] pr-4'
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
          className={`mt-0.5 whitespace-pre-wrap leading-snug text-ink-800 ${
            compact ? 'text-[11px]' : 'text-[13px]'
          }`}
        >
          {message.body}
        </p>
      </div>
    </li>
  );
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
    <li className={`flex px-3 ${right ? 'justify-end' : 'justify-start'} ${startsGroup ? 'mt-3' : 'mt-[3px]'}`}>
      <div className={`flex max-w-[88%] flex-col sm:max-w-[min(68%,34rem)] ${right ? 'items-end' : 'items-start'}`}>
        <div
          className={[
            'relative rounded-2xl',
            compact
              ? 'px-2.5 pb-0.5 pt-1 text-[12px] leading-[1.35]'
              : 'px-3 pb-1 pt-1.5 text-[14px] leading-[1.4]',
            // 🔴 No 1px border on the counterparty's bubble. On the tinted
            // canvas a white card separates by ELEVATION, and a border made the
            // thread look like a stack of form fields. The own-side bubble gets
            // a soft vertical gradient so a long block of accent has depth
            // instead of reading as one flat slab of brand red.
            own
              ? 'bg-gradient-to-b from-primary-600 to-primary-700 text-white shadow-[0_1px_2px_rgba(102,2,12,0.28)]'
              : 'bg-white text-ink-900 shadow-[0_1px_2px_rgba(0,5,23,0.10)]',
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
                right ? `-right-[9px] ${own ? 'bg-primary-600' : 'bg-white'}` : '-left-[9px] bg-white'
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
          {/* D9 · the image, above its line of text (2026-09-23).
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
  onRetry,
  startsGroup = true,
  compact = false,
}) {
  if (message.senderType === 'system') return <SystemNotice message={message} compact={compact} />;

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
      senderName={counterpartyName}
      senderType={message.senderType}
      pending={message.pending}
      failed={message.failed}
      onRetry={onRetry}
      startsGroup={startsGroup}
      compact={compact}
    />
  );
}
