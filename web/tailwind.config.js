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
        // Brand / primary — the ROYAL BLUE family every m1-webscreens mockup uses
        // (History 1.13: client moved the landing blue to royal; DESIGN.md
        // "MPX Global Precision"). primary-600 = accent (#2A4DE0) for actions,
        // primary-700 = hover (#2340C4), primary-800 = brand navy (#1A2E8F)
        // for the sidebar / hero panels.
        primary: {
          50: '#EAEEFF',
          100: '#DEE1FF',
          200: '#C3CBFF',
          300: '#9DAAF7',
          400: '#6478EC',
          500: '#3D5AE6',
          600: '#2A4DE0',
          700: '#2340C4',
          800: '#1A2E8F',
          900: '#131F66',
          DEFAULT: '#2A4DE0',
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
        // Surfaces — canvas behind cards is the pale blue tint, cards are white,
        // hairlines are the mockups' #C5C6CF
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#EAEEFF',
          border: '#C5C6CF',
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
        danger: {
          50: '#FEECEA', // error-field background tint (mockup convention)
          100: '#FEE4E2',
          200: '#FECDCA',
          300: '#FDA29B',
          400: '#F97066',
          500: '#F04438',
          600: '#D92D20',
          700: '#B42318',
          800: '#912018',
          900: '#7A271A',
          DEFAULT: '#D92D20', // rejections, destructive actions
        },
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
