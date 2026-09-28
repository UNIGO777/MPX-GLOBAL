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
  { partner: 'United States', kind: 'Trade Agreement', stage: 'framework', year: 2026 },
  //   NZ — NZ MFAT: FTA concluded Dec 2025, signed 27 Apr 2026 (in force 20 Oct 2026).
  { partner: 'New Zealand', kind: 'FTA', stage: 'signed', year: 2026 },
  { partner: 'Australia', kind: 'ECTA', stage: 'in force', year: 2022 },
  { partner: 'UAE', kind: 'CEPA', stage: 'in force', year: 2022 },
  { partner: 'UK', kind: 'FTA', stage: 'signed', year: 2025 },
  { partner: 'Japan', kind: 'CEPA', stage: 'in force', year: 2011 },
  { partner: 'South Korea', kind: 'CEPA', stage: 'in force', year: 2010 },
  { partner: 'ASEAN', kind: 'FTA', stage: 'in force', year: 2010 },
  { partner: 'EFTA', kind: 'TEPA', stage: 'signed', year: 2024 },
  //   EU — India Ministry of Commerce, 27 Jan 2026: FTA concluded, not yet signed.
  { partner: 'European Union', kind: 'FTA', stage: 'concluded', year: 2026 },
];

/** Pill wording and colour per stage — green in force, amber signed, grey earlier. */
const STAGE = {
  'in force': { label: 'In force', tone: 'bg-success-50 text-success-700' },
  signed: { label: 'Signed', tone: 'bg-warning-50 text-warning-700' },
  concluded: { label: 'Concluded', tone: 'bg-ink-100 text-ink-700' },
  framework: { label: 'Framework', tone: 'bg-ink-100 text-ink-700' },
};

/**
 * The agreements list. Each cell stacks (name, type, then pill) until there is
 * room for one line: from sm when the list runs full width, but only from xl
 * when it sits in the text column beside the photo (lg) — at 1024–1279 that
 * column is too narrow and "United States Trade Agreement" wrapped mid-name.
 */
const LAYOUT = {
  sm: {
    li: 'sm:flex-row sm:items-center sm:justify-between sm:gap-3',
    inline: 'sm:inline',
    gap: 'sm:ml-2',
    type: 'sm:text-[13px]',
    name: 'sm:text-[15px]',
    pill: 'sm:px-2.5 sm:py-1 sm:text-[11.5px]',
  },
  // One line on a tablet (full width) and from xl. On a small laptop (lg,
  // beside the photo) the pill stays on the right and only the TYPE drops
  // under the name — two lines per entry, not three (owner, 2026-09-28: "too
  // much empty space").
  mixed: {
    li: 'sm:flex-row sm:items-center sm:justify-between sm:gap-3',
    inline: 'sm:inline lg:block xl:inline',
    gap: 'sm:ml-2 lg:ml-0 xl:ml-2',
    type: 'sm:text-[13px] lg:text-[12.5px] xl:text-[13px]',
    name: 'sm:text-[15px]',
    pill: 'sm:px-2.5 sm:py-1 sm:text-[11.5px]',
  },
  xl: {
    li: 'xl:flex-row xl:items-center xl:justify-between xl:gap-3',
    inline: 'xl:inline',
    gap: 'xl:ml-2',
    type: 'lg:text-[12.5px] xl:text-[13px]',
    name: 'lg:text-[15px]',
    pill: 'lg:px-2.5 lg:py-1 lg:text-[11.5px]',
  },
};

function AgreementList({ className = '', oneLineFrom = 'sm' }) {
  const L = LAYOUT[oneLineFrom];
  return (
    <ul className={`grid grid-cols-2 gap-x-4 border-t border-ink-100 sm:gap-x-8 ${className}`}>
      {ENTRIES.map((e) => (
        <li key={e.partner} className={`flex flex-col items-start gap-1.5 border-b border-ink-100 py-3 lg:py-2 xl:py-3 ${L.li}`}>
          <span className="min-w-0">
            <span className={`block text-[14px] font-semibold text-ink-900 ${L.inline} ${L.name}`}>{e.partner}</span>
            <span className={`block text-[12px] text-ink-500 ${L.inline} ${L.gap} ${L.type}`}>{e.kind}</span>
          </span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${L.pill} ${STAGE[e.stage].tone}`}>
            {STAGE[e.stage].label} · {e.year}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function TradeAgreements() {
  return (
    <section aria-labelledby="india-heading" className="bg-white py-10 sm:py-14 lg:py-16">
      {/* 2026-09-27 redesign (owner: "super premium"). The agreements are a
          list (partner · type · status) instead of a bold run of names that
          broke mid-name, in the owner's order (see ENTRIES), running full width
          under the text + photo row. Facts: see the file header — every
          status is sourced. */}
      <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-16">
        {/* Three grid items, placed differently by width (owner, 2026-09-28):
            phones and tablets stack text → photo → list; lg+ puts text over
            list in the left column and the photo on the right, spanning both
            rows. */}
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:grid-rows-[auto_1fr] lg:gap-x-10 lg:gap-y-0 xl:grid-cols-[1.25fr_0.75fr] xl:gap-x-12">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700">
            Why source from India
          </p>
          <h2 id="india-heading" className="mt-1.5 text-balance text-2xl font-extrabold leading-[1.12] tracking-tight text-ink-900 sm:text-3xl lg:text-4xl">
            India trades on preferential terms with major markets
          </h2>
          {/* Copy polished 2026-09-27 (owner). Every claim is unchanged in
              substance: duty relief is conditional, and the sentence says so. */}
          <p className="mt-3 max-w-2xl text-pretty text-[15px] leading-relaxed text-ink-600 sm:text-base">
            India&apos;s trade agreements can lower or remove import duty on Indian-made goods.
            Eligibility depends on the product and its certificate of origin — your supplier and
            customs broker can confirm it for your HS code.
          </p>

          {/* Updated 2026-09-28: the old line ("no free trade agreement…
              standard tariffs") was overtaken by the February 2026 deal. */}
          <p className="mt-5 max-w-2xl text-[13.5px] leading-relaxed text-ink-500">
            The United States and India announced a trade deal in February 2026 that lowers US
            tariffs on many Indian goods, and talks on a wider bilateral agreement continue.
          </p>
        </div>

        <figure className="flex min-w-0 flex-col lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start xl:self-stretch">
          <img
            src="/india-trade-diplomacy.webp"
            alt="India's Prime Minister and the President of the United States shaking hands in front of Indian and American flags"
            width={1244}
            height={822}
            loading="lazy"
            /* Width and height stop the row jumping as it loads (web-design.md).
               xl+: it fills the text column's height so both sides end together.
               lg (1024–1279): side by side too, in a TALL 5:6 frame (owner,
               2026-09-28: "why reducing length of image"), cropped at 46% across
               so both faces stay in — a full-column stretch cut them out.
               Below lg: 4:3, between the text and the list. */
            className="aspect-[4/3] w-full rounded-3xl object-cover shadow-card ring-1 ring-black/5 lg:aspect-[5/6] lg:object-[46%_50%] xl:aspect-auto xl:min-h-0 xl:flex-1 xl:object-center"
          />
          {/* Rewritten 2026-09-28 (owner): the old two-sentence caption read
              heavy. The independence line stays — a political photo on a
              commercial page must not read as an endorsement. */}
          <figcaption className="mt-3 border-l-2 border-primary-600 pl-3">
            <span className="block text-[13px] font-medium leading-snug text-ink-800">
              India&apos;s trade diplomacy is opening new markets for Indian exporters.
            </span>
            <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-500">
              MPX Global is an independent B2B marketplace.
            </span>
          </figcaption>
        </figure>

        <AgreementList className="-mt-2 min-w-0 lg:col-start-1 lg:row-start-2 lg:mt-4 lg:self-start xl:mt-6" oneLineFrom="mixed" />
        </div>

      </div>
    </section>
  );
}
