import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { ProfileScreen } from '../screens/ProfileScreen.jsx';
import { makePlaceholder } from '../screens/PlaceholderScreen.jsx';
import { screenHeaderOptions, tabBarOptions } from './navigationTheme.js';
import { tabIcon } from './tabIcon.jsx';

const Tab = createBottomTabNavigator();

/**
 * Buyer shell — placeholder screens only; the modules land in M2–M4.
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
  return (
    <Tab.Navigator screenOptions={{ ...screenHeaderOptions, ...tabBarOptions }}>
      <Tab.Screen
        name="BuyerHome"
        options={{ title: 'Home', tabBarLabel: 'Home', tabBarIcon: tabIcon('home') }}
        component={makePlaceholder({ title: 'Home', module: 'Buyer dashboard', milestone: 'M2' })}
      />
      <Tab.Screen
        name="BuyerSearch"
        options={{ title: 'Search', tabBarLabel: 'Search', tabBarIcon: tabIcon('search') }}
        component={makePlaceholder({
          title: 'Search',
          module: 'Module 3 · Search & discovery',
          milestone: 'M3',
        })}
      />
      <Tab.Screen
        name="BuyerEnquiries"
        options={{ title: 'Enquiries', tabBarLabel: 'Enquiries', tabBarIcon: tabIcon('document-text') }}
        component={makePlaceholder({
          title: 'Enquiries',
          module: 'Module 3 · Enquiry & chat',
          milestone: 'M4',
        })}
      />
      <Tab.Screen
        name="BuyerMessages"
        options={{ title: 'Messages', tabBarLabel: 'Messages', tabBarIcon: tabIcon('chatbubbles') }}
        component={makePlaceholder({
          title: 'Messages',
          module: 'Module 3 · Real-time chat',
          milestone: 'M4',
        })}
      />
      <Tab.Screen
        name="BuyerProfile"
        options={{ title: 'Profile', tabBarLabel: 'Profile', tabBarIcon: tabIcon('person-circle') }}
        component={ProfileScreen}
      />
    </Tab.Navigator>
  );
}
