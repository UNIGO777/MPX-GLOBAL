import { formatMinor } from './money.js';
import { formatDate } from './format.js';

/**
 * The quotation as a real, text-based PDF.
 *
 * 🔴 Built from the SERVER'S FROZEN SNAPSHOT — the same `quotation` object the
 * on-screen document renders from. That is what stops this becoming a second
 * source of truth: the layout here is its own, but every figure, both companies
 * and the bank details come from one place, so the PDF and the page can differ
 * in appearance and can never differ in what they SAY.
 *
 * 🔴 Real text, not a screenshot. A rasterised quotation looks the same but the
 * buyer cannot copy an account number out of it, cannot search it, and it prints
 * soft. On a document someone pays against, that matters more than pixel parity.
 *
 * `pdfmake` is loaded DYNAMICALLY — it and its fonts are ~1 MB, and nobody who
 * never presses Download should pay for them on first paint.
 */
/**
 * The supplied design's palette, not the app's. The document is printed and
 * leaves the platform, so it carries the brand rather than the UI: navy ink on
 * ivory rules, one red accent, and NO reliance on colour to convey meaning —
 * every block is labelled, so a mono print loses nothing.
 */
const NAVY = '#0B1F3A';
const RED = '#B3122B';
const INK = '#3E4859';
const MUTED = '#5B6577';
const LINE = '#D9D4C7';
const IVORY = '#F4F2EC';

const PAGE_W = 515; // A4 (595pt) minus 40pt margins each side

/** The masthead rule: navy band with a red leading segment. */
const stripe = () => ({
  margin: [0, 0, 0, 14],
  canvas: [
    { type: 'rect', x: 0, y: 0, w: PAGE_W, h: 5, color: NAVY },
    { type: 'rect', x: 0, y: 0, w: 90, h: 5, color: RED },
  ],
});

/** A labelled cell — the document's one repeated unit. */
const cell = (label, value, opts = {}) => ({
  stack: [
    { text: String(label).toUpperCase(), fontSize: 6.5, color: MUTED, characterSpacing: 0.8 },
    { text: value ?? '—', bold: true, fontSize: 9.5, margin: [0, 1, 0, 0], ...opts },
  ],
});

const party = (title, p) => {
  if (!p) return { text: '' };
  const where = [p.address, p.city, p.state, p.postcode, p.country].filter(Boolean).join(', ');
  const ids = [p.gstin && `GSTIN ${p.gstin}`, p.iec && `IEC ${p.iec}`, p.taxId].filter(Boolean).join(' · ');
  return {
    stack: [
      { text: title.toUpperCase(), fontSize: 7, color: MUTED, characterSpacing: 1 },
      { text: p.name ?? '', bold: true, fontSize: 11, margin: [0, 2, 0, 1] },
      where ? { text: where, fontSize: 8.5, color: MUTED } : null,
      ids ? { text: ids, fontSize: 8.5, color: MUTED } : null,
      p.contactName ? { text: `Contact: ${p.contactName}`, fontSize: 8.5, color: MUTED } : null,
    ].filter(Boolean),
  };
};

/** `validUntil` in the past — stated on the document, not left to the reader. */
export const isExpired = (q) => Boolean(q.validUntil) && new Date(q.validUntil) < new Date();
const expired = isExpired;

/**
 * The shipping strip's filled cells. Empty ones are dropped, never dashed.
 *
 * Exported so the on-screen PAPER PREVIEW builds this strip from the same
 * function the PDF does — two copies of "which terms appear and in what order"
 * is how the preview and the file start showing different documents.
 */
export const shippingStrip = (q) =>
  [
    ['Incoterm', q.incoterm],
    ['Loading', q.portOfLoading],
    ['Discharge', q.portOfDischarge],
    ['Lead time', q.leadTime],
  ].filter(([, v]) => v);
const strip = shippingStrip;

/**
 * "Total (CIF Jebel Ali)" when the terms say where the price gets the goods to.
 * A bare "Total" on an export quotation is the question the buyer asks next.
 */
const totalLabel = (q) =>
  q.incoterm
    ? `Total (${q.incoterm.split(' ')[0]}${q.portOfDischarge ? ` ${q.portOfDischarge.split(',')[0]}` : ''})`
    : 'Total';

/** Payment schedule and delivery, as ruled boxes. Either may be absent. */
const boxes = (q, t, money) => {
  const make = (title, rows, note) => ({
    width: '*',
    table: {
      widths: ['*'],
      body: [[
        {
          stack: [
            { text: title.toUpperCase(), fontSize: 6.5, color: MUTED, characterSpacing: 0.8 },
            ...rows.map(([k, v]) => ({
              columns: [
                { text: k, fontSize: 8.5, color: INK },
                { text: v, fontSize: 8.5, bold: true, alignment: 'right', width: 'auto' },
              ],
              margin: [0, 4, 0, 0],
            })),
            ...(note ? [{ text: note, fontSize: 8, color: MUTED, margin: [0, 6, 0, 0] }] : []),
          ],
          margin: [10, 8, 10, 9],
        },
      ]],
    },
    layout: {
      hLineWidth: () => 0.7,
      vLineWidth: () => 0.7,
      hLineColor: () => LINE,
      vLineColor: () => LINE,
    },
  });

  const out = [];
  if ((t.payments ?? []).length) {
    out.push(make('Payment schedule', t.payments.map((p) => [p.label, money(p.amountMinor)]), q.payment?.note));
  }
  if ((q.delivery?.rows ?? []).length) {
    out.push(make('Delivery', q.delivery.rows.map((r) => [r.label, r.value]), q.delivery.note));
  }
  return out;
};

/**
 * "Rupees Twenty-Four Lakh Eighty-Five Thousand Only".
 *
 * 🔴 Words beside the figure is not decoration on a priced document — it is the
 * long-standing guard against a digit being altered on a printed copy, and it is
 * what the supplied design asked for. INDIAN grouping for INR (lakh, crore),
 * international grouping otherwise; the two systems say different things about
 * the same number.
 */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const below100 = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ''));
const below1000 = (n) =>
  [Math.floor(n / 100) ? `${ONES[Math.floor(n / 100)]} Hundred` : '', n % 100 ? below100(n % 100) : '']
    .filter(Boolean)
    .join(' ');

function indianWords(n) {
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 1e7);
  const lakh = Math.floor((n % 1e7) / 1e5);
  const thousand = Math.floor((n % 1e5) / 1e3);
  const rest = n % 1e3;
  return [
    crore ? `${crore >= 100 ? indianWords(crore) : below100(crore)} Crore` : '',
    lakh ? `${below100(lakh)} Lakh` : '',
    thousand ? `${below100(thousand)} Thousand` : '',
    rest ? below1000(rest) : '',
  ].filter(Boolean).join(' ');
}

function internationalWords(n) {
  if (n === 0) return 'Zero';
  const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];
  const parts = [];
  for (let i = 0; n > 0; i += 1, n = Math.floor(n / 1000)) {
    const chunk = n % 1000;
    if (chunk) parts.unshift([below1000(chunk), scales[i]].filter(Boolean).join(' '));
  }
  return parts.join(' ');
}

const MAJOR_NAME = { INR: 'Rupees', USD: 'US Dollars', EUR: 'Euros', AED: 'UAE Dirhams', GBP: 'Pounds Sterling', AUD: 'Australian Dollars' };
const MINOR_NAME = { INR: 'Paise' };

export function amountInWords(minor, currency) {
  if (minor == null) return '';
  const words = currency === 'INR' ? indianWords : internationalWords;
  const whole = Math.floor(minor / 100);
  const frac = minor % 100;
  const major = MAJOR_NAME[currency] ?? currency ?? '';
  const minorName = MINOR_NAME[currency] ?? 'Cents';
  return `${major} ${words(whole)}${frac ? ` and ${below100(frac)} ${minorName}` : ''} Only`.trim();
}

/**
 * The real MPX Global mark, inlined (owner, 2026-09-25).
 *
 * 🔴 pdfmake needs the BYTES — a `/brand-logo.png` path means nothing inside a
 * PDF, and a URL would leave the document depending on our server still serving
 * that file years later. It is fetched once per session and cached as a data
 * URI, so a quotation carries its own artwork.
 *
 * 🔴 It never fails the download. If the fetch or the encode fails, the masthead
 * falls back to the typed wordmark — the document is still correct, and a
 * missing logo is not a reason to hand someone nothing.
 */
const LOGO_SRC = '/brand-logo.png';
// Measured from the artwork (1200×597); at 108pt wide the mark sits about the
// same height as the "QUOTATION" opposite it.
const LOGO_W = 108;
let logoPromise = null;

async function loadLogo() {
  if (!logoPromise) {
    logoPromise = (async () => {
      const res = await fetch(LOGO_SRC);
      if (!res.ok) throw new Error(`logo ${res.status}`);
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error('logo read failed'));
        reader.readAsDataURL(blob);
      });
    })().catch(() => null); // cached as "unavailable", not retried per download
  }
  return logoPromise;
}

/** The typed wordmark — the fallback, and what every quotation printed before. */
const wordmark = () => ({
  stack: [
    { text: [{ text: 'MP' }, { text: 'X', color: RED }], bold: true, fontSize: 20, characterSpacing: -0.3 },
    { text: 'G L O B A L', fontSize: 6, color: MUTED, characterSpacing: 2, margin: [0, 1, 0, 0] },
  ],
});

function buildDoc(q, logo) {
  const t = q.totals ?? {};
  const cur = q.currency;
  const money = (m) => formatMinor(m, cur);

  const itemRows = (t.lines ?? q.items ?? []).map((l, i) => [
    { text: String(i + 1), color: MUTED, fontSize: 8.5 },
    {
      stack: [
        { text: l.name ?? '', bold: true, fontSize: 9 },
        l.spec ? { text: l.spec, fontSize: 8, color: MUTED } : null,
      ].filter(Boolean),
    },
    { text: l.hsCode || '—', fontSize: 8.5 },
    { text: `${l.qty ?? ''}${l.unit ? ` ${l.unit}` : ''}`, alignment: 'right', fontSize: 9 },
    { text: money(l.rateMinor), alignment: 'right', fontSize: 9 },
    { text: money(l.amountMinor), alignment: 'right', bold: true, fontSize: 9 },
  ]);

  const summary = [
    ['Subtotal', money(t.subtotalMinor)],
    ...(t.charges ?? []).map((c) => [c.label, c.included ? 'Included' : money(c.amountMinor)]),
    ...(t.taxes ?? []).map((x) => [x.label, money(x.amountMinor)]),
  ];

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 60],
    defaultStyle: { fontSize: 9, color: NAVY, lineHeight: 1.25 },

    // Every page carries the number and "page x of y" — a loose page of a
    // priced document must be identifiable on its own.
    footer: (page, pages) => ({
      margin: [40, 12, 40, 0],
      columns: [
        {
          text:
            'Issued by the supplier through MPX Global. MPX Global is a marketplace and is not a party to this quotation or any resulting contract.',
          fontSize: 6.5,
          color: MUTED,
          width: '*',
        },
        { text: `${q.number} · ${page} / ${pages}`, fontSize: 6.5, color: MUTED, alignment: 'right', width: 'auto' },
      ],
    }),

    content: [
      stripe(),

      // Masthead — wordmark left, the document's own name right, with the
      // validity stated next to it rather than buried in the meta row.
      {
        columns: [
          logo
            ? { image: logo, width: LOGO_W, margin: [0, 2, 0, 0] }
            : wordmark(),
          {
            width: 'auto',
            stack: [
              { text: 'QUOTATION', fontSize: 22, bold: true, alignment: 'right', characterSpacing: 2.5 },
              {
                text: `${expired(q) ? 'Expired' : 'Valid until'} ${formatDate(q.validUntil) || '—'}`,
                fontSize: 8.5,
                color: expired(q) ? RED : '#0B6B45',
                bold: true,
                alignment: 'right',
                margin: [0, 3, 0, 0],
              },
            ],
          },
        ],
      },

      // Meta — four cells in one ruled box, as the design draws it.
      {
        margin: [0, 14, 0, 0],
        table: {
          widths: ['*', '*', '*', '*'],
          body: [[
            cell('Quote no.', q.number),
            cell('Issue date', formatDate(q.issueDate)),
            cell('Revision', `R${q.revision ?? 1}`),
            cell('Currency', cur),
          ]],
        },
        layout: {
          hLineWidth: () => 0.7,
          vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length ? 0.7 : 0.7),
          hLineColor: () => LINE,
          vLineColor: () => LINE,
          paddingTop: () => 6,
          paddingBottom: () => 6,
          paddingLeft: () => 8,
          paddingRight: () => 8,
        },
      },

      { margin: [0, 14, 0, 0], columns: [party('From · Supplier', q.supplier), party('To · Buyer', q.buyer)], columnGap: 18 },

      // Shipping strip — ivory, so it separates the terms from the parties
      // without another rule.
      ...(strip(q).length
        ? [{
            margin: [0, 14, 0, 0],
            table: { widths: strip(q).map(() => '*'), body: [strip(q).map(([k, v]) => cell(k, v))] },
            layout: {
              hLineWidth: () => 0,
              vLineWidth: () => 0,
              fillColor: () => IVORY,
              paddingTop: () => 7,
              paddingBottom: () => 7,
              paddingLeft: () => 9,
              paddingRight: () => 9,
            },
          }]
        : []),

      {
        margin: [0, 16, 0, 0],
        table: {
          headerRows: 1,
          widths: [14, '*', 52, 58, 62, 72],
          body: [
            [
              { text: '#', style: 'th' },
              { text: 'DESCRIPTION', style: 'th' },
              { text: 'HS CODE', style: 'th' },
              { text: 'QTY', style: 'th', alignment: 'right' },
              { text: `RATE`, style: 'th', alignment: 'right' },
              { text: `AMOUNT`, style: 'th', alignment: 'right' },
            ],
            ...itemRows,
          ],
        },
        layout: {
          // Navy above and below the header, hairline between rows — the
          // design's own table voice.
          hLineWidth: (i) => (i === 0 ? 1.6 : i === 1 ? 0.8 : 0.5),
          vLineWidth: () => 0,
          hLineColor: (i) => (i <= 1 ? NAVY : '#E6E2D8'),
          paddingTop: () => 6,
          paddingBottom: () => 6,
          paddingLeft: (i) => (i === 0 ? 0 : 4),
          paddingRight: (i, node) => (i === node.table.widths.length - 1 ? 0 : 4),
        },
      },

      {
        margin: [0, 12, 0, 0],
        columns: [
          {
            width: '*',
            stack: [
              { text: 'AMOUNT IN WORDS', fontSize: 6.5, color: MUTED, characterSpacing: 0.8 },
              { text: amountInWords(t.totalMinor, cur), fontSize: 9, margin: [0, 2, 0, 0] },
              ...(q.taxNote
                ? [
                    { text: 'NOTE', fontSize: 6.5, color: MUTED, characterSpacing: 0.8, margin: [0, 8, 0, 0] },
                    { text: q.taxNote, fontSize: 8.5, color: INK, margin: [0, 2, 0, 0] },
                  ]
                : []),
            ],
          },
          {
            width: 215,
            table: {
              widths: ['*', 'auto'],
              body: [
                ...summary.map(([k, v]) => [
                  { text: k, color: INK, fontSize: 9, margin: [0, 2, 0, 2] },
                  { text: v, alignment: 'right', fontSize: 9, margin: [0, 2, 0, 2] },
                ]),
                [
                  { text: totalLabel(q), bold: true, color: '#fff', fillColor: NAVY, margin: [8, 7, 4, 7] },
                  { text: money(t.totalMinor), bold: true, fontSize: 13, alignment: 'right', color: '#fff', fillColor: NAVY, margin: [4, 6, 8, 7] },
                ],
              ],
            },
            layout: {
              hLineWidth: (i, node) => (i === node.table.body.length - 1 ? 0.8 : 0),
              vLineWidth: () => 0,
              hLineColor: () => LINE,
            },
          },
        ],
        columnGap: 18,
      },

      // Payment and delivery, side by side in ruled boxes.
      ...(boxes(q, t, money).length
        ? [{ margin: [0, 16, 0, 0], columns: boxes(q, t, money), columnGap: 12 }]
        : []),

      ...(q.additionalDetails
        ? [
            { text: 'ADDITIONAL DETAILS', fontSize: 6.5, color: MUTED, characterSpacing: 0.8, margin: [0, 16, 0, 3] },
            { text: q.additionalDetails, fontSize: 8.5, color: INK },
          ]
        : []),

      ...(q.bank
        ? [
            { text: 'SUPPLIER BANK DETAILS', fontSize: 6.5, color: MUTED, characterSpacing: 0.8, margin: [0, 16, 0, 4] },
            {
              columns: [
                {
                  width: '*',
                  table: {
                    widths: [78, '*'],
                    body: [
                      ['Beneficiary', q.bank.beneficiary],
                      ['Bank', [q.bank.bankName, q.bank.branch].filter(Boolean).join(', ')],
                      ['Account no.', q.bank.accountNumber ?? q.bank.masked],
                      ['SWIFT / IFSC', [q.bank.swift, q.bank.ifsc].filter(Boolean).join(' / ')],
                    ].map(([k, v]) => [
                      { text: k, color: MUTED, fontSize: 8.5, margin: [0, 1.5, 0, 1.5] },
                      { text: v || '—', fontSize: 8.5, bold: true, margin: [0, 1.5, 0, 1.5] },
                    ]),
                  },
                  layout: 'noBorders',
                },
                {
                  width: 200,
                  table: {
                    widths: ['*'],
                    body: [[{
                      // 🔴 Travels WITH the document. It leaves the platform, and
                      // an altered copy does its damage exactly where we cannot
                      // see it.
                      stack: [
                        { text: 'BEFORE YOU PAY', bold: true, fontSize: 8, color: '#5A0F1C' },
                        {
                          text: 'Confirm these details with the supplier in MPX chat. Never pay to details sent by email alone, and treat any request to change them as a warning sign.',
                          fontSize: 7.5,
                          color: '#5A0F1C',
                          margin: [0, 3, 0, 0],
                        },
                      ],
                      fillColor: '#FBEDEF',
                      margin: [9, 9, 9, 9],
                    }]],
                  },
                  layout: 'noBorders',
                },
              ],
              columnGap: 12,
            },
          ]
        : []),
    ],

    styles: {
      th: { fontSize: 6.5, color: MUTED, characterSpacing: 0.8, bold: false },
    },
  };
}

/** Builds the PDF and downloads it as `MPX-Q-….pdf`. */
export async function downloadQuotationPdf(quotation) {
  const [pdfModule, fontModule] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  const pdfMake = pdfModule.default ?? pdfModule;

  /**
   * 🔴 pdfmake 0.3 changed this, and the 0.2 recipe fails SILENTLY.
   *
   * In 0.2 you assigned `pdfMake.vfs = fonts.pdfMake.vfs`. In 0.3 the fonts
   * module exports the file map DIRECTLY (keys are "Roboto-Medium.ttf", there is
   * no `.vfs` wrapper) and registration goes through `addVirtualFileSystem`.
   * Verified against the installed build rather than copied from a tutorial:
   * the old form leaves `vfs` undefined and the download just never happens.
   */
  const vfs = fontModule.default ?? fontModule;
  if (typeof pdfMake.addVirtualFileSystem === 'function') {
    pdfMake.addVirtualFileSystem(vfs);
  } else {
    pdfMake.vfs = vfs;
  }

  // In parallel with the library import above it would be tidier, but the logo
  // is cached after the first call and the fonts dominate either way.
  const logo = await loadLogo();
  const name = `${quotation.number}.pdf`;

  /**
   * 🔴 The logo must never be able to cost someone their document. A PNG that
   * PDFKit cannot decode throws from inside the build, so a failure here retries
   * WITHOUT the artwork and prints the typed wordmark instead. Only a failure of
   * the plain build is a real failure worth surfacing.
   */
  try {
    pdfMake.createPdf(buildDoc(quotation, logo)).download(name);
  } catch {
    pdfMake.createPdf(buildDoc(quotation, null)).download(name);
  }
}
