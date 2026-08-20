import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BuyerHomeScreen } from '../screens/BuyerHomeScreen.jsx';
import { ProfileScreen } from '../screens/ProfileScreen.jsx';
import { SearchHomeScreen } from '../screens/SearchHomeScreen.jsx';
import { AiSearchScreen } from '../screens/AiSearchScreen.jsx';
import { ChatListScreen } from '../screens/ChatListScreen.jsx';
import { useChat } from '../context/ChatContext.jsx';
import { buildTabBarStyle, screenHeaderOptions, tabBarOptions } from './navigationTheme.js';
import { colors, typography } from '../theme/index.js';
import { aiTabButton, aiTabIcon, tabIcon } from './tabIcon.jsx';

const Tab = createBottomTabNavigator();

/**
 * Buyer shell — Home + Profile are real; Search/Enquiries/Chat stay
 * placeholders until M3/M4.
 *
 * 🔴 Scope note: `docs/auth-app-steps.md` Step 7 also lists an **Orders** tab.
 * Orders/shipments are `month1-not-doing.md` **Bucket B** (Phase 2), which
 * `scope-guard.md` forbids scaffolding or stubbing without explicit owner
 * confirmation — so it is omitted here rather than stubbed. That step's tab
 * list predates the buckets.
 *
 * Tab icons come from `@expo/vector-icons` (owner-approved). They are not
 * decoration: React Navigation draws a placeholder glyph when `tabBarIcon` is
 * missing, which renders as an empty box on Android.
 */
export function BuyerNavigator() {
  const { unread } = useChat();
  // `tabBarStyle` sets its own explicit height (raised-circle active icon),
  // which disables React Navigation's automatic safe-area padding for the
  // bar — see `buildTabBarStyle`'s own note. Real inset, computed here.
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{ ...screenHeaderOptions, ...tabBarOptions, tabBarStyle: buildTabBarStyle(insets.bottom) }}
    >
      <Tab.Screen
        name="BuyerHome"
        // headerShown: false (2026-08-17) — Home no longer uses NavyCanopy
        // (rebuilt to a plain white header matching the owner's mockup); the
        // native tab header was only ever there to sit above NavyCanopy's own
        // navy hero, which doesn't exist on this screen anymore either.
        options={{ title: 'Home', tabBarLabel: 'Home', tabBarIcon: tabIcon('home'), headerShown: false }}
        component={BuyerHomeScreen}
      />
      <Tab.Screen
        name="BuyerSearch"
        // LIVE (2026-08-19, M3 screen 1) — the tab was a placeholder since
        // M1. headerShown: false — the screen draws its own header.
        options={{ title: 'Search', tabBarLabel: 'Search', tabBarIcon: tabIcon('search'), headerShown: false }}
        component={SearchHomeScreen}
      />
      {/* ✨ AI — the bar's centre and its primary action (owner, 2026-08-20).
          Deliberately at index 2 of five: a permanently-raised tab only reads
          as centre-stage if it IS the centre. Buyer-only — AI search is buyer
          discovery, and no exporter search tab is named in any source
          (M3 brief §8: don't add one without an owner nod). */}
      <Tab.Screen
        name="BuyerAi"
        options={{
          title: 'AI Search',
          tabBarLabel: 'AI',
          tabBarIcon: aiTabIcon(),
          // No press ripple / no press fade — the pulse is this tab's only
          // motion (owner, 2026-08-20). See `aiTabButton`.
          tabBarButton: aiTabButton,
          headerShown: false,
          // The raised circle carries the identity; the active tint would
          // otherwise recolour the label away from the accent it shares
          // with the circle.
          tabBarActiveTintColor: colors.primary[700],
          tabBarLabelStyle: { ...typography.tiny, fontWeight: '700', color: colors.primary[700] },
        }}
        component={AiSearchScreen}
      />

      {/* M4 (2026-08-20): the separate Enquiries + Messages placeholders
          collapsed into ONE live Chats tab (M4-35 — an enquiry and its
          thread are one-to-one; two lists would show the same rows twice).
          Badge = unread THREADS, server-derived via ChatContext. */}
      <Tab.Screen
        name="BuyerChats"
        options={{
          title: 'Chats',
          tabBarLabel: 'Chats',
          tabBarIcon: tabIcon('chatbubbles'),
          headerShown: false,
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.primary[600],
            color: colors.white,
            fontSize: 11,
            fontWeight: '700',
          },
        }}
        component={ChatListScreen}
      />
      <Tab.Screen
        name="BuyerProfile"
        // headerShown: false (2026-08-16) — Profile builds its own scroll-
        // reactive sticky header (`ProfileScreen.jsx`); the native one just
        // duplicated its title.
        options={{ title: 'Profile', tabBarLabel: 'Profile', tabBarIcon: tabIcon('person-circle'), headerShown: false }}
        component={ProfileScreen}
      />
    </Tab.Navigator>
  );
}
