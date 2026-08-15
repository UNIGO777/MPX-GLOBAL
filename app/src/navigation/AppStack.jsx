import { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { BuyerNavigator } from './BuyerNavigator.jsx';
import { ExporterNavigator } from './ExporterNavigator.jsx';
import { VerificationPromptScreen } from '../screens/kyc/VerificationPromptScreen.jsx';
import { VerificationHubScreen } from '../screens/kyc/VerificationHubScreen.jsx';
import { EntityTypeScreen } from '../screens/kyc/EntityTypeScreen.jsx';
import { DocumentTypeScreen } from '../screens/kyc/DocumentTypeScreen.jsx';
import { CaptureDocumentScreen } from '../screens/kyc/CaptureDocumentScreen.jsx';
import { withUnverifiedGuard } from '../screens/kyc/RequireUnverified.jsx';
import { CompanyProfileScreen } from '../screens/profile/CompanyProfileScreen.jsx';
import { ChangePasswordScreen } from '../screens/profile/ChangePasswordScreen.jsx';
import { CategoryBrowseScreen } from '../screens/CategoryBrowseScreen.jsx';
import { CategoryComingSoonScreen } from '../screens/CategoryComingSoonScreen.jsx';
import { postSignupPrompt } from '../screens/kyc/postSignupPrompt.js';

const Stack = createNativeStackNavigator();

/**
 * Registered as the "Tabs" screen itself (not rendered as a child elsewhere),
 * so it receives `navigation` as a normal screen prop. On first mount it pushes
 * KycPrompt ON TOP of Tabs — never as the stack's initial route — so Tabs is
 * always sitting underneath in history. That's what makes `goBack()` land
 * somewhere real, both from KycPrompt's own "Not now" and from KycHub after
 * the "Verify now" replace.
 */
function TabsRoot({ navigation, Tabs }) {
  useEffect(() => {
    // Consumed once, on mount. A signup lands on the nudge; every later launch —
    // and every sign-in — lands on the tabs, so an unverified company is never
    // nagged repeatedly.
    if (postSignupPrompt.consume()) {
      navigation.navigate('KycPrompt');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Tabs />;
}

/**
 * The signed-in shell. The role's tab navigator is the root screen; verification
 * sits ON TOP of it as a stack so it can be pushed from the post-signup nudge or
 * from Profile without living inside a tab.
 *
 * 🔒 The three upload steps are wrapped in `withUnverifiedGuard` — an already
 * verified company has nothing to add and is shown a dead-end-free message
 * instead. **The hub is deliberately NOT guarded**: a verified company should
 * still be able to open it and see its tick and its documents.
 *
 * That guard is UX only. The server refuses a duplicate upload with 409
 * regardless (`submitKycDocument`), and that is what actually enforces it.
 */
export function AppStack({ role }) {
  const Tabs = role === 'exporter' ? ExporterNavigator : BuyerNavigator;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Tabs">
      <Stack.Screen name="Tabs">{(props) => <TabsRoot {...props} Tabs={Tabs} />}</Stack.Screen>

      {/* Shown once after signup; "Not now" simply pops back to the tabs. */}
      <Stack.Screen name="KycPrompt" component={VerificationPromptScreen} />

      <Stack.Screen name="KycHub" component={VerificationHubScreen} />

      {/* §A22 — company profile (view/edit + locks). Pushed from Profile. */}
      <Stack.Screen name="CompanyProfile" component={CompanyProfileScreen} />

      {/* Screen 16 sub-screen — pushed from Profile's Security section. */}
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />

      {/* M2 app screen 1 — buyer-only, reached from Buyer Home (no tab-bar
          entry, owner decision 2026-08-07). CategoryComingSoon is the honest
          landing for a sub-category tap until screen 2 (product listing) ships. */}
      <Stack.Screen name="CategoryBrowse" component={CategoryBrowseScreen} />
      <Stack.Screen name="CategoryComingSoon" component={CategoryComingSoonScreen} />

      <Stack.Screen name="KycEntityType" component={withUnverifiedGuard(EntityTypeScreen)} />
      <Stack.Screen name="KycDocumentType" component={withUnverifiedGuard(DocumentTypeScreen)} />
      <Stack.Screen name="KycCapture" component={withUnverifiedGuard(CaptureDocumentScreen)} />
    </Stack.Navigator>
  );
}
