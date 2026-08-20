/**
 * Deep-link configuration.
 *
 * Configured now, ahead of the screens, because M4's push notifications tap
 * through to a conversation and the scheme has to be fixed before store
 * submission rather than after (auth-app-steps.md Step 8).
 *
 * A deep link is untrusted input: it can be crafted by anyone who can get the
 * user to tap a URL. It may only select a destination — never carry an
 * authentication decision, a role, or a permission. Every screen it reaches
 * still fetches its own data through the API, and the server re-checks.
 *
 * ⚠️ Built PER ROLE rather than as one static object. The buyer and exporter
 * trees hold equivalent screens under different names (`BuyerEnquiries` /
 * `ExporterEnquiries`), and React Navigation validates the whole config — not
 * just the mounted tree — so a single object mapping both names to 'enquiries'
 * throws "conflicting screens with the same pattern" at runtime. Scoping the
 * config to the mounted role keeps the PATHS role-agnostic, which is what a
 * notification payload wants: it links to `mpxglobal://enquiries` without
 * having to know which portal the recipient is signed into.
 */

const PREFIXES = ['mpxglobal://'];

// M4 (2026-08-20): the placeholder Enquiries/Messages tabs collapsed into one
// Chats tab per portal (M4-35), and the thread screen now exists — so the
// links a push notification actually needs are these:
//   mpxglobal://chats     → the Chats tab
//   mpxglobal://chat/<id> → one thread (the notification-tap landing)
//
// ⚠️ The config must mirror the NAVIGATOR NESTING: the tab navigators are
// mounted as the root stack's `Tabs` screen (`AppStack.jsx`), so the tab has
// to be declared under `Tabs` — a flat entry (as this file originally had for
// the placeholder tabs) never resolves. `ChatThread` is a root-stack screen,
// so it IS flat, and identical for both roles.
const BUYER_SCREENS = {
  Tabs: { screens: { BuyerChats: 'chats' } },
  ChatThread: 'chat/:id',
};

const EXPORTER_SCREENS = {
  Tabs: { screens: { ExporterChats: 'chats' } },
  ChatThread: 'chat/:id',
};

/**
 * @param {'buyer'|'exporter'|null} role
 * @returns a React Navigation linking config for the tree that is mounted
 */
export function getLinking(role) {
  if (role === 'buyer') return { prefixes: PREFIXES, config: { screens: BUYER_SCREENS } };
  if (role === 'exporter') return { prefixes: PREFIXES, config: { screens: EXPORTER_SCREENS } };

  // Signed out: the scheme is still claimed so a cold-start link does not error,
  // but no route resolves — an unauthenticated deep link must land on the auth
  // stack, never on a signed-in screen.
  return { prefixes: PREFIXES, config: { screens: {} } };
}
