/**
 * Colour tokens — a 1:1 mirror of `web/tailwind.config.js`.
 *
 * The two surfaces must feel like one product, so the *values* are copied and
 * the *names* match the Tailwind scale the web uses (`primary-600`, `ink-900`,
 * `surface.border`, …). This is the only place a hex belongs in the app.
 *
 * Never write a raw hex in a component.
 *
 * 🔴 RED + BLACK, 2026-09-22 (owner: "in the full app apply red and black like
 * the web landing page"). `primary` moved from royal blue to the crimson scale
 * the web landing uses, anchored on the owner's **#CE061A** at 600. Because
 * every screen reads these tokens, the whole app turned over from this one file.
 *
 * ⚠️ THE WEB IS ONLY PART-WAY THERE. On web, crimson is a TRIAL applied to the
 * landing page alone (`/landing-blue` still holds the blue original); the other
 * public pages, the admin console and the logo are all still royal blue. The app
 * is now fully red while the web is mostly blue — that is the owner's call and a
 * known interim state, not a mistake to "fix" by reverting this file.
 *
 * 🔴 `success`, `warning` and `danger` are DELIBERATELY UNCHANGED. They are
 * semantic, not brand: green means verified, amber means in review (an
 * owner-locked token, 2026-08-01), red means destructive or failed. A brand
 * repaint must not quietly restate what a status means.
 *   ⚠️ Known consequence, raised with the owner: brand #CE061A and danger
 *   #D92D20 now sit at a contrast ratio of **1.19** — indistinguishable by eye.
 *   Error states stay readable only because this app already pairs them with an
 *   icon and wording (`FormError`, alert glyphs, explicit labels), never colour
 *   alone. If destructive actions should look different from ordinary ones, that
 *   is a brand decision and needs the owner, not a silent token edit here.
 */
export const colors = {
  // Brand — crimson. 600 = action AND the large fills, 700 = pressed, 800 = deep.
  //
  // 600 carries the big surfaces (not 800, as the blue scale did) because white
  // on #CE061A measures 5.73:1 and clears WCAG AA, so the owner's colour is what
  // the app actually reads as rather than a dark maroon derived from it. Nothing
  // lighter may carry white text: the next step up (#E8202F) measures 4.49:1 and
  // fails AA by a hair.
  primary: {
    50: '#FFF0F1',
    100: '#FFDBDE',
    200: '#FFB3BA',
    300: '#FA808D',
    400: '#EE4657',
    500: '#E01329',
    600: '#CE061A',
    700: '#AE0416',
    800: '#8A0311',
    900: '#66020C',
    DEFAULT: '#CE061A',
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

  // Surfaces — canvas is a NEUTRAL grey, cards are white, hairlines #C5C6CF.
  //
  // 🔴 `subtle` was '#EAEEFF', which was simply primary-50 of the blue scale. Left
  // alone it would have kept every screen's canvas tinted BLUE under a red brand —
  // the one change that would have made the repaint look broken rather than bold.
  // Neutral grey, matching the web landing's own page ground, so the red reads as
  // deliberate against it instead of fighting a leftover tint.
  surface: {
    DEFAULT: '#FFFFFF',
    subtle: '#F7F8FB',
    border: '#C5C6CF',
  },

  // Semantic — status & feedback.
  success: '#12B76A', // verified tick, approvals
  warning: '#F79009', // in review / pending (locked token — owner, 2026-08-01)
  /**
   * 🔴 DEEP MAROON, mirroring `web/tailwind.config.js` (app 2026-09-23; web
   * 2026-09-22). It was `#D92D20` — a bright red that sat at a contrast ratio of
   * **1.19** against the new crimson brand, which is indistinguishable by eye.
   * The consequence was concrete: the destructive "Sign out" button and an
   * ordinary brand button looked identical, and a form's error state read as
   * ordinary emphasis.
   *
   * Web fixed this on 2026-09-22 and the app did not, so for a day the two were
   * out of step — exactly what this file's "1:1 mirror" promise exists to
   * prevent. The full ramp is copied even though only `DEFAULT` and `50` are
   * used today (verified by sweep: 38 and 14 uses), so the next shade someone
   * reaches for already matches web instead of being invented here.
   */
  danger: {
    50: '#FDF3F2', // error-field background tint
    100: '#F9E2DE',
    200: '#EFC0B7',
    300: '#DB9384',
    400: '#AE4E35',
    500: '#852C1C',
    600: '#6B2416',
    700: '#571D11',
    800: '#43160C',
    900: '#2F0F07',
    DEFAULT: '#6B2416', // rejections, destructive actions
  },
  muted: '#5A6B85', // secondary / help text

  white: '#FFFFFF',
  // Scrim behind bottom sheets and modals.
  scrim: 'rgba(0, 5, 23, 0.45)',
};
