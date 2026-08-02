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
        // Semantic — status & feedback (verified green from the brand spec)
        success: '#12B76A', // verified tick, approvals
        warning: '#F79009', // in review / pending (locked token — owner, 2026-08-01)
        danger: {
          50: '#FEECEA', // error-field background tint (mockup convention)
          DEFAULT: '#D92D20', // rejections, destructive actions
        },
        muted: '#5A6B85', // secondary/help text
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // The one card shadow the Precision spec allows (soft, navy-tinted)
        card: '0px 4px 20px rgba(0, 5, 23, 0.05)',
      },
    },
  },
  plugins: [],
};
