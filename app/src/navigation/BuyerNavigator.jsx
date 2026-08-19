import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BuyerHomeScreen } from '../screens/BuyerHomeScreen.jsx';
import { ProfileScreen } from '../screens/ProfileScreen.jsx';
import { SearchHomeScreen } from '../screens/SearchHomeScreen.jsx';
import { makePlaceholder } from '../screens/PlaceholderScreen.jsx';
import { buildTabBarStyle, screenHeaderOptions, tabBarOptions } from './navigationTheme.js';
import { tabIcon } from './tabIcon.jsx';

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
      <Tab.Screen
        name="BuyerEnquiries"
        options={{ title: 'Enquiries', tabBarLabel: 'Enquiries', tabBarIcon: tabIcon('document-text') }}
        component={makePlaceholder({
          title: 'Enquiries',
          icon: 'document-text-outline',
          blurb: "Ask suppliers questions right from a listing — this is on the way.",
          module: 'Module 3 · Enquiry & chat',
          milestone: 'M4',
        })}
      />
      <Tab.Screen
        name="BuyerMessages"
        options={{ title: 'Messages', tabBarLabel: 'Messages', tabBarIcon: tabIcon('chatbubbles') }}
        component={makePlaceholder({
          title: 'Messages',
          icon: 'chatbubbles-outline',
          blurb: "Real-time chat with suppliers is on the way.",
          module: 'Module 3 · Real-time chat',
          milestone: 'M4',
        })}
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
