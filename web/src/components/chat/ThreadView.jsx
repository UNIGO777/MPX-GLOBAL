import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { ErrorState } from '../ui/ErrorState.jsx';
import { Spinner } from '../ui/Spinner.jsx';
import { BoxIcon, ChevronDownIcon, ChevronLeftIcon, ExternalIcon, EyeIcon } from '../ui/icons.jsx';
import { CompanyAvatar } from './CompanyAvatar.jsx';
import { Composer } from './Composer.jsx';
import { DateSeparator } from './DateSeparator.jsx';
import { FreezeBanner } from './FreezeBanner.jsx';
import { MessageBubble } from './MessageBubble.jsx';
import { ParticipantsLine } from './ParticipantsLine.jsx';
import { productPageLive } from './productPage.js';
import { ThreadSkeleton } from './ThreadSkeleton.jsx';

/**
 * THE thread. One component, three surfaces: the inbox page, the docked window
 * and the admin viewer — because a conversation that renders differently
 * depending on where you opened it is three chances to leak a different field.
 *
 * 🔴 `readOnly` is the admin variant, and it does not render a disabled
 * composer — it renders NO composer. Admin can read; admin cannot speak (§7.3),
 * and there is no permission level at which that changes.
 *
 * 🔴 Reading always works. In every frozen state the full transcript stays
 * scrollable (M4-22) — freeze replaces the composer, never the history.
 */
function sameDay(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/**
 * Consecutive messages from one side are one visual RUN: the company name is
 * printed once at the top and the clock once at the bottom. A five-minute gap
 * starts a new run, so a reply an hour later is not glued to the last one.
 */
const RUN_GAP_MS = 5 * 60 * 1000;

function sameRun(a, b) {
  if (!a || !b) return false;
  if (a.senderType !== b.senderType) return false;
  if (a.senderType === 'system' || b.senderType === 'system') return false;
  return new Date(b.createdAt) - new Date(a.createdAt) < RUN_GAP_MS;
}

export function ThreadView({
  thread,
  viewerSide,
  draft = '',
  onDraftChange,
  onBack,
  readOnly = false,
  variant = 'page',
  connected = true,
  headerAction = null,
}) {
  const { conversation, messages, pending, isLoading, error } = thread;
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  // Set from a scroll EVENT, never in an effect — the brief's "new messages"
  // affordance needs to know when the reader has left the bottom.
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const lastMessageId = messages[messages.length - 1]?.id;

  // Opening a thread marks it read (server-stamped). There is no manual
  // "mark as read" control — and staff reads must never mark anything read for
  // a party, which is why this is skipped entirely in the admin variant.
  const { markRead } = thread;
  useEffect(() => {
    if (!readOnly && conversation?.id) markRead();
  }, [readOnly, conversation?.id, lastMessageId, markRead]);

  /**
   * Land at the newest message.
   *
   * 🔴 Sets the container's own `scrollTop` rather than calling
   * `scrollIntoView` on a sentinel: the scroller is absolutely positioned inside
   * a relative wrapper (so the header fade and the jump button can be pinned),
   * and `scrollIntoView` against that combination left the admin viewer sitting
   * part-way up the history. Keyed on the message COUNT as well as the id, so it
   * re-lands once the first page has actually rendered.
   */
  const messageCount = messages.length;
  useLayoutEffect(() => {
    if (isLoading) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [isLoading, conversation?.id, messageCount]);

  // Follow new arrivals, but only when the reader is already near the bottom —
  // yanking someone away from history they are reading is worse than a missed
  // line, which is what the "new messages" affordance is for.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [lastMessageId, pending.length]);

  if (error) {
    return (
      <ErrorState
        title="We couldn't load this conversation"
        requestId={error?.response?.data?.error?.requestId}
        onRetry={thread.refetch}
      />
    );
  }

  const frozen = Boolean(conversation?.frozen);
  const product = conversation?.product;

  const productLive = productPageLive(conversation);
  const counterparty = conversation?.counterparty?.name;
  const rows = [...messages, ...pending];

  /**
   * The header's headline.
   *
   * A party sees WHO they are talking to. Staff see BOTH companies — composed
   * here rather than taken from the server's `title`, which also appends the
   * product and so printed it twice beside the product chip.
   */
  const headline =
    viewerSide === 'staff'
      ? [conversation?.buyerOrg?.name, conversation?.exporterOrg?.name].filter(Boolean).join(' × ') ||
        conversation?.title
      : counterparty ?? conversation?.title;

  /**
   * Who to name above a run of messages.
   *
   * A party has one counterparty, so only the other side is ever labelled. A
   * MODERATOR is neither party — without this every message rendered
   * left-aligned and unlabelled, so buyer and seller were indistinguishable in
   * the one view whose whole job is working out who did what.
   */
  const nameFor = (senderType) => {
    if (viewerSide !== 'staff') return senderType === viewerSide ? null : counterparty;
    if (senderType === 'buyer') return conversation?.buyerOrg?.name ?? 'Buyer';
    if (senderType === 'exporter') return conversation?.exporterOrg?.name ?? 'Seller';
    return null;
  };

  return (
    <section className="flex h-full min-h-0 flex-col bg-white">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      {/* 🔴 The dock renders NO header here (owner, 2026-08-18). Its navy title
          bar already carries the company, the product link and the M4-1
          disclosure, so a second white block underneath repeated the same facts
          and cost ~66px of a 512px window. One header, and it is the blue one. */}
      {variant === 'dock' ? null : (
        /**
         * 🔴 Restructured 2026-08-17. It used to stack three lines — the composed
         * title ("Product × Company"), the product link, then the participants —
         * which printed the product name twice and the company name twice, in a
         * bar that then had no room for anything else.
         *
         * Now: the COUNTERPARTY leads (that is who you are talking to), the
         * product is a chip beside it (that is what about), and the platform's
         * presence sits underneath as one quiet line — still always visible,
         * because M4-1 requires it.
         */
        <header className="z-10 shrink-0 border-b border-surface-border bg-gradient-to-b from-white to-primary-50/90 px-3 py-2.5 shadow-[0_1px_3px_rgba(26,46,143,0.07)] backdrop-blur-md sm:px-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back to conversations"
                className="-ml-1 shrink-0 rounded-lg p-1.5 text-ink-500 hover:bg-ink-50 hover:text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 md:hidden"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
            )}

            {/* A party sees ONE mark, the company they are talking to. Staff are
                neither party (M4-2), so they see BOTH, overlapped in the order
                the title reads: buyer × seller. The staff projection carries the
                two logos and nothing was rendering them. */}
            {viewerSide === 'staff' ? (
              (conversation?.buyerOrg || conversation?.exporterOrg) && (
                <span className="flex shrink-0 -space-x-2" aria-hidden="true">
                  <CompanyAvatar
                    name={conversation?.buyerOrg?.name ?? ''}
                    logo={conversation?.buyerOrg?.logo}
                    size="xs"
                    className="outline outline-2 outline-white"
                  />
                  <CompanyAvatar
                    name={conversation?.exporterOrg?.name ?? ''}
                    logo={conversation?.exporterOrg?.logo}
                    size="xs"
                    className="outline outline-2 outline-white"
                  />
                </span>
              )
            ) : (
              counterparty && (
                <CompanyAvatar name={counterparty} logo={conversation?.counterparty?.logo} size="sm" />
              )
            )}

            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[15px] font-bold leading-tight text-ink-900">
                {headline ?? 'Conversation'}
              </h2>
              {/* 🔴 The platform disclosure is for the PARTIES. It tells two
                  companies that MPX Global can read what they write — which is
                  the point of M4-1. Shown to staff it said nothing: the
                  moderator IS MPX Global.
                  The slot instead carries what a moderator does need and cannot
                  otherwise infer — that this screen has no composer by design,
                  not because it failed to load (§7.3: admin can read, admin
                  cannot speak). */}
              {/* nowrap, and the PRODUCT is what gives: letting this row wrap
                  was the third header line all over again. A truncated product
                  name is still legible, and the details panel carries it whole. */}
              <div className="mt-0.5 flex flex-nowrap items-center gap-x-2.5 text-[12px]">
                {viewerSide === 'staff' ? (
                  <span className="flex shrink-0 items-center gap-1.5 text-ink-500">
                    <EyeIcon className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                    {/* The full sentence needs the room of a wide screen; on a
                        phone "Read-only" alone still answers the question the
                        line exists for — where is the composer. */}
                    Read-only<span className="hidden sm:inline"> — staff cannot post here</span>
                  </span>
                ) : (
                  <ParticipantsLine participants={conversation?.participants} className="flex" />
                )}

                {/* The product, for phones — where the chip on the right is
                    hidden. Inline here rather than on a row of its own: a
                    three-row header ate a fifth of a phone's transcript. */}
                {product?.name && (
                  <span className="flex min-w-0 items-center gap-1.5 sm:hidden">
                    <BoxIcon className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                    {productLive ? (
                      <Link
                        to={`/product/${product.slug}`}
                        className="inline-flex min-w-0 items-center gap-1 font-medium text-primary-700"
                      >
                        <span className="truncate">{product.name}</span>
                        <ExternalIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                      </Link>
                    ) : (
                      <span className="truncate text-ink-500">{product.name}</span>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* What the conversation is ABOUT, as a chip rather than a third
                stacked line. M4-22: a link only while the page exists. */}
            {product?.name &&
              (productLive ? (
                <Link
                  to={`/product/${product.slug}`}
                  className="hidden max-w-[14rem] shrink-0 items-center gap-1.5 rounded-full border border-surface-border bg-ink-50 px-2.5 py-1 text-[12px] font-semibold text-ink-700 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 sm:inline-flex"
                >
                  <BoxIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{product.name}</span>
                  <ExternalIcon className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
                </Link>
              ) : (
                <span className="hidden max-w-[14rem] shrink-0 items-center gap-1.5 rounded-full border border-surface-border bg-ink-50 px-2.5 py-1 text-[12px] font-medium text-ink-500 sm:inline-flex">
                  <BoxIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{product.name}</span>
                </span>
              ))}

            {/* Whatever the surrounding surface wants at the end of the bar —
                the admin viewer hangs its details button here. */}
            {headerAction}

          </div>

        </header>
      )}

      {/* ── Messages ───────────────────────────────────────────────────── */}
      <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAwayFromBottom(el.scrollHeight - el.scrollTop - el.clientHeight > 240);
        }}
        className="chat-canvas absolute inset-0 overflow-y-auto overscroll-contain py-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {isLoading ? (
          <ThreadSkeleton />
        ) : (
          <>
            {thread.hasMore && (
              <div className="flex justify-center pb-2">
                <button
                  type="button"
                  onClick={() => thread.loadOlder()}
                  disabled={thread.loadingOlder}
                  className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink-600 hover:bg-ink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                >
                  {thread.loadingOlder && <Spinner className="h-3.5 w-3.5" />}
                  {thread.loadingOlder ? 'Loading…' : 'Load earlier messages'}
                </button>
              </div>
            )}

            <ul>
              {rows.map((message, i) => {
                const previous = rows[i - 1];
                const newDay = i === 0 || !sameDay(previous.createdAt, message.createdAt);
                return (
                  <Fragment key={message.id}>
                    {newDay && <DateSeparator at={message.createdAt} compact={variant === 'dock'} />}
                    <MessageBubble
                      message={message}
                      viewerSide={viewerSide}
                      // 🔴 The dock is a 352px window: without this the bubbles
                      // and platform notices render at page scale inside it.
                      compact={variant === 'dock'}
                      counterpartyName={nameFor(message.senderType)}
                      onRetry={() => thread.retry(message.body)}
                      startsGroup={newDay || !sameRun(previous, message)}
                    />
                  </Fragment>
                );
              })}
            </ul>
            <div ref={bottomRef} />
          </>
        )}
      </div>

        {/* Back to the newest message. Only once the reader is well away from
            the bottom, so it never covers the last line of a live thread. */}
        {awayFromBottom && !isLoading && (
          <button
            type="button"
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })}
            aria-label="Jump to the latest message"
            className={`absolute flex items-center justify-center rounded-full bg-white text-ink-600 shadow-lift ring-1 ring-surface-border transition-colors hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
              variant === 'dock' ? 'bottom-2 right-2.5 h-8 w-8' : 'bottom-3 right-4 h-10 w-10'
            }`}
          >
            <ChevronDownIcon className={variant === 'dock' ? 'h-4 w-4' : 'h-5 w-5'} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Informational only — sending still works while disconnected, because
          the REST path is the path of record and the socket is live delivery
          alone (§7.1). Only RECEIPT pauses. */}
      {!connected && !readOnly && (
        <p
          role="status"
          className="shrink-0 border-t border-warning-200 bg-warning-50 px-4 py-1.5 text-center text-[12px] font-medium text-warning-800"
        >
          Reconnecting… new messages may take a moment to appear.
        </p>
      )}

      {/* ── Composer zone — composer OR freeze banner, never both ──────── */}
      {!readOnly && (
        <div className="chat-foot shrink-0 px-3 pb-3 pt-2">
          {frozen ? (
            <>
              <FreezeBanner
                label={conversation?.frozenLabel}
                blockedReason={conversation?.blockedReason}
                compact={variant === 'dock'}
              />
              {/* A draft typed before the freeze landed is kept VISIBLE rather
                  than silently eaten — the sender can still copy it out. */}
              {draft.trim() && (
                <p className="mt-2 rounded-lg bg-ink-50 px-3 py-2 text-[13px] text-ink-600">
                  <span className="font-semibold text-ink-700">Your unsent message: </span>
                  {draft}
                </p>
              )}
            </>
          ) : (
            <Composer
              compact={variant === 'dock'}
              value={draft}
              onChange={onDraftChange}
              /* Clear the box the moment the message leaves it — the optimistic
                 bubble now holds the text, and a failed send keeps it on that
                 bubble with a Retry. Leaving it in the composer meant the
                 sender saw their line twice and could send it again. */
              onSend={(body) => {
                thread.sendMessage(body);
                onDraftChange('');
              }}
              sending={thread.sending}
              autoFocus={variant === 'dock'}
            />
          )}
        </div>
      )}
    </section>
  );
}
