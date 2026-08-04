import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { kycApi } from '../../api/kyc.js';
import { Button } from '../../components/Button.jsx';
import { NavyCanopy } from '../../components/NavyCanopy.jsx';
import { colors, spacing, typography } from '../../theme/index.js';

/**
 * Keeps an already-verified company out of the upload flow (owner: "if its done
 * dont allow these page").
 *
 * ⚠️ This is UX, not access control. The real enforcement is server-side:
 * `submitKycDocument` returns 409 "Your account is already verified." So this
 * wrapper exists to avoid showing a pointless screen, and is never the thing
 * that protects anything. Do not remove the server check because this exists.
 *
 * The hub itself is deliberately NOT wrapped — a verified company should still
 * be able to open it and see its tick and its documents. Only the steps that
 * would upload are blocked.
 *
 * Status is re-read on every focus rather than cached: a reviewer can approve
 * while the user sits on the screen, and a stale "not verified" would let them
 * start an upload the server will refuse.
 */
export function RequireUnverified({ navigation, children }) {
  const [state, setState] = useState({ loading: true, verified: false });

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setState((s) => ({ ...s, loading: true }));
      kycApi
        .getVerification()
        .then((v) => alive && setState({ loading: false, verified: v.kycStatus === 'verified' }))
        // Fail OPEN on a network error: the server still refuses a duplicate
        // upload, and blocking a legitimate user because status could not be
        // read would be worse than letting them try.
        .catch(() => alive && setState({ loading: false, verified: false }));
      return () => {
        alive = false;
      };
    }, []),
  );

  if (state.loading) {
    return (
      <NavyCanopy title="Verification" showWordmark sheetTone="subtle">
        <View style={styles.centre}>
          <ActivityIndicator color={colors.primary[600]} />
        </View>
      </NavyCanopy>
    );
  }

  if (state.verified) {
    return (
      <NavyCanopy
        title="Already verified"
        subtitle="Nothing more to do here."
        onBack={() => navigation.goBack()}
        sheetTone="subtle"
        footer={<Button label="Back to verification" onPress={() => navigation.navigate('KycHub')} />}
      >
        <View style={styles.centre}>
          <Ionicons name="shield-checkmark" size={40} color={colors.success} />
          <Text style={styles.title}>Your company is verified</Text>
          <Text style={styles.body}>
            The tick is already on your public profile, so there are no more documents to add.
          </Text>
        </View>
      </NavyCanopy>
    );
  }

  return children;
}

/** Wrap a screen component so the navigator can use it directly. */
export function withUnverifiedGuard(Screen) {
  return function Guarded(props) {
    return (
      <RequireUnverified navigation={props.navigation}>
        <Screen {...props} />
      </RequireUnverified>
    );
  };
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing[10], gap: spacing[3] },
  title: { ...typography.h2, color: colors.ink[900], textAlign: 'center' },
  body: { ...typography.body, color: colors.ink[700], textAlign: 'center' },
});
