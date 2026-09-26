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
  { label: 'India–UAE CEPA', since: 'in force since 2022' },
  { label: 'India–Australia ECTA', since: 'in force since 2022' },
  { label: 'India–UK FTA', since: 'signed 2025' },
  { label: 'India–Japan CEPA', since: 'in force since 2011' },
  { label: 'India–South Korea CEPA', since: 'in force since 2010' },
  { label: 'India–ASEAN FTA', since: 'in force since 2010' },
  { label: 'India–EFTA TEPA', since: 'signed 2024' },
];

/**
 * 🔴 NOT agreements. Named separately, in ordinary weight, because the owner
 * asked for the US and New Zealand and neither has one — see the file header.
 * Moving a country up into `AGREEMENTS` requires a government source saying the
 * deal is signed or in force, not a headline saying talks went well.
 */
const IN_TALKS = ['the United States', 'New Zealand', 'the European Union'];

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
      <div className="grid w-full gap-8 px-4 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-12 lg:px-10 xl:px-16">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary-700">
            Why source from India
          </p>
          <h2 className="mt-2 text-balance text-3xl font-extrabold leading-[1.1] tracking-tight text-ink-900 sm:text-4xl lg:text-5xl">
            India has trade agreements with much of the world
          </h2>
          <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-ink-600 sm:text-lg lg:text-xl">
            Several of them cut or remove import duty on goods made in India. Whether a particular
            shipment qualifies depends on the product and its certificate of origin — your supplier
            and your customs broker can confirm it for your HS code.
          </p>


          {/* 🔴 Said plainly rather than left for the photo to imply. The US is
              among India's largest trading partners and there is NO free trade
              agreement — a buyer who assumes otherwise finds out at customs. */}
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-ink-500 sm:text-base">
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
            /* 🔴 CAPPED, not just scaled. The photograph is 2754×1804, so at
               half the row it stood far taller than the copy beside it and the
               two sides ended at different heights (owner, 2026-09-27: "make
               image small and make side content more big to make both section
               height similer"). `object-cover` with a max height crops it
               instead of letterboxing, so it keeps its shape. */
            className="max-h-[200px] w-full rounded-2xl object-cover shadow-card lg:max-h-[215px]"
          />
          {/* 🔴 The bold run the owner asked for (2026-09-27), with two of the
              three names they gave CORRECTED — see the note at the top of this
              file, and the reply that went with this change.

              · "India–US Free Trade Agreement" — there is NO such agreement.
                India and the United States have talks. This section's own
                photograph is an India–US meeting, so printing that line in bold
                right under it is the single most misleading thing this page
                could say.
              · "India–NZ free trade agreement" — negotiations, not an agreement.
              · "India–AU" is real and is in the list: ECTA, in force since 2022.

              A buyer can act on a tariff claim and be wrong at customs, which is
              why this file's rule is that every name here is in force or signed.
              Both countries ARE named below, as talks. */}
          <p className="mt-4 text-pretty text-[15px] font-bold leading-relaxed text-ink-900 sm:text-base">
            {AGREEMENTS.map((a, i) => (
              <span key={a.label}>
                {i > 0 && <span className="text-ink-300"> · </span>}
                {/* The date rides along as the `title`, so the claim keeps its
                    evidence even though the run prints names only. */}
                <span title={a.since}>{a.label}</span>
              </span>
            ))}
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-600">
            In force since 2010–2022, except the UK (signed 2025) and EFTA (signed 2024). Talks continue
            with{' '}
            <strong className="font-semibold text-ink-700">
              {IN_TALKS.slice(0, -1).join(', ')} and {IN_TALKS[IN_TALKS.length - 1]}
            </strong>{' '}
            — none of those is a free trade agreement yet.
          </p>

          <figcaption className="mt-3 text-[12.5px] leading-relaxed text-ink-500">
            India&apos;s trade diplomacy has widened access to major markets over the past decade.
            MPX Global is not affiliated with, or endorsed by, any government or public official.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
