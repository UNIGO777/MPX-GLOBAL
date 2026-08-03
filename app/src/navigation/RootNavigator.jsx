import { NavigationContainer } from '@react-navigation/native';
import { useMemo } from 'react';

import { useAuth } from '../context/AuthContext.jsx';
import { SplashScreen } from '../screens/auth/SplashScreen.jsx';
import { AuthNavigator } from './AuthNavigator.jsx';
import { AppStack } from './AppStack.jsx';
import { UnsupportedRoleScreen } from './UnsupportedRoleScreen.jsx';
import { getLinking } from './linking.js';
import { navigationTheme } from './navigationTheme.js';

/**
 * Chooses the tree from server-confirmed session state.
 *
 * 🔴 This is UX, not security. Rendering the buyer tabs does not grant a buyer
 * anything — the server re-authorises every request. Never treat a branch here
 * as an access control decision.
 *
 * Swapping the whole navigator on sign-out is deliberate: it discards the
 * previous tree's navigation state, so no signed-in screen survives in a back
 * stack for the next user.
 */
export function RootNavigator() {
  const { isLoading, isAuthenticated, role, restoreError, retryRestore } = useAuth();

  // Scoped to the mounted role — see linking.js. Memoised so the container is
  // not handed a fresh config object on every render.
  const linking = useMemo(() => getLinking(role), [role]);

  // Launch restore is still running. Holding on the branded splash is what
  // stops a returning user seeing the sign-in screen flash before their session
  // resolves.
  if (isLoading) return <SplashScreen />;

  // The restore could not reach the server. The stored session may well still
  // be valid, so offer a retry instead of dropping the user at sign-in — being
  // offline must not read as being signed out.
  if (restoreError) return <SplashScreen offline onRetry={retryRestore} />;

  return (
    <NavigationContainer theme={navigationTheme} linking={linking}>
      {!isAuthenticated ? (
        <AuthNavigator />
      ) : role === 'buyer' || role === 'exporter' ? (
          // Verification lives in a stack ABOVE the role's tabs, so it can
          // be pushed from the post-signup nudge or from Profile.
          <AppStack role={role} />
        ) : (
        <UnsupportedRoleScreen />
      )}
    </NavigationContainer>
  );
}
