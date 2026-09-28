import { useEffect, useRef, useState } from 'react';

import {
  BadgeCheckIcon,
  BuildingIcon,
  ChatIcon,
  CheckIcon,
  CreditCardIcon,
  LockIcon,
  MailIcon,
  PhoneIcon,
  QuoteIcon,
  ShieldIcon,
  SparkleIcon,
} from '../ui/icons.jsx';

/**
 * "What makes MPX Global different" — now a bento board. ⚠️ The LAYOUT notes
 * below describe earlier card versions; see the note above `PlatformCards`.
 * The content rules still hold.
 *
 * 🔴 **The reference's ARROW BUTTON and its PILL CTA are deliberately absent.**
 * These cards are not links — there is no page behind "A person reads the
 * documents" — and a control that looks live and does nothing is what
 * `web-ui-notes.md` forbids. The label top-right is a plain tag, not a button;
 * it is styled to read as one (translucent, small caps) rather than as
 * something to press. If these ever get destinations, the arrow can come back
 * with them.
 *
 * 🔴 **Every line here is something the platform ACTUALLY does today.** The
 * copy was REWRITTEN SHORT on 2026-09-28 (owner: "reduce the text and
 * re-formulate the content") — each title/line says the same true thing as the
 * long sentence it replaced, with nothing added. Watch-outs kept deliberately:
 * "Confirmed contacts" (we prove the email and phone, NOT a person's identity),
 * and Payments says the money goes to the seller — never that it is protected. No counts, no
 * "trusted by", no promises about volume — the rule that kept the design's six
 * invented testimonials off this page. If a card stops being true, delete it.
 *
 * 🔴 **Light cards, not black** (owner, 2026-09-28: "card color is not looking
 * good in black make it in professnol color"). The card is white and the section
 * behind it is `surface-subtle` — the token that exists for exactly this, "the
 * canvas behind every card", chosen by the owner for the whole product. A white
 * card on a white section would have no edge at all, which is why the SECTION
 * moved rather than only the cards.
 *
 * ⚠️ The card's edge is carried by `shadow-card`, not by the hairline: a
 * `surface-border` ring on `surface-subtle` measures only **1.60:1**. That is
 * below the 3:1 WCAG asks of a UI boundary — which does not apply here, because
 * these cards are not operable controls, but it does mean the ring alone cannot
 * be relied on to separate them. This is the same card pattern the catalogue
 * already uses.
 *
 * ⚠️ Contrast measured on the light card: title ink-900 **20.3:1**, body
 * ink-600 **5.4:1**, the mark primary-600 **5.7:1** (a non-text element needs
 * 3:1), and the tag primary-700 on primary-50 **6.7:1**. `ink-400` is 2.6:1 and
 * is not usable for text here, however quiet a caption is meant to look.
 */
const CARDS = [
  {
    icon: ShieldIcon,
    chip: 'Verification',
    layout: 'feature',
    image: '/card-verification.jpg',
    title: 'Verified by people',
    body: 'Our team reads the documents behind every tick.',
  },
  {
    icon: BadgeCheckIcon,
    chip: 'Visibility',
    layout: 'plain',
    title: 'Live from day one',
    body: 'Seller profiles are public the moment they sign up.',
  },
  {
    icon: SparkleIcon,
    chip: 'AI search',
    layout: 'wide',
    image: '/card-ai-matchmaking.jpg',
    title: 'Search the way you talk',
    body: 'Describe what you need — our AI matches you with suppliers.',
  },
  {
    icon: ChatIcon,
    chip: 'Enquiry & chat',
    layout: 'plain',
    title: 'Talk direct',
    body: 'Enquiry and live chat, in one place.',
  },
  {
    icon: QuoteIcon,
    chip: 'Quotations',
    layout: 'plain',
    title: 'Real quotations',
    body: 'Priced PDFs, counter-offers, confirmed by both sides.',
  },
  {
    /* 🔴 True TODAY, and DO NOT "upgrade" this card. Asked on 2026-09-27 to
       make it a secured-payments claim; red-alerted and the owner agreed not
       to ("okk then dont claim it now"). Escrow is Bucket B / Phase 2, and
       even once it ships the sentence cannot ship before the system: today the
       buyer pays the SELLER'S own account off the quotation. It also
       contradicts `docs/Client-Requests.md` line 60, which tells the client in
       writing that MPX Global never holds or moves anyone's money. */
    icon: CreditCardIcon,
    chip: 'Payments',
    layout: 'accent',
    title: 'Pay suppliers directly',
    body: 'Your money goes straight to the seller.',
  },
  {
    /* 🔴 Checked against `signup.service.js` before it was written: step 1 holds
       details in a short-lived `PendingSignup`, each channel gets its OWN code,
       and no `users` / `organisations` row exists until both are proved. */
    icon: LockIcon,
    chip: 'Sign-up',
    layout: 'plain',
    title: 'Confirmed contacts',
    body: 'Email and phone proved before any account exists.',
  },
  {
    /* 🔴 The D7 organisation claim, built 2026-09-23 — `CLAIM_SEAT_TAKEN` in
       `signup.service.js`, and `verification.service.js`: "one company = one
       Organisation, no second KYC, one tick". */
    icon: BuildingIcon,
    chip: 'Organisations',
    layout: 'photo',
    image: '/card-organisations.jpg',
    title: 'One company, one profile',
    body: 'Colleagues join it — no duplicates.',
  },
];

/*
 * Bento order. The grid fills row by row, so this order IS the layout (lg, four
 * columns, three rows):
 *   row 1 — Verification (2×2) · AI search (2 wide)
 *   row 2 — (Verification)     · Chat · Quotations
 *   row 3 — Visibility · Sign-up · Organisations · Payments
 * Phones swipe through the same order.
 */
const ORDER = ['Verification', 'AI search', 'Enquiry & chat', 'Quotations', 'Visibility', 'Sign-up', 'Organisations', 'Payments'];
const TILES = ORDER.map((chip) => CARDS.find((c) => c.chip === chip));

const SPAN = {
  feature: 'sm:col-span-2 lg:row-span-2',
  wide: 'sm:col-span-2',
  photo: '',
  accent: '',
  plain: '',
};

const TILE = 'relative isolate flex h-full min-h-[172px] flex-col overflow-hidden rounded-[24px] p-5';

/* ── Motion helpers ─────────────────────────────────────────────────────── */

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** True once `ref` scrolls into view (at once under reduced motion). */
function useSeen(ref) {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined' || reducedMotion());
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen]);
  return seen;
}

/** Types `text` out once `start` is true; the whole text under reduced motion. */
function Typed({ text, start }) {
  const [n, setN] = useState(() => (reducedMotion() ? text.length : 0));
  useEffect(() => {
    if (!start || n >= text.length) return undefined;
    const t = setTimeout(() => setN((v) => v + 1), 38);
    return () => clearTimeout(t);
  }, [start, n, text.length]);
  return (
    <>
      {text.slice(0, n)}
      <span className={`ml-px inline-block h-3.5 w-px translate-y-0.5 bg-ink-500 ${n >= text.length ? 'animate-pulse' : ''}`} />
    </>
  );
}

/* Cursor-follow glow for the white tiles: the pointer position is written to
   CSS variables on the tile, and a radial gradient reads them. */
const trackPointer = (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
};

/* ── Vignettes: a small, illustrative picture of each point ─────────────────
   Decorative (aria-hidden) and plainly EXAMPLES — no real company, figure or
   person. They show what the feature looks like, not a claim about volume. */

const VIGNETTES = {
  'Enquiry & chat': (
    <div className="flex w-full max-w-[210px] flex-col gap-1.5 text-[11px] leading-snug">
      <span className="self-start rounded-2xl rounded-bl-md bg-ink-100 px-3 py-1.5 text-ink-700">Can you ship 500 units?</span>
      <span className="self-end rounded-2xl rounded-br-md bg-primary-600 px-3 py-1.5 text-white shadow-sm">Yes — samples this week.</span>
    </div>
  ),
  Quotations: (
    <div className="w-full max-w-[200px] rounded-xl bg-white px-3 py-2 text-[11px] shadow-sm ring-1 ring-ink-200/80">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-ink-900">Quotation.pdf</span>
        <span className="rounded bg-ink-100 px-1 text-[9.5px] font-semibold text-ink-600">v2</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-ink-500 line-through">$4.20</span>
        <span className="font-bold text-ink-900">$3.95 / kg</span>
      </div>
      <div className="mt-1 inline-flex items-center gap-1 font-semibold text-success-700">
        <CheckIcon className="h-3 w-3" />
        Confirmed by both
      </div>
    </div>
  ),
  Visibility: (
    <div className="w-full max-w-[220px] rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-ink-200/80">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 text-[11px] font-bold text-white">
          YC
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[11.5px] font-semibold text-ink-900">Your company</span>
          <span className="block text-[10px] text-ink-500">Public profile</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-700">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-500 opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success-500" />
          </span>
          Live
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[9.5px] font-semibold text-ink-500">
        <span>Sign up</span>
        <span className="h-px flex-1 bg-gradient-to-r from-ink-200 to-success-500/60" />
        <span className="text-success-700">Live · Day 1</span>
      </div>
    </div>
  ),
  'Sign-up': (
    <div className="flex w-full max-w-[220px] flex-col gap-1.5">
      {[
        { Icon: MailIcon, value: 'a••••@yourco.com' },
        { Icon: PhoneIcon, value: '+91 ••••• ••421' },
      ].map(({ Icon, value }) => (
        <span key={value} className="flex items-center gap-2 rounded-lg bg-white py-1.5 pl-1.5 pr-2 shadow-sm ring-1 ring-ink-200/80">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink-50 text-ink-600 ring-1 ring-ink-200/70">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-ink-700">{value}</span>
          <span className="inline-flex items-center gap-0.5 rounded-full bg-success-50 px-1.5 py-0.5 text-[9.5px] font-semibold text-success-700">
            <CheckIcon className="h-2.5 w-2.5" />
            Code
          </span>
        </span>
      ))}
    </div>
  ),
  Payments: (
    <div className="flex w-full max-w-[210px] items-center gap-2 text-[10.5px] font-semibold text-ink-700">
      <span className="rounded-full bg-white px-2.5 py-1 shadow-sm ring-1 ring-primary-100">Buyer</span>
      <span className="relative h-px flex-1 bg-[linear-gradient(to_right,theme(colors.primary.300)_50%,transparent_50%)] [background-size:6px_1px]">
        <span className="mpx-travel absolute -top-[3.5px] h-2 w-2 rounded-full bg-primary-600 shadow-[0_0_0_3px_theme(colors.primary.100)]" />
      </span>
      <span className="rounded-full bg-primary-600 px-2.5 py-1 text-white shadow-sm">Seller</span>
    </div>
  ),
};

/* ── Tiles ──────────────────────────────────────────────────────────────── */

/** A photograph tile: a gentle fade at its foot carries the title and line. */
function PhotoTile({ card, big = false, extra = null, scan = false }) {
  return (
    <article className={`group ${TILE} justify-end bg-ink-900 text-white shadow-[0_18px_40px_-24px_rgb(0_5_23/0.6)]`}>
      <img
        src={card.image}
        alt=""
        loading="lazy"
        decoding="async"
        width={826}
        height={620}
        className="absolute inset-0 -z-10 h-full w-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.06] motion-reduce:transition-none"
      />
      <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-ink-900/90 via-ink-900/35 via-50% to-transparent" />
      {scan && (
        <span
          aria-hidden="true"
          className="mpx-scan absolute inset-x-0 top-0 -z-10 h-1/4 border-b border-white/40 bg-gradient-to-b from-transparent via-white/10 to-white/20"
        />
      )}
      {/* Hairline inner edge — keeps the photo crisp against the page. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[24px] ring-1 ring-inset ring-white/10" />
      {extra}
      <h3 className={`text-balance font-semibold leading-tight tracking-tight ${big ? 'text-[22px] sm:text-[26px]' : 'text-[17px]'}`}>
        {card.title}
      </h3>
      <p className={`mt-1.5 text-white/75 ${big ? 'max-w-sm text-[14px] leading-relaxed' : 'text-[13px] leading-snug'}`}>{card.body}</p>
    </article>
  );
}

/**
 * A quiet tile: its vignette on top, the title and line below, in ONE panel.
 * (A two-part stage + caption version was tried on 2026-09-28 and reverted —
 * owner: "that separation is not looking good, the design became cheap".) A
 * gradient hairline frame (1px padding over a gradient) and an inner top
 * highlight give the edge; a cursor-follow glow answers the pointer. `blush` =
 * the board's one accent (Payments).
 */
function QuietTile({ card, blush = false }) {
  return (
    <div
      className={`h-full rounded-[24px] p-px shadow-[0_1px_2px_rgb(0_5_23/0.04),0_14px_32px_-20px_rgb(0_5_23/0.18)] ${
        blush ? 'bg-gradient-to-br from-primary-200 via-primary-100 to-white' : 'bg-gradient-to-br from-ink-200 via-ink-100 to-white'
      }`}
    >
      <article
        onPointerMove={trackPointer}
        className={`group ${TILE} rounded-[23px] shadow-[inset_0_1px_0_rgb(255_255_255)] ${
          blush ? 'bg-gradient-to-br from-primary-50 to-white' : 'bg-gradient-to-b from-white to-ink-50/60'
        }`}
      >
        {/* Background (owner, 2026-09-28: "some good background in these",
            then "keep the watermarks, just improve"): a soft two-glow wash, a
            dot grid fading from the top, and the tile's own icon as a
            watermark — drawn at a 1px line (not the 1.8 UI weight, which turns
            heavy at this size), tucked into the corner away from the words,
            and faded toward the middle of the tile. It turns a little on
            hover. All decoration. */}
        <span aria-hidden="true" className={`absolute -right-12 -top-14 -z-10 h-40 w-40 rounded-full blur-3xl ${blush ? 'bg-primary-200/70' : 'bg-primary-100/70'}`} />
        <span aria-hidden="true" className="absolute -bottom-12 -left-10 -z-10 h-32 w-40 rounded-full bg-ink-100/80 blur-2xl" />
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(rgb(0_5_23/0.06)_1px,transparent_1px)] [background-size:14px_14px] [mask-image:linear-gradient(to_bottom,black,transparent_60%)]"
        />
        <span
          aria-hidden="true"
          className="absolute -bottom-9 -right-9 -z-10 [mask-image:radial-gradient(circle_at_75%_75%,black_35%,transparent_75%)]"
        >
          <card.icon
            strokeWidth={1}
            className={`h-36 w-36 transition-transform duration-700 ease-out group-hover:-rotate-6 group-hover:scale-105 motion-reduce:transition-none ${
              blush ? 'text-primary-600/[0.12]' : 'text-primary-900/[0.07]'
            }`}
          />
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: 'radial-gradient(240px circle at var(--mx, 50%) var(--my, 0%), rgb(206 6 26 / 0.08), transparent 70%)' }}
        />
        <div aria-hidden="true" className="flex flex-1 items-start transition-transform duration-500 group-hover:-translate-y-0.5 motion-reduce:transition-none">
          {VIGNETTES[card.chip]}
        </div>
        <h3 className="pt-5 text-[17px] font-semibold leading-snug tracking-tight text-ink-900">{card.title}</h3>
        <p className="mt-1 text-[13px] leading-snug text-ink-500">{card.body}</p>
      </article>
    </div>
  );
}

/**
 * 2026-09-28 — THE BENTO BOARD, with craft and motion (owner: "implement
 * better animation and effects, tiles are not that beautiful and premium", then
 * "reduce the size of the whole section"). Each white tile carries a small
 * illustrative vignette of its point; frames are gradient hairlines with an
 * inner highlight; the white tiles glow where the cursor is; tiles rise in one
 * after another as the board enters the view; a light scan sweeps the
 * Verification photo; the AI example types itself. All of it is still under
 * reduced motion. Rows are ~172px (was 200+).
 *
 * Phones: one swipe rail (80%-wide tiles); sm: two columns; lg: the board.
 * Tiles are not links (see the note at the top).
 */
export function PlatformCards() {
  const listRef = useRef(null);
  const seen = useSeen(listRef);

  return (
    <ul
      ref={listRef}
      className="scrollbar-none -mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:mt-8 sm:grid sm:grid-cols-2 sm:gap-3.5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 lg:auto-rows-[minmax(172px,auto)]"
    >
      {TILES.map((card, i) => (
        <li
          key={card.title}
          style={{ transitionDelay: seen ? `${i * 70}ms` : '0ms' }}
          className={`w-[80%] shrink-0 snap-start transition duration-700 ease-out motion-reduce:transition-none sm:w-auto ${SPAN[card.layout]} ${
            seen ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'
          }`}
        >
          {card.layout === 'feature' && (
            <PhotoTile
              card={card}
              big
              scan
              extra={
                <span className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[12px] font-semibold text-ink-900 shadow-sm">
                  <BadgeCheckIcon className="h-4 w-4 text-success-700" aria-hidden="true" />
                  Checked by our team
                </span>
              }
            />
          )}
          {card.layout === 'wide' && (
            <PhotoTile
              card={card}
              extra={
                /* An EXAMPLE of a plain-language request — illustrative, not a claim. */
                <span aria-hidden="true" className="absolute left-5 top-5 hidden items-center gap-2 rounded-full bg-white/95 py-1.5 pl-3 pr-4 text-[12.5px] text-ink-700 shadow-sm sm:inline-flex">
                  <SparkleIcon className="h-4 w-4 shrink-0 text-primary-600" />
                  <span>
                    “<Typed text="Organic turmeric, 2 tonnes, to Germany" start={seen} />”
                  </span>
                </span>
              }
            />
          )}
          {card.layout === 'photo' && <PhotoTile card={card} />}
          {card.layout === 'accent' && <QuietTile card={card} blush />}
          {card.layout === 'plain' && <QuietTile card={card} />}
        </li>
      ))}
    </ul>
  );
}
