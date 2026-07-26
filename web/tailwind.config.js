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
        // Brand / primary — actions, links, active states
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          DEFAULT: '#4f46e5',
        },
        // Neutral ink — text and high-contrast surfaces
        ink: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          DEFAULT: '#0f172a',
        },
        // Surfaces — page/card backgrounds and borders
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#f8fafc',
          border: '#e2e8f0',
        },
        // Semantic — status & feedback
        success: '#16a34a', // verified tick, approvals
        warning: '#d97706', // pending / needs attention
        danger: '#dc2626', // rejections, destructive actions
        muted: '#64748b', // secondary/help text
      },
    },
  },
  plugins: [],
};
