import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen.jsx';
import { LoginScreen } from '../screens/auth/LoginScreen.jsx';
import { OtpScreen } from '../screens/auth/OtpScreen.jsx';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen.jsx';
import { SignupAccountScreen } from '../screens/auth/SignupAccountScreen.jsx';
import { SignupCompanyScreen } from '../screens/auth/SignupCompanyScreen.jsx';
import { SignupVerifyScreen } from '../screens/auth/SignupVerifyScreen.jsx';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen.jsx';

const Stack = createNativeStackNavigator();

/**
 * Signed-out stack.
 *
 * Headers are off throughout: every screen draws its own navy canopy with the
 * wordmark and back affordance, so a native header would sit on top of it.
 *
 * The `portal` param ('buyer' | 'exporter') is chosen on Welcome and threaded
 * through every subsequent screen — §A21 makes buyer and exporter separate
 * accounts, and each party endpoint carries it. Login is deliberately NOT
 * allowed to re-select it (brief rule 2); going back to Welcome is how a user
 * switches.
 *
 * There is deliberately no staff route here and there never will be — the
 * employee and superadmin panels are web-only, and the app must not hint at
 * internal tooling.
 */
export function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignupAccount" component={SignupAccountScreen} />
      {/* A21: verification sits BETWEEN the two signup steps — the company step
          is unreachable until both the email and the phone are proved. */}
      <Stack.Screen name="SignupVerify" component={SignupVerifyScreen} />
      <Stack.Screen name="SignupCompany" component={SignupCompanyScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}
