/**
 * "What makes MPX Global different" as picture cards (owner, 2026-09-27, to the
 * BCG layout they sent): a staggered grid, a category chip on the artwork, and
 * a frosted panel carrying the words.
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
 * ⚠️ **The frosted panel is deliberately photo-independent.** `bg-white/85`
 * lands at 217/255 even over pure black, so ink-900 on it measures 14.3:1 and
 * ink-700 7.6:1 whatever the picture does. That is the point: swap any image and
 * nothing has to be re-measured — unlike the promo panels, where the copy sits
 * straight on the artwork and every new file needs checking.
 */
const CARDS = [
  {
    chip: 'Verification',
    title: 'A person reads the documents',
    body: 'Verification is done by our team, not an automated stamp. The tick means someone checked that company’s papers.',
    ratio: 'aspect-[4/3]',
    tone: 'from-primary-800 via-primary-900 to-ink-900',
    image: '/card-verification.jpg',
  },
  {
    chip: 'Visibility',
    title: 'Sellers are visible from day one',
    body: 'An exporter’s public profile goes live the moment they register. Verification adds the tick — it is not a gate to being found.',
    ratio: 'aspect-[5/4]',
    tone: 'from-ink-800 via-ink-900 to-primary-900',
    image: '/card-visibility.jpg',
  },
  {
    chip: 'AI search',
    title: 'Describe it, don’t guess keywords',
    body: 'Write what you need in plain language and get matching suppliers back. No hunting for the exact term a seller happened to type.',
    ratio: 'aspect-[4/3]',
    tone: 'from-primary-700 via-primary-900 to-ink-900',
    image: '/card-ai-matchmaking.jpg',
  },
  {
    chip: 'Enquiry & chat',
    title: 'Talk to the supplier directly',
    body: 'A structured enquiry, then live chat with files. No email chains, and the whole conversation stays in one place.',
    ratio: 'aspect-[5/4]',
    tone: 'from-ink-900 via-primary-900 to-primary-800',
    image: '/card-chat-enquiry.jpg',
  },
  {
    chip: 'Quotations',
    title: 'Real quotations, not chat messages',
    body: 'Sellers send a priced PDF into the chat. Either side can counter-offer, and both confirm the final figure with a code sent to their email.',
    ratio: 'aspect-[4/3]',
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
    ratio: 'aspect-[5/4]',
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
    ratio: 'aspect-[4/3]',
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
    ratio: 'aspect-[5/4]',
    tone: 'from-ink-900 via-ink-800 to-primary-900',
    image: '/card-organisations.jpg',
  },
];

function Card({ card }) {
  return (
    <li className="mb-4 break-inside-avoid">
      <div className={`group relative isolate overflow-hidden rounded-2xl bg-gradient-to-br ${card.tone} ${card.ratio}`}>
        {card.image && (
          <img
            src={card.image}
            alt=""
            loading="lazy"
            width={900}
            height={1200}
            /* Decorative: the title says what the card is about, so the picture
               adds nothing a screen reader needs (`web-design.md`).

               🔴 Softly blurred, sharpening on hover (owner, 2026-09-27: "make
               image some blur not two much on hover make it clear"). 2px, not
               Tailwind's `blur-sm` (4px) — at 4px the artwork stops being
               readable, which defeats having chosen it.

               🔴 The blur is behind `@media (hover: hover)`. A phone has no
               hover, so an unguarded `blur` would leave every image permanently
               soft for every touch visitor with no way to clear it. Touch gets
               the sharp image from the start.

               ⚠️ `scale-[1.03]` is not an effect — a blur samples past the
               element's own edges, so at 1.0 the card's gradient bleeds in as a
               pale rim. The scale pushes those edges outside the clip. It does
               NOT change on hover; only the blur does, so nothing moves. */
            className="absolute inset-0 -z-10 h-full w-full scale-[1.03] object-cover transition duration-300 motion-reduce:transition-none [@media(hover:hover)]:blur-[2px] [@media(hover:hover)]:group-hover:blur-0"
          />
        )}

        <span className="absolute left-3 top-3 rounded-md bg-ink-900/80 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
          {card.chip}
        </span>

        {/* The frosted panel. It sits INSIDE the card and stops short of the
            bottom, which is what gives the reference its layered look. */}
        <div className="absolute inset-x-2 bottom-2 rounded-lg bg-white/85 p-2.5 ring-1 ring-ink-900/10 backdrop-blur-md">
          <h3 className="text-[12.5px] font-extrabold leading-snug text-ink-900">
            {card.title}
          </h3>
          <p className="mt-1 text-[10.5px] leading-snug text-ink-700">{card.body}</p>
        </div>
      </div>
    </li>
  );
}

export function PlatformCards() {
  return (
    /* CSS columns rather than a grid: the cards are different heights on
       purpose, and columns pack them without anyone having to hand-assign a row
       span. `break-inside-avoid` on each card is what stops one splitting across
       a column boundary.

       🔴 FOUR columns (owner, 2026-09-27: "make 4 cards in one row"), which
       with eight cards is two per column — four across, as the reference is.

       ⚠️ The cards are LANDSCAPE because the artwork is: the owner's eight files
       run 1.20:1 to 2.40:1, every one wider than tall, and this grid started
       portrait to match the reference. A 2.40:1 image in a 4:5 card loses about
       68% of its width to `object-cover`.

       ⚠️ The ratios are now only 4/3 and 5/4 — NOT each file's own ratio, which
       is what three columns allowed. At four columns a card is ~316px wide, so a
       3/2 card would stand 211px tall and the panel would eat 45% of it. The
       taller ratios buy the panel its room, and the cost is more side-cropping:
       the AI graphic loses ~44% of its width, the rest much less. If an image is
       replaced, check its ratio against the card's — that is the number that
       decides how much survives.

       ✅ EIGHT cards (owner, 2026-09-27). Adding cards is only ever allowed if
       the new lines are TRUE; the last two were verified in the backend first. */
    <ul className="mt-8 columns-1 gap-4 sm:columns-2 sm:gap-4 lg:columns-4">
      {CARDS.map((c) => (
        <Card key={c.title} card={c} />
      ))}
    </ul>
  );
}
