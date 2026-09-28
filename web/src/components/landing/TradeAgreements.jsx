/**
 * India's trade agreements — the reason a foreign buyer sourcing from India
 * often pays less duty than they expect (owner, 2026-09-26).
 *
 * 🔴 **EVERY ROW IS A REAL AGREEMENT, SHOWN AT ITS TRUE STAGE.** This is a
 * public marketing page on a platform whose whole value is trust; a buyer can
 * act on a tariff claim and be wrong at customs. Each status below was checked
 * against a government source on 2026-09-28 (listed per row). Do not upgrade a
 * stage ("concluded" → "signed" → "in force") without a new source.
 *
 * 🔴 **Names follow the agreement's real type.** The owner asked for "India–US
 * Free Trade Agreement" (2026-09-28): what exists is a trade deal announced in
 * February 2026 — officially a framework for an INTERIM agreement, with a wider
 * bilateral trade agreement still being negotiated — so it is shown as a
 * "Trade Agreement · Framework", not an FTA. New Zealand's IS an FTA (signed
 * 2026-04-27); Australia's is the ECTA, in force.
 *
 * ⚠️ These go stale — the NZ FTA takes effect 2026-10-20, the EU FTA is still
 * awaiting signature. Re-check before a launch.
 */
const ENTRIES = [
  // Owner's order (2026-09-27): USA, New Zealand, Australia, then the rest.
  //   US — White House fact sheet + PIB, Feb 2026: interim-agreement framework.
  { partner: 'United States', code: 'US', kind: 'Trade Agreement', stage: 'framework', year: 2026 },
  //   NZ — NZ MFAT: FTA concluded Dec 2025, signed 27 Apr 2026 (in force 20 Oct 2026).
  { partner: 'New Zealand', code: 'NZ', kind: 'FTA', stage: 'signed', year: 2026 },
  { partner: 'Australia', code: 'AU', kind: 'ECTA', stage: 'in force', year: 2022 },
  { partner: 'UAE', code: 'UAE', kind: 'CEPA', stage: 'in force', year: 2022 },
  { partner: 'UK', code: 'UK', kind: 'FTA', stage: 'signed', year: 2025 },
  { partner: 'Japan', code: 'JP', kind: 'CEPA', stage: 'in force', year: 2011 },
  { partner: 'South Korea', code: 'KR', kind: 'CEPA', stage: 'in force', year: 2010 },
  { partner: 'ASEAN', code: 'ASEAN', kind: 'FTA', stage: 'in force', year: 2010 },
  { partner: 'EFTA', code: 'EFTA', kind: 'TEPA', stage: 'signed', year: 2024 },
  //   EU — India Ministry of Commerce, 27 Jan 2026: FTA concluded, not yet signed.
  { partner: 'European Union', code: 'EU', kind: 'FTA', stage: 'concluded', year: 2026 },
];

/**
 * The partners as PILLS (owner, 2026-09-28: "remove the timeline and make the
 * countries and trade agreements as pills"). The stage + year are not shown;
 * ENTRIES keeps both, with their sources, so a stage can be shown again
 * without re-research.
 */
function PartnerPills() {
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {ENTRIES.map((e, i) => (
        <li
          key={e.partner}
          // The owner's three leading partners (USA, NZ, Australia) carry a soft tint.
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13.5px] shadow-sm ring-1 transition duration-200 hover:-translate-y-0.5 hover:shadow-card motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
            i < 3 ? 'bg-primary-50/70 ring-primary-100' : 'bg-white ring-ink-200/80'
          }`}
        >
          <span className="font-semibold text-ink-900">{e.partner}</span>
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-primary-500" />
          <span className="text-ink-600">{e.kind}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * 2026-09-28 — BACK TO THE LIGHT LAYOUT (owner: "the background and its colours
 * are not good — make it as previous, image on right and the description on
 * left, old design, and keep a separate section for the video"). A dark
 * "chapter" version was tried and rejected the same day.
 *   · Left  — eyebrow, heading, the duty paragraph, the US note, and the
 *             agreements as pills.
 *   · Right — the handshake photo, large, with its caption (the independence
 *             line stays: a political photo on a commercial page must not read
 *             as an endorsement).
 * Phones: text, pills, then the photo. The MPX film has its own section after
 * this one (Landing.jsx).
 */
export function TradeAgreements() {
  return (
    <section aria-labelledby="india-heading" className="bg-white py-12 sm:py-16 lg:py-20">
      <div className="grid w-full items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14 lg:px-10 xl:px-16 2xl:grid-cols-[minmax(0,1fr)_700px] 2xl:gap-20">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700">Why source from India</p>
          <h2 id="india-heading" className="mt-1.5 text-balance text-2xl font-extrabold leading-[1.12] tracking-tight text-ink-900 sm:text-3xl lg:text-4xl 2xl:text-5xl">
            India trades on <span className="text-primary-600">preferential terms</span> with major markets
          </h2>
          {/* Duty relief is conditional, and the sentence says so. */}
          <p className="mt-3 max-w-xl text-pretty text-[15px] leading-relaxed text-ink-600 sm:text-base 2xl:mt-4 2xl:max-w-2xl 2xl:text-[17px]">
            India&apos;s trade agreements can lower or remove import duty on Indian-made goods.
            Eligibility depends on the product and its certificate of origin — your supplier and
            customs broker can confirm it for your HS code.
          </p>
          <div className="mt-5 flex max-w-xl gap-3 rounded-2xl bg-ink-50/80 p-4 ring-1 ring-ink-200/60 2xl:max-w-2xl">
            <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary-500 shadow-[0_0_0_4px_theme(colors.primary.100)]" />
            <p className="text-[13.5px] leading-relaxed text-ink-600">
              <span className="mb-0.5 block text-[10.5px] font-semibold uppercase tracking-[0.14em] text-primary-700">February 2026</span>
              The United States and India announced a trade deal that lowers US tariffs on many Indian
              goods, and talks on a wider bilateral agreement continue.
            </p>
          </div>

          <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">Agreements with</p>
          <PartnerPills />
        </div>

        <figure className="group w-full min-w-0 lg:max-w-[700px] lg:justify-self-end">
          {/* A soft tinted block offset behind the photo gives it depth. */}
          <div className="relative isolate">
            <span aria-hidden="true" className="absolute -bottom-3 -left-3 -z-10 h-[88%] w-[88%] rounded-3xl bg-gradient-to-br from-primary-100 to-primary-50 sm:-bottom-4 sm:-left-4" />
            <div className="overflow-hidden rounded-3xl shadow-[0_30px_60px_-30px_rgb(0_5_23/0.45)] ring-1 ring-black/5">
              <img
                src="/india-trade-diplomacy.webp"
                alt="India's Prime Minister and the President of the United States shaking hands in front of Indian and American flags"
                width={1244}
                height={822}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover object-[46%_40%] transition-transform duration-[1400ms] ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
              />
            </div>
          </div>
          <figcaption className="mt-6 border-l-2 border-primary-600 pl-3 sm:mt-7">
            <span className="block text-[13px] font-medium leading-snug text-ink-800">
              India&apos;s trade diplomacy is opening new markets for Indian exporters.
            </span>
            <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-500">
              MPX Global is an independent B2B marketplace.
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
