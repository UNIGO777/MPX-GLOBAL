/** @type {import('tailwindcss').Config} */

// Colour tokens live HERE, in the theme — never as magic hex/px in components
// (rule: web-design.md). Use the tokens: bg-primary-600, text-ink-700, text-muted,
// border-surface-border, text-success, etc. Add a new colour to this file, once.
//
// NOTE: these are professional "high-tech" STARTER values — confirm the final brand
// palette with the owner before launch. The token *names* are the contract; swap the
// hex values here and the whole app follows.
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 🔴 CRIMSON — landing-page trial only (owner, 2026-08-23: "where we
        // have implemented the blue color there implement red, web only for
        // now"). Shade-for-shade parallel to `primary` below, so the landing
        // swap is mechanical and reversing it is a find-and-replace.
        //
        // ⚠️ NOT the brand colour. The logo, the app, the admin console and
        // every other web page remain royal blue, so a page using this sits
        // beside a blue wordmark. Flagged to the owner; if crimson is adopted as
        // the brand, `primary` itself changes and this scale is deleted rather
        // than kept as a second brand.
        //
        // Named `crimson`, NOT `red`: Tailwind's default `red-50`/`red-700` are
        // already used elsewhere in this codebase, and extending `red` would
        // silently repaint them. Distinct from `danger` (#D92D20) on purpose —
        // an error colour must never double as a brand colour, or a destructive
        // warning stops reading as one.
        // 🔴 Anchored on the owner's colour: **#CE061A is `crimson-600`**
        // (2026-08-23). Everything else is derived around it.
        //
        // Why 600 and not a darker slot: white text on #CE061A measures
        // **5.73:1**, which clears WCAG AA, so it can carry the hero and the AI
        // band directly — the requested colour is what the page actually reads
        // as, rather than a dark maroon derived from it. The landing's big fills
        // were moved from `-800` to `-600` for exactly that reason.
        //
        // Why nothing brighter is used for buttons: the next step up
        // (#E8202F) measures **4.49:1** — it fails AA by a hair, and a button
        // label that fails contrast is a real defect, not a style preference.
        // So #CE061A is the lightest red that carries white text here.
        crimson: {
          50: '#FFF0F1',
          100: '#FFDBDE',
          200: '#FFB3BA',
          300: '#FA808D',
          400: '#EE4657',
          500: '#E01329',
          600: '#CE061A', // ← the owner's colour. Actions AND the hero/band fill.
          700: '#AE0416', // hover, and links on white (7.42:1)
          800: '#8A0311', // pressed / deepest surfaces (9.99:1)
          900: '#66020C',
        },

        // Brand / primary — RED, adopted platform-wide (owner, 2026-09-22:
        // "we will follow the theme and pallet of landing page"). The values are
        // the `crimson` ramp above, verbatim: the landing page had already been
        // built and approved in this palette, so promoting it to `primary` makes
        // the rest of the web match a surface the owner has actually seen,
        // rather than a new red nobody has looked at.
        //
        // ⚠️ WAS ROYAL BLUE (#2A4DE0 / navy #1A2E8F) until 2026-09-22. Every
        // m1-webscreens and m2-webscreens mockup is still blue — the mockups are
        // NOT the colour authority any more, this file is. Do not "restore" blue
        // to match a mockup.
        //
        // primary-600 = actions · primary-700 = hover and links on white
        // (7.42:1) · primary-800 = deepest surfaces, the sidebar and hero panels
        // that used to be brand navy.
        //
        // 🔴 The logo keeps its navy (#1A2E8F — it was this file's old
        // primary-800) alongside its red. That is why no `Logo` variant changed:
        // `variant="white"` already covers dark surfaces, which the sidebar and
        // auth panels still are, and the navy-and-red mark on white still reads
        // correctly in the public header. If a navy is ever needed as a UI
        // colour again, add it as its own token — do NOT reach back into
        // `primary`.
        primary: {
          50: '#FFF0F1',
          100: '#FFDBDE',
          200: '#FFB3BA',
          300: '#FA808D',
          400: '#EE4657',
          500: '#E01329',
          600: '#CE061A', // the owner's colour — actions
          700: '#AE0416', // hover, links on white (7.42:1)
          800: '#8A0311', // pressed / sidebar / hero panels (9.99:1)
          900: '#66020C',
          DEFAULT: '#CE061A',
        },
        // Neutral ink — text (ink-900 = #000517, the mockups' "mpx-text")
        ink: {
          50: '#F7F8FB',
          100: '#F2F4F7',
          200: '#E2E4EC',
          300: '#C5C6CF',
          400: '#98A2B3',
          500: '#667085',
          600: '#5A6B85',
          700: '#344054',
          800: '#1A1B24',
          900: '#000517',
          DEFAULT: '#000517',
        },
        // Surfaces — canvas behind cards is a warm near-white tint, cards are
        // white, hairlines are the mockups' #C5C6CF.
        //
        // 🔴 `subtle` and `unread` were PALE BLUES (#EAEEFF / #E1E3FF) derived
        // from the old blue brand. They moved with the red theme on 2026-09-22
        // and this was not cosmetic: `subtle` is the canvas behind EVERY card in
        // all four consoles (62 usages), so leaving it blue would have sat the
        // entire red product on a blue wash — the one token that would have made
        // the swap look like a mistake rather than a decision.
        surface: {
          DEFAULT: '#ffffff',
          // 🔴 The landing hero's page ground (owner's mockup, 2026-09-23). A WARM
          // off-white, deliberately NOT `ink-50` (#F7F8FB): the ink scale carries a
          // blue cast, which fights a red brand — together they read cold and slightly
          // dirty. One token, one reason (web-design.md).
          canvas: '#F5F2EF',
          // 🔴 A NEUTRAL light grey for INSET panels — the block inside a card
          // (key attributes, a price box, a fact tile), never a page ground.
          // Owner-chosen (#f8f8f8, 2026-09-23): "for the bg use white but in
          // some places use this color".
          //
          // It is its own token rather than a reuse of the two above, and that
          // is the whole point:
          //   · `canvas` (#F5F2EF) is WARM and is a page ground — used as an
          //     inset it reads beige against white, not as a recess.
          //   · `subtle` (#FDF4F4) carries the brand's red tint and is the
          //     canvas behind every card in all four consoles (62 usages), so
          //     repointing it to a neutral grey would repaint the whole product.
          // This one is deliberately hue-free: it recedes under white without
          // adding a third colour cast to a page that already has red and navy.
          panel: '#F8F8F8',
          subtle: '#FDF4F4',
          border: '#C5C6CF', // neutral blue-grey hairline — reads neutral, kept
          // The chat sidebar's unread row (owner-specified, 2026-08-18). A TOKEN
          // rather than an inline hex — `web-design.md` bans magic values in
          // components — and its own name rather than an alias of `primary-100`
          // (#FFDBDE): keeping it separate means a later tweak to the brand
          // scale cannot silently move a colour the owner chose.
          // ⚠️ RETIRED from the chat row 2026-09-24 (owner granted full design
          // freedom): unread is now bold name + red time + dot, no fill, and
          // the SELECTED row carries the tint. Kept so reverting is one line.
          unread: '#FFE9EB',
        },
        // Semantic — status & feedback.
        //
        // 🔴 These carry FULL 50–900 scales on purpose. They used to be flat (or
        // `danger`, 50 + DEFAULT only), and a flat token silently swallows any
        // invented shade: `bg-success-100` and `text-danger-600` compiled to
        // NOTHING, so a success chip rendered with no fill and an error message
        // rendered in body colour — invisible precisely when they mattered
        // (found twice, 2026-08-02/03). A real scale means there is no longer an
        // invalid shade to write.
        //
        // The anchors are unchanged, so nothing that already shipped moves:
        //   success DEFAULT/500 = #12B76A (brand verified green)
        //   warning DEFAULT/500 = #F79009 (LOCKED token — owner, 2026-07-31)
        //   danger  DEFAULT/600 = #D92D20, danger-50 = #FEECEA (mockup tint)
        // Surrounding steps follow the same ramp the mockups' palette uses.
        success: {
          50: '#ECFDF3',
          100: '#D1FADF',
          200: '#A6F4C5',
          300: '#6CE9A6',
          400: '#32D583',
          500: '#12B76A',
          600: '#039855',
          700: '#027A48',
          800: '#05603A',
          900: '#054F31',
          DEFAULT: '#12B76A', // verified tick, approvals
        },
        warning: {
          50: '#FFFAEB',
          100: '#FEF0C7',
          200: '#FEDF89',
          300: '#FEC84B',
          400: '#FDB022',
          500: '#F79009',
          600: '#DC6803',
          700: '#B54708',
          800: '#93370D',
          900: '#7A2E0E',
          DEFAULT: '#F79009', // in review / pending (locked token — owner, 2026-08-01)
        },
        // 🔴 DANGER — moved to a DEEP MAROON on 2026-09-22, and this was forced,
        // not a preference. The brand became red the same day, and the old
        // danger (#D92D20) measures **1.19:1 against primary-600 (#CE061A)** —
        // the same luminance to a human eye. "Save" and "Delete" would have
        // rendered as the same button. On a platform with block, revoke, reject
        // and takedown actions that is a defect, not a style question.
        //
        // ⚠️ Two reds can never separate well by luminance alone: the best
        // achievable against #CE061A while still carrying white text is ~1.9:1
        // (measured across the whole hue range). So this ramp goes as dark and
        // as brown as it can, and **colour is no longer the only signal** —
        // destructive actions also rely on their confirm dialog and, for
        // buttons, on the `dangerOutline` variant's different FORM. Do not
        // lighten this ramp back toward the brand to "look more like an error".
        //
        // Anchors: DEFAULT/600 = #6B2416 (white text 11.12:1, 1.94:1 from the
        // brand) · 700 = body error text (13.22:1) · 50 = error-field tint.
        danger: {
          50: '#FDF3F2', // error-field background tint
          100: '#F9E2DE',
          200: '#EFC0B7',
          300: '#DB9384',
          400: '#AE4E35',
          500: '#852C1C', // status dots / audit-row bars
          600: '#6B2416',
          700: '#571D11',
          800: '#43160C',
          900: '#2F0F07',
          DEFAULT: '#6B2416', // rejections, destructive actions
        },
        // 🔴 The LOGO's navy — the second colour of the supplied artwork, and
        // the old `primary-800`. It exists as its own token since 2026-09-22
        // for one reason: **the dashboard chart needs a second series colour
        // that is tellable apart from red.** The pairing used to be blue ×
        // amber (166° of hue apart); with a red brand that became red × amber
        // at 40°, which is not a distinction anyone can read. Red × this navy
        // is 124° apart and 2.0:1 in lightness, and unlike red × green it is
        // safe for colour-blind readers.
        //
        // Use it for DATA and for the logo's own colour. It is deliberately NOT
        // a brand surface any more — do not paint sidebars, buttons or headers
        // with it, or the app grows a second brand colour by accident.
        navy: '#1A2E8F',
        // Flat by design — only ever used at these exact keys, no shade is
        // referenced anywhere (verified by sweep). Scale them if that changes.
        muted: '#5A6B85', // secondary/help text
      },
      // AI Search pill's living gradient (2026-08-16) — slow background-position
      // sweep; pair with bg-[length:200%_200%] and motion-reduce:animate-none.
      keyframes: {
        'ai-sheen': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        'ai-sheen': 'ai-sheen 5s ease-in-out infinite',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // The resting card shadow (soft, navy-tinted — Precision spec)
        card: '0px 4px 20px rgba(0, 5, 23, 0.05)',
        // Elevation for the ACTIVE surface only (focused form card, floating
        // action bar). Added with the 2026-08-10 M2 redesign — same navy tint,
        // one step deeper. Two levels, never more.
        lift: '0px 2px 6px rgba(0, 5, 23, 0.04), 0px 12px 32px rgba(0, 5, 23, 0.10)',
      },
    },
  },
  plugins: [],
};
