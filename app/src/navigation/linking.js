import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
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
/**
 * M4-H · A tapped notification becomes a deep link.
 *
 * The server's push payload carries `data.conversationId` (`push.service.js`),
 * and this app already routes `mpxglobal://chat/<id>`. So rather than build a
 * second navigation path with its own ref and its own bugs, a tap is turned
 * into the URL the app already knows how to open.
 *
 * 🔴 Same trust rule as any deep link: the payload only SELECTS a destination.
 * `ChatThreadScreen` still fetches the conversation through the API, and the
 * server still enforces that this account is a party to it — a push addressed
 * to the wrong device cannot show anyone else's thread.
 */
function responseToUrl(response) {
  const id = response?.notification?.request?.content?.data?.conversationId;
  return id ? `mpxglobal://chat/${id}` : null;
}

/**
 * React Navigation's own URL plumbing, extended so notification taps flow
 * through it. `getInitialURL` covers a COLD start (app killed, user taps a
 * notification) and `subscribe` covers warm ones — both are needed; handling
 * only the warm case is why "it works in dev but not from the notification
 * tray" is such a common bug.
 */
function notificationAwareLinking(base) {
  return {
    ...base,
    async getInitialURL() {
      // A real deep link wins: the user explicitly followed it just now.
      const url = await Linking.getInitialURL();
      if (url) return url;
      return responseToUrl(await Notifications.getLastNotificationResponseAsync());
    },
    subscribe(listener) {
      const urlSub = Linking.addEventListener('url', ({ url }) => listener(url));
      const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
        const url = responseToUrl(response);
        if (url) listener(url);
      });
      return () => {
        urlSub.remove();
        tapSub.remove();
      };
    },
  };
}

export function getLinking(role) {
  if (role === 'buyer') {
    return notificationAwareLinking({ prefixes: PREFIXES, config: { screens: BUYER_SCREENS } });
  }
  if (role === 'exporter') {
    return notificationAwareLinking({ prefixes: PREFIXES, config: { screens: EXPORTER_SCREENS } });
  }

  // Signed out: the scheme is still claimed so a cold-start link does not error,
  // but no route resolves — an unauthenticated deep link must land on the auth
  // stack, never on a signed-in screen. Notification taps are NOT wired here
  // either: there is no session to open a thread with.
  return { prefixes: PREFIXES, config: { screens: {} } };
}
