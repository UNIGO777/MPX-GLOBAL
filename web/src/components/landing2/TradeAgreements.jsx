/**
 * India's trade agreements — the reason a foreign buyer sourcing from India
 * often pays less duty than they expect (owner, 2026-09-26).
 *
 * 🔴 **EVERY ENTRY HERE IS A REAL, IN-FORCE OR SIGNED AGREEMENT.** This is a
 * public marketing page on a platform whose whole value is trust; the same
 * reasoning that kept invented testimonials off this page applies harder to a
 * claim about tariffs, because a buyer can act on it and be wrong at customs.
 * Do not add a country because it would look good in the row.
 *
 * 🔴 **The United States is listed WITHOUT an agreement, on purpose.** India and
 * the US have no free trade agreement — they have talks. The photograph on this
 * section is of an India–US meeting, and putting it above a list headed "free
 * trade agreements" would imply one exists. The copy names the US as what it
 * actually is: a very large trading partner, no FTA.
 *
 * ⚠️ These dates go stale. India signs agreements; this list does not update
 * itself. Check before a launch, and treat anything you cannot confirm from a
 * government source as not ready to publish.
 */
const AGREEMENTS = [
  { place: 'United Arab Emirates', deal: 'CEPA', since: 'in force since 2022' },
  { place: 'Australia', deal: 'ECTA', since: 'in force since 2022' },
  { place: 'United Kingdom', deal: 'FTA', since: 'signed 2025' },
  { place: 'Japan', deal: 'CEPA', since: 'in force since 2011' },
  { place: 'South Korea', deal: 'CEPA', since: 'in force since 2010' },
  { place: 'ASEAN', deal: 'FTA', since: 'in force since 2010' },
  {
    place: 'EFTA',
    deal: 'TEPA',
    since: 'signed 2024',
    note: 'Switzerland, Norway, Iceland, Liechtenstein',
  },
];

export function TradeAgreements() {
  return (
    <section className="bg-white py-14 sm:py-20">
      {/* 🔴 The page's own gutters — `px-4 sm:px-6 lg:px-10 xl:px-16`, no
          `max-w-7xl mx-auto`. This section had the extra centred cap, which made
          it visibly narrower than the strip above and the categories below on a
          wide screen: a band that steps inward for one section reads as a
          mistake, not as emphasis (owner, 2026-09-26).
          The gutters themselves stay — `web-design.md` requires a side gutter so
          text never touches the screen edge on a phone. */}
      <div className="grid w-full gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-10 xl:px-16">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary-700">
            Why source from India
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
            India has trade agreements with much of the world
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-600 sm:text-base">
            Several of them cut or remove import duty on goods made in India. Whether a particular
            shipment qualifies depends on the product and its certificate of origin — your supplier
            and your customs broker can confirm it for your HS code.
          </p>

          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {AGREEMENTS.map((a) => (
              <li
                key={a.place}
                className="rounded-xl border border-surface-border bg-surface-subtle px-3.5 py-2.5"
              >
                <p className="text-sm font-bold text-ink-900">
                  {a.place}{' '}
                  <span className="font-semibold text-primary-700">{a.deal}</span>
                </p>
                <p className="text-[12.5px] text-ink-600">
                  {a.since}
                  {a.note ? ` · ${a.note}` : ''}
                </p>
              </li>
            ))}
          </ul>

          {/* 🔴 Said plainly rather than left for the photo to imply. The US is
              among India's largest trading partners and there is NO free trade
              agreement — a buyer who assumes otherwise finds out at customs. */}
          <p className="mt-5 max-w-xl text-[13px] leading-relaxed text-ink-500">
            The United States is one of India&apos;s largest trading partners, but the two countries
            have <strong className="font-semibold text-ink-700">no free trade agreement</strong> —
            trade between them runs on ordinary tariffs, and talks continue.
          </p>
        </div>

        <figure className="min-w-0">
          <img
            src="/india-trade-diplomacy.webp"
            alt="India's Prime Minister and the President of the United States shaking hands in front of Indian and American flags"
            width={2754}
            height={1804}
            loading="lazy"
            /* Dimensions are set so the row does not jump when the photo loads
               (web-design.md — no layout shift). */
            className="w-full rounded-2xl object-cover shadow-card"
          />
          <figcaption className="mt-3 text-[12.5px] leading-relaxed text-ink-500">
            India&apos;s trade diplomacy has widened access to major markets over the past decade.
            MPX Global is not affiliated with, or endorsed by, any government or public official.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
