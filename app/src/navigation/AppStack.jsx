import { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { BuyerNavigator } from './BuyerNavigator.jsx';
import { ExporterNavigator } from './ExporterNavigator.jsx';
import { VerificationPromptScreen } from '../screens/kyc/VerificationPromptScreen.jsx';
import { VerificationHubScreen } from '../screens/kyc/VerificationHubScreen.jsx';
import { EntityTypeScreen } from '../screens/kyc/EntityTypeScreen.jsx';
import { DocumentTypeScreen } from '../screens/kyc/DocumentTypeScreen.jsx';
import { CaptureDocumentScreen } from '../screens/kyc/CaptureDocumentScreen.jsx';
import { withUnverifiedGuard } from '../screens/kyc/RequireUnverified.jsx';
import { postSignupPrompt } from '../screens/kyc/postSignupPrompt.js';

const Stack = createNativeStackNavigator();

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

  // Consumed once, on mount. A signup lands on the nudge; every later launch —
  // and every sign-in — lands on the tabs, so an unverified company is never
  // nagged repeatedly.
  const [openOnPrompt] = useState(() => postSignupPrompt.consume());

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={openOnPrompt ? 'KycPrompt' : 'Tabs'}
    >
      <Stack.Screen name="Tabs" component={Tabs} />

      {/* Shown once after signup; "Not now" simply pops back to the tabs. */}
      <Stack.Screen name="KycPrompt" component={VerificationPromptScreen} />

      <Stack.Screen name="KycHub" component={VerificationHubScreen} />
      <Stack.Screen name="KycEntityType" component={withUnverifiedGuard(EntityTypeScreen)} />
      <Stack.Screen name="KycDocumentType" component={withUnverifiedGuard(DocumentTypeScreen)} />
      <Stack.Screen name="KycCapture" component={withUnverifiedGuard(CaptureDocumentScreen)} />
    </Stack.Navigator>
  );
}
