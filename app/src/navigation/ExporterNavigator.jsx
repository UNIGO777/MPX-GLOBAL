import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExporterHomeScreen } from '../screens/ExporterHomeScreen.jsx';
import { MyProductsScreen } from '../screens/MyProductsScreen.jsx';
import { ChatListScreen } from '../screens/ChatListScreen.jsx';
import { useChat } from '../context/ChatContext.jsx';
import { ProfileScreen } from '../screens/ProfileScreen.jsx';
import { buildTabBarStyle, screenHeaderOptions, tabBarOptions } from './navigationTheme.js';
import { colors } from '../theme/index.js';
import { tabIcon } from './tabIcon.jsx';

const Tab = createBottomTabNavigator();

/**
 * Exporter shell — Home + Profile are real; Catalogue stays a placeholder
 * until M2's product screens (5–7) land, Enquiries/Chat until M4.
 *
 * 🔴 Scope note: `docs/auth-app-steps.md` Step 7 also lists **Quotations** and
 * **Orders** tabs. Quotation & negotiation is `month1-not-doing.md` **Bucket A1**
 * (deferred out of month 1) and orders/shipments are **Bucket B** (Phase 2).
 * `scope-guard.md` forbids scaffolding or stubbing either without explicit owner
 * confirmation, so both are omitted rather than stubbed.
 *
 * Tab icons — see the note in BuyerNavigator.
 */
export function ExporterNavigator() {
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
        name="ExporterHome"
        // headerShown: false (2026-08-18) — Home was rebuilt to the owner's
        // mockup with its own white sticky header (same move Buyer Home and
        // Profile already made); the native one just sat above it.
        options={{ title: 'Home', tabBarLabel: 'Home', tabBarIcon: tabIcon('home'), headerShown: false }}
        component={ExporterHomeScreen}
      />
      <Tab.Screen
        name="ExporterCatalogue"
        // headerShown: false (2026-08-18) — the tab went LIVE with M2 screen 5
        // (My products), which draws its own header + "+ Add" action.
        options={{ title: 'Catalogue', tabBarLabel: 'Catalogue', tabBarIcon: tabIcon('cube'), headerShown: false }}
        component={MyProductsScreen}
      />
      {/* M4 (2026-08-20): Enquiries + Messages collapsed into ONE live Chats
          tab (M4-35). The app IS the seller's inbox — there is no email in
          month 1, so this tab plus its badge is how an enquiry reaches them. */}
      <Tab.Screen
        name="ExporterChats"
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
        name="ExporterProfile"
        // headerShown: false (2026-08-16) — Profile builds its own scroll-
        // reactive sticky header (`ProfileScreen.jsx`); the native one just
        // duplicated its title.
        options={{ title: 'Profile', tabBarLabel: 'Profile', tabBarIcon: tabIcon('person-circle'), headerShown: false }}
        component={ProfileScreen}
      />
    </Tab.Navigator>
  );
}
