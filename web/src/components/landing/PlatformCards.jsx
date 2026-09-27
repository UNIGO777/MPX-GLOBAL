import {
  BadgeCheckIcon,
  BuildingIcon,
  ChatIcon,
  CreditCardIcon,
  LockIcon,
  QuoteIcon,
  ShieldIcon,
  SparkleIcon,
} from '../ui/icons.jsx';

/**
 * "What makes MPX Global different" — restyled 2026-09-28 to the framed card the
 * owner sent: a mark and a label across the top, a large light-weight title, the
 * picture inset below it, and the sentence underneath.
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
 * sentences carry over unchanged through three restyles now. No counts, no
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
    title: 'A person reads the documents',
    body: 'Verification is done by our team, not an automated stamp. The tick means someone checked that company’s papers.',
    image: '/card-verification.jpg',
  },
  {
    icon: BadgeCheckIcon,
    chip: 'Visibility',
    title: 'Sellers are visible from day one',
    body: 'An exporter’s public profile goes live the moment they register. Verification adds the tick — it is not a gate to being found.',
    image: '/card-visibility.jpg',
  },
  {
    icon: SparkleIcon,
    chip: 'AI search',
    title: 'Describe it, don’t guess keywords',
    body: 'Write what you need in plain language and get matching suppliers back. No hunting for the exact term a seller happened to type.',
    image: '/card-ai-matchmaking.jpg',
  },
  {
    icon: ChatIcon,
    chip: 'Enquiry & chat',
    title: 'Talk to the supplier directly',
    body: 'A structured enquiry, then live chat with files. No email chains, and the whole conversation stays in one place.',
    image: '/card-chat-enquiry.jpg',
  },
  {
    icon: QuoteIcon,
    chip: 'Quotations',
    title: 'Real quotations, not chat messages',
    body: 'Sellers send a priced PDF into the chat. Either side can counter-offer, and both confirm the final figure with a code sent to their email.',
    image: '/card-quotations.jpg',
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
    title: 'You pay the supplier directly',
    body: 'MPX Global does not hold or move your money. The quotation carries the seller’s own bank details for you to pay against.',
    image: '/card-payments.webp',
  },
  {
    /* 🔴 Checked against `signup.service.js` before it was written: step 1 holds
       details in a short-lived `PendingSignup`, each channel gets its OWN code,
       and no `users` / `organisations` row exists until both are proved. */
    icon: LockIcon,
    chip: 'Sign-up',
    title: 'Email and phone are both proved',
    body: 'Each gets its own code, and no account exists until both are confirmed — so nobody can register on an address they do not own.',
    image: '/card-signup.jpg',
  },
  {
    /* 🔴 The D7 organisation claim, built 2026-09-23 — `CLAIM_SEAT_TAKEN` in
       `signup.service.js`, and `verification.service.js`: "one company = one
       Organisation, no second KYC, one tick". */
    icon: BuildingIcon,
    chip: 'Organisations',
    title: 'One company, one profile',
    body: 'A colleague signing up joins the company that already exists instead of making a duplicate. One verification, one tick, one public page.',
    image: '/card-organisations.jpg',
  },
];

export function PlatformCards() {
  return (
    /* A plain grid, not the masonry this replaced: every card now has the same
       parts in the same order, so staggering them buys nothing and costs the
       row alignment that makes eight of them scan as a set. */
    <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CARDS.map(({ icon: Icon, chip, title, body, image }) => (
        <li key={title}>
          <article className="flex h-full flex-col rounded-3xl bg-white p-4 shadow-card ring-1 ring-surface-border/70 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <Icon className="h-5 w-5 shrink-0 text-primary-600" aria-hidden="true" />
              <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-700">
                {chip}
              </span>
            </div>

            <h3 className="mt-5 text-balance text-center text-xl font-light uppercase leading-[1.15] tracking-wide text-ink-900 sm:text-[22px]">
              {title}
            </h3>

            <div className="mt-5 overflow-hidden rounded-2xl">
              <img
                src={image}
                alt=""
                loading="lazy"
                width={826}
                height={620}
                /* Decorative: the title says what the card is about, so the
                   picture adds nothing a screen reader needs. */
                className="aspect-[4/3] w-full object-cover"
              />
            </div>

            <p className="mt-4 text-pretty text-center text-[13px] leading-relaxed text-ink-600">
              {body}
            </p>
          </article>
        </li>
      ))}
    </ul>
  );
}
