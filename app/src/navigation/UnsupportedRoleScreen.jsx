import { StyleSheet, View } from 'react-native';

import { Button, EmptyState, ScreenContainer } from '../components/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { spacing } from '../theme/index.js';

/**
 * Shown when an authenticated user's role is neither buyer nor exporter.
 *
 * This should be unreachable — the app has no staff login and `/auth/login`
 * only accepts a buyer or exporter portal — but a signed-in user with nowhere
 * to go must land somewhere explicit rather than on a blank screen. Defensive,
 * not a feature: it grants nothing, and the server would refuse staff actions
 * from a mobile client regardless.
 */
export function UnsupportedRoleScreen() {
  const { logout } = useAuth();

  return (
    <ScreenContainer scroll={false}>
      <EmptyState
        title="This account can't use the app"
        message="The MPX Global app is for buyers and exporters. Staff accounts are managed on the web platform."
      />
      <View style={styles.footer}>
        <Button label="Sign out" onPress={logout} variant="secondary" />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  footer: { paddingBottom: spacing[6] },
});
