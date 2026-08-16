import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { ExporterHomeScreen } from '../screens/ExporterHomeScreen.jsx';
import { ProfileScreen } from '../screens/ProfileScreen.jsx';
import { makePlaceholder } from '../screens/PlaceholderScreen.jsx';
import { screenHeaderOptions, tabBarOptions } from './navigationTheme.js';
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
  return (
    <Tab.Navigator screenOptions={{ ...screenHeaderOptions, ...tabBarOptions }}>
      <Tab.Screen
        name="ExporterHome"
        options={{ title: 'Home', tabBarLabel: 'Home', tabBarIcon: tabIcon('home') }}
        component={ExporterHomeScreen}
      />
      <Tab.Screen
        name="ExporterCatalogue"
        options={{ title: 'Catalogue', tabBarLabel: 'Catalogue', tabBarIcon: tabIcon('cube') }}
        component={makePlaceholder({
          title: 'Catalogue',
          module: 'Module 2 · Products',
          milestone: 'M2',
          note: 'While unverified: max 3 active listings + 10 drafts (D1). The cap is enforced server-side — the app only reflects it.',
        })}
      />
      <Tab.Screen
        name="ExporterEnquiries"
        options={{ title: 'Enquiries', tabBarLabel: 'Enquiries', tabBarIcon: tabIcon('document-text') }}
        component={makePlaceholder({
          title: 'Enquiries',
          module: 'Module 3 · Enquiry & chat',
          milestone: 'M4',
        })}
      />
      <Tab.Screen
        name="ExporterMessages"
        options={{ title: 'Messages', tabBarLabel: 'Messages', tabBarIcon: tabIcon('chatbubbles') }}
        component={makePlaceholder({
          title: 'Messages',
          module: 'Module 3 · Real-time chat',
          milestone: 'M4',
        })}
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
