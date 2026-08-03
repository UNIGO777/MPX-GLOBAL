import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button.jsx';
import { ScreenContainer } from '../components/ScreenContainer.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { colors, radii, spacing, typography } from '../theme/index.js';

/**
 * Profile — currently only the identity summary and LOGOUT.
 *
 * Built ahead of the rest of §A22 (owner request, 2026-08-03) because there was
 * no way to sign out at all: the tab was a placeholder, so testing a second
 * account meant wiping the app's data from adb. Company profile, the biometric
 * toggle and change-password still land here with the A22 work — the note below
 * says so rather than leaving the screen looking finished.
 *
 * `logout` comes from AuthContext: it revokes the refresh family server-side
 * first, then clears the device session either way, and RootNavigator swaps back
 * to the auth stack on its own. This screen does not navigate.
 */
export function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const confirmLogout = () => {
    // Confirm first: a mis-tap on a tab-bar screen would otherwise end the
    // session and force the whole OTP sign-in again (web-design: destructive
    // actions confirm and state the consequence).
    Alert.alert('Sign out?', "You'll need your password and a code to sign back in.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await logout();
            // No navigation here — clearing the session is what swaps the stack.
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  const roleLabel = user?.role === 'exporter' ? 'Exporter account' : 'Buyer account';

  return (
    <ScreenContainer scroll={false}>
      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.name}>{user?.name ?? 'Your account'}</Text>
          {user?.email ? <Text style={styles.line}>{user.email}</Text> : null}
          {user?.mobile ? <Text style={styles.line}>{user.mobile}</Text> : null}
          <Text style={styles.role}>{roleLabel}</Text>
        </View>

        {/* The permanent home for verification. The post-signup nudge is
            dismissible, so this is what stops "Not now" being a dead end. */}
        <Button
          label="Verification"
          variant="secondary"
          onPress={() => navigation.navigate('KycHub')}
          fullWidth
        />

        <Text style={styles.note}>
          Company profile, biometric unlock and change password land here with §A22.
        </Text>

        <View style={styles.actions}>
          <Button
            label="Sign out"
            variant="danger"
            onPress={confirmLogout}
            loading={signingOut}
            disabled={signingOut}
            fullWidth
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // ScreenContainer already applies the screen padding — no second inset here.
  body: { flex: 1, gap: spacing[5] },
  card: {
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: spacing[5],
    gap: spacing[1],
  },
  name: { ...typography.h2, color: colors.ink[900] },
  line: { ...typography.body, color: colors.ink[700] },
  role: { ...typography.caption, color: colors.muted, marginTop: spacing[2] },
  note: { ...typography.caption, color: colors.muted },
  // Pushed to the bottom so "Sign out" is never adjacent to anything it could be
  // mistaken for.
  actions: { marginTop: 'auto' },
});
