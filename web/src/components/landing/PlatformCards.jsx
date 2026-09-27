import { useRef, useState } from 'react';

/**
 * "What makes MPX Global different" — eight feature cards.
 *
 * 2026-09-27 redesign (owner: "super premium"): each card is a sharp picture
 * (one shared 16:10 shape) with the chip on it, and the words BELOW on white —
 * replacing the staggered grid of blurred pictures with frosted text panels on
 * top. Phones get one swipeable row with a counter (eight stacked cards were
 * ~2,600px). sm: two columns; lg+: four across.
 *
 * 🔴 **Every line here is something the platform ACTUALLY does today.** The
 * first six are carried over unchanged from the icon list this replaced; the
 * last two were added on 2026-09-27 and each was CHECKED AGAINST THE BACKEND
 * before it was written — see the notes on them. No
 * counts, no "trusted by", no promises about volume — the page has a standing
 * rule against claims it cannot back, which is why the design's six invented
 * testimonials were never built. If a card stops being true, delete the card.
 *
 * 🔴 **These cards are NOT links.** The reference's are — they lead to articles,
 * and each carries a date and a "REPORT / ARTICLE" label. We have no article
 * behind any of this, so there is no date, no document type and no hover lift:
 * a card that looks clickable and does nothing is what `web-ui-notes.md`
 * forbids. The chip is a plain label, not a filter.
 *
 * ✅ **Artwork supplied by the owner on 2026-09-27** and renamed to
 * `card-*` — one of the originals contained a space and an `&`, which is a query
 * separator in a URL and would have broken the request (the same bug the
 * Modi/Trump photo hit). The gradient behind each image is kept as the fallback
 * ground, so a file that fails to load leaves a brand-coloured card rather than
 * a hole.
 *
 * ⚠️ Two of the files are small — `card-payments.webp` is 400×300 and
 * `card-quotations.jpg` 516×387. They are fine at three columns on a 1440px
 * screen (~424px wide) but upscale past 1.4× on a very wide monitor. Worth
 * replacing if higher-resolution versions exist.
 *
 * ✅ **The words never sit on a picture** (they are on the card's white), so
 * swapping an image needs no contrast re-check. The chip is ink-900 on white/90.
 */
/* IMAGE NOTE (owner, 2026-09-27): five of the supplied pictures clash with the
   two office photographs — visibility (purple flat art), AI search (network
   graphic), enquiry & chat (cartoon robot), payments (red mock-up) and sign-up
   (neon blue render). They are being replaced with real business photographs
   (free Unsplash licence) that the owner downloads from a shortlist, because
   Unsplash blocks scripted downloads. No logos or third-party app screens in
   any replacement: another company's brand on this page is a problem, and a
   payment provider's screen would imply MPX moves money. */
const CARDS = [
  {
    chip: 'Verification',
    title: 'A person reads the documents',
    body: 'Verification is done by our team, not an automated stamp. The tick means someone checked that company’s papers.',
    tone: 'from-primary-800 via-primary-900 to-ink-900',
    image: '/card-verification.jpg',
  },
  {
    chip: 'Visibility',
    title: 'Sellers are visible from day one',
    body: 'An exporter’s public profile goes live the moment they register. Verification adds the tick — it is not a gate to being found.',
    tone: 'from-ink-800 via-ink-900 to-primary-900',
    image: '/card-visibility.jpg',
  },
  {
    chip: 'AI search',
    title: 'Describe it, don’t guess keywords',
    body: 'Write what you need in plain language and get matching suppliers back. No hunting for the exact term a seller happened to type.',
    tone: 'from-primary-700 via-primary-900 to-ink-900',
    image: '/card-ai-matchmaking.jpg',
  },
  {
    chip: 'Enquiry & chat',
    title: 'Talk to the supplier directly',
    body: 'A structured enquiry, then live chat with files. No email chains, and the whole conversation stays in one place.',
    tone: 'from-ink-900 via-primary-900 to-primary-800',
    image: '/card-chat-enquiry.jpg',
  },
  {
    chip: 'Quotations',
    title: 'Real quotations, not chat messages',
    body: 'Sellers send a priced PDF into the chat. Either side can counter-offer, and both confirm the final figure with a code sent to their email.',
    tone: 'from-primary-900 via-ink-900 to-ink-800',
    image: '/card-quotations.jpg',
  },
  {
    /* 🔴 True TODAY, and DO NOT "upgrade" this card.
       Asked on 2026-09-27 to change it to "your payment will be secure via MPX
       Global — safe buying and selling". Red-alerted and the owner agreed not to
       claim it: **"okk then dont claim it now"**.

       Two separate reasons, both still standing:
         · Escrow is Bucket B / Phase 2 (`docs/month1-not-doing.md` line 138,
           `docs/scope-of-work.md` line 27). CLAUDE.md: "Phase 1 is discovery and
           trust: no money moves."
         · Even once escrow ships, the sentence cannot ship before the system.
           Today MPX Global holds no money and wires no gateway; the buyer pays
           the SELLER'S own account off the quotation. A buyer who reads a
           protection promise here and is then defrauded acted on something that
           was never true, and that lands on the client.

       It also contradicts what is already in writing to the client —
       `docs/Client-Requests.md` line 60: "MPX Global never holds or moves
       anyone's money" — which the interim Terms and Privacy Policy match. */
    chip: 'Payments',
    title: 'You pay the supplier directly',
    body: 'MPX Global does not hold or move your money. The quotation carries the seller’s own bank details for you to pay against.',
    tone: 'from-ink-800 via-primary-900 to-ink-900',
    image: '/card-payments.webp',
  },
  {
    /* 🔴 Verified against `signup.service.js` before it was written here: step 1
       holds the details in a short-lived `PendingSignup`, each channel gets its
       OWN code, and no `users` / `organisations` row is written until both are
       proved. Do not soften this to "we verify your email" — the point is that
       BOTH are proved, and that nothing exists until they are. */
    chip: 'Sign-up',
    title: 'Email and phone are both proved',
    body: 'Each gets its own code, and no account exists until both are confirmed — so nobody can register on an address they do not own.',
    tone: 'from-primary-900 via-ink-900 to-primary-800',
    image: '/card-signup.jpg',
  },
  {
    /* 🔴 The organisation claim (D7), built 2026-09-23 — `CLAIM_SEAT_TAKEN` in
       `signup.service.js`, and `verification.service.js`: "one company = one
       Organisation, no second KYC, one tick". */
    chip: 'Organisations',
    title: 'One company, one profile',
    body: 'A colleague signing up joins the company that already exists instead of making a duplicate. One verification, one tick, one public page.',
    tone: 'from-ink-900 via-ink-800 to-primary-900',
    image: '/card-organisations.jpg',
  },
];

function Card({ card }) {
  return (
    /* Not a link — see the header note — so no lift and no pointer; the only
       hover response is a slow zoom on the picture, which promises nothing. */
    <div className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white p-2 shadow-card ring-1 ring-ink-200/70">
      <div className={`relative isolate aspect-[16/10] overflow-hidden rounded-2xl bg-gradient-to-br ${card.tone}`}>
        {card.image && (
          <img
            src={card.image}
            alt=""
            loading="lazy"
            width={900}
            height={560}
            /* Decorative: the title says what the card is about (`web-design.md`).
               Sharp from the start — the old 2px blur read as low quality until
               hovered (2026-09-27 redesign). */
            /* Full colour, untreated (owner, 2026-09-27: a muted treatment was
               "dull", a partial one "not looking good"). The fix for pictures
               that clash is replacing them — see IMAGE NOTE above CARDS. */
            className="absolute inset-0 -z-10 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
          />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-900 shadow-sm ring-1 ring-black/5 backdrop-blur-sm">
          {card.chip}
        </span>
      </div>
      <div className="flex flex-1 flex-col px-3 pb-3 pt-4 sm:px-4 sm:pb-4">
        <h3 className="text-[16px] font-semibold leading-snug tracking-tight text-ink-900">{card.title}</h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-600">{card.body}</p>
      </div>
    </div>
  );
}

export function PlatformCards() {
  const railRef = useRef(null);
  const [active, setActive] = useState(0);

  // Phones: which card is in view, for the "1 / 8" counter.
  const onScroll = () => {
    const el = railRef.current;
    if (!el || !el.firstElementChild) return;
    const step = el.firstElementChild.getBoundingClientRect().width + 12;
    setActive(Math.min(CARDS.length - 1, Math.round(el.scrollLeft / step)));
  };

  return (
    <>
      {/* Below lg: ONE swipeable row (eight stacked cards were ~2,600px on a
          phone, and two columns still ran ~1,700px on a tablet). lg+: four
          across, two rows. All cards share one
          image shape, so the grid is even — the old staggered columns fought
          the premium feel. */}
      <ul
        ref={railRef}
        onScroll={onScroll}
        className="scrollbar-none -mx-4 mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:gap-4 sm:px-6 lg:mx-0 lg:grid lg:snap-none lg:grid-cols-4 lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {CARDS.map((c) => (
          <li key={c.title} className="w-[82%] shrink-0 snap-start sm:w-[46%] md:w-[38%] lg:w-auto">
            <Card card={c} />
          </li>
        ))}
      </ul>
      <p className="mt-3 text-center text-[12px] font-medium tabular-nums text-ink-500 lg:hidden" aria-hidden="true">
        {active + 1} / {CARDS.length}
      </p>
    </>
  );
}
