/**
 * Colour tokens — a 1:1 mirror of `web/tailwind.config.js`.
 *
 * The two surfaces must feel like one product, so the *values* are copied and
 * the *names* match the Tailwind scale the web uses (`primary-600`, `ink-900`,
 * `surface.border`, …). When the owner confirms the final brand palette, both
 * files change together — this is the only place a hex belongs in the app.
 *
 * Never write a raw hex in a component.
 */
export const colors = {
  // Brand — royal blue. 600 = action, 700 = pressed, 800 = brand navy.
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

  // Neutral ink — text.
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

  // Surfaces — canvas is the pale blue tint, cards are white, hairlines #C5C6CF.
  surface: {
    DEFAULT: '#FFFFFF',
    subtle: '#EAEEFF',
    border: '#C5C6CF',
  },

  // Semantic — status & feedback.
  success: '#12B76A', // verified tick, approvals
  warning: '#F79009', // in review / pending (locked token — owner, 2026-08-01)
  danger: {
    50: '#FEECEA', // error-field background tint
    DEFAULT: '#D92D20', // rejections, destructive actions
  },
  muted: '#5A6B85', // secondary / help text

  white: '#FFFFFF',
  // Scrim behind bottom sheets and modals.
  scrim: 'rgba(0, 5, 23, 0.45)',
};
