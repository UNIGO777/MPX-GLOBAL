import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { Alert, Animated, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { organisationApi } from '../api/organisation.js';
import { Badge, VerifiedBadge } from '../components/Badge.jsx';
import { BrandWordmark } from '../components/BrandMark.jsx';
import { Button } from '../components/Button.jsx';
import { ErrorState, Spinner } from '../components/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { colors, radii, spacing, typography } from '../theme/index.js';
import { toAppError } from '../utils/errors.js';
import { KYC_STATUS_CHIP } from '../utils/kycStatus.js';
import { PORTAL_LABEL } from './auth/portals.js';

/**
 * Screen 16 · Profile — the last tab, shared by both roles.
 *
 * 🔴 Biometric unlock is deliberately NOT on this screen (owner, 2026-08-05).
 * `expo-local-authentication` is installed and `secureStorage` already carries
 * a flag for it, but the actual re-entry gate (design brief screen 17) is not
 * built. Rendering a toggle with nothing behind it would be exactly the
 * "live-looking control that silently does nothing" this project's rules
 * forbid — it returns once screen 17 exists to give it something to control.
 *
 * Company name / verified tick / status chips all come from `/me/organisation`
 * — `/auth/me` (what AuthContext holds) never carried them, so this screen
 * loads its own copy rather than inventing fields on the auth user.
 *
 * 🆕 2026-08-16 — visual pass against an owner-approved mockup ("Executive
 * Navy" direction). Light top bar carries the "Profile" screen label; a navy
 * hero below it shows the PERSON's name (real `user.name`, big) + avatar
 * (halo ring + tinted glow shadow — no new dependency, no `expo-linear-
 * gradient`) + "Account and settings."; a white sheet with rounded top
 * corners rises over it, same visual seam `NavyCanopy` uses elsewhere.
 * Icon-in-circle treatment on every row; rows grouped into 3 cards; "Change
 * password" relabelled "Security" (same destination); About condensed to one
 * info row + a merged "Terms & Privacy" row (shown "DISABLED", matching the
 * mockup's own row-specific label — `Notifications` keeps "Coming soon",
 * intentionally not unified); richer full-width pill Sign-out with an icon.
 * The bottom tab bar's raised-circle active-tab treatment is shared app-wide
 * (`navigation/tabIcon.jsx`), not special-cased here.
 *
 * ⚠️ Does NOT use `<NavyCanopy>` (unlike every other screen) — deliberately.
 * That component's header is STATIC BY DESIGN (owner, 2026-08-03) so a
 * keyboard never covers a form's fields. Profile has no text input at all, so
 * that trade-off never applied here, and once this screen's own hero grew
 * tall (avatar + name + subtitle, plus its own top bar) a static header ate
 * too much permanent screen height — flagged directly ("need to scroll on
 * all the page why only the down box are scrolling") and fixed by making the
 * WHOLE screen one continuous `ScrollView`: navy hero and the white cards
 * scroll together underneath a thin STICKY header. See `NavyCanopy.jsx`'s own
 * note on this.
 *
 * 🆕 2026-08-16 (later) — sticky, scroll-reactive header: `Animated.ScrollView`
 * tracks scroll offset; a thin `Animated.View` pinned at the top (`position:
 * absolute`, `pointerEvents="none"` so it never blocks the scroll gesture
 * beneath it) crossfades its background from navy to white — and its
 * "Profile" text from white to ink — over the first `HEADER_FADE_DISTANCE`
 * px of scroll (clamped, so it settles once past that and never overshoots).
 * At scroll-top it blends into the navy hero (same colour, so it reads as
 * one surface); scroll even slightly and it solidifies into a normal white
 * nav bar with a hairline border that fades in with it. The React Navigation
 * native tab header is turned off for this screen (`headerShown: false` in
 * both navigators) — it was duplicating this title.
 *
 * 🆕 2026-08-16 (later 2) — status bar icons now switch light/dark WITH the
 * header's own crossfade (`expo-status-bar`, was never used anywhere in the
 * app — confirmed via a repo-wide search; `NavyCanopy.jsx`/`ScreenContainer.jsx`
 * got the same fix, but both of THEIRS is a fixed style since their own
 * backgrounds never change colour. Profile's does, so a fixed style would be
 * wrong on one side of the scroll). `Animated.event`'s `listener` option
 * (fires alongside the native-driver-free scrollY mapping, plain JS) flips a
 * `useState` boolean past the same `HEADER_FADE_DISTANCE / 2` the visual
 * crossfade uses, so the icon colour switches right as the header visually
 * reads as "more white than navy" rather than at the very end of the fade.
 *
 * Two things still deliberately not built, even on the "match the mockup
 * exactly" pass — not a style call, an honesty one:
 * - No real photo. Checked the backend again — `User`/`Organisation` have no
 *   avatar field anywhere. Hardcoding the mockup's stock photo would show a
 *   fabricated person's face to every real user (same reasoning the landing
 *   page's fake testimonials were never built on). Icon-in-halo stays.
 * - No hamburger/gear icon in the top bar — there is no drawer nav and no
 *   second Settings screen for either to open (Profile already IS the
 *   settings hub); a tap target that never responds is worse than omitting it.
 */
export function ProfileScreen({ navigation }) {
  const { user, role, logout } = useAuth();
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setOrg(await organisationApi.mine());
    } catch (err) {
      setLoadError(toAppError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch on focus: the user lands back here right after verifying, editing
  // the company profile, or changing their password — a stale status chip
  // would contradict the screen they just came from.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmLogout = () => {
    const portalLabel = PORTAL_LABEL[role] ?? 'account';
    // Confirm first, and say WHICH account: a person may hold both a buyer and
    // an exporter account (§A21, independent sessions), so "Sign out?" alone
    // would leave them unsure whether they just lost the other one too.
    Alert.alert(
      'Sign out?',
      `This signs out of your ${portalLabel} account only. Your other portal accounts will remain signed in.`,
      [
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
      ],
    );
  };

  const portalLabel = PORTAL_LABEL[role] ?? 'Account';
  const verified = org?.kycStatus === 'verified';
  const chip = org ? KYC_STATUS_CHIP[org.kycStatus] : null;
  const appVersion = Constants.expoConfig?.version ?? '—';

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerBg = scrollY.interpolate({
    inputRange: [0, HEADER_FADE_DISTANCE],
    outputRange: [colors.primary[800], colors.surface.DEFAULT],
    extrapolate: 'clamp',
  });
  const headerTitleColor = scrollY.interpolate({
    inputRange: [0, HEADER_FADE_DISTANCE],
    outputRange: [colors.white, colors.ink[900]],
    extrapolate: 'clamp',
  });
  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_FADE_DISTANCE],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Status bar icons can't crossfade like the header can — `expo-status-bar`
  // only takes a discrete style — so they flip once past the midpoint of the
  // same fade distance, via the scroll listener below (plain JS state, not
  // the Animated.Value itself).
  const [statusBarDark, setStatusBarDark] = useState(false);
  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: false,
    listener: (e) => {
      const solid = e.nativeEvent.contentOffset.y > HEADER_FADE_DISTANCE / 2;
      setStatusBarDark((prev) => (prev === solid ? prev : solid));
    },
  });

  return (
    <View style={styles.screen}>
      <StatusBar style={statusBarDark ? 'dark' : 'light'} />
      {/* Sticky, scroll-reactive header — blue at the top (blends into the
          navy hero underneath it), crossfades to a solid white bar with a
          hairline border within the first HEADER_FADE_DISTANCE px of scroll.
          `pointerEvents="none"`: it's pure display, never blocks scrolling. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.stickyHeader,
          { paddingTop: insets.top + spacing[2], backgroundColor: headerBg, borderBottomColor: colors.surface.border },
        ]}
      >
        <Animated.View style={[styles.stickyHeaderBorder, { opacity: headerBorderOpacity }]} />
        <Animated.Text style={[styles.topBarTitle, { color: headerTitleColor }]}>Profile</Animated.Text>
      </Animated.View>

      <Animated.ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        refreshControl={<RefreshControl refreshing={loading && Boolean(org)} onRefresh={load} tintColor={colors.primary[600]} />}
      >
        {/* Navy hero — the PERSON's identity, not the screen name. Extra top
            padding (insets.top) reserves the same space the sticky header
            occupies, so its content clears the header instead of sitting
            underneath it. */}
        <View style={[styles.hero, { paddingTop: insets.top + spacing[6] + STICKY_HEADER_CONTENT_HEIGHT }]}>
          <BrandWordmark />
          <View style={styles.avatarHalo}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={40} color={colors.primary[600]} accessible={false} />
              </View>
            </View>
          </View>
          <Text style={styles.heroName} numberOfLines={1}>
            {user?.name ?? 'Your account'}
          </Text>
          <Text style={styles.heroSubtitle}>Account and settings.</Text>
        </View>

        {/* White sheet rising over the navy — same rounded-seam convention
            `NavyCanopy` uses everywhere else, just inline here since the
            whole page scrolls as one now. */}
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[8]) }]}>
          {loading && !org ? (
            <Spinner label="Loading your profile…" />
          ) : loadError ? (
            <ErrorState error={loadError} onRetry={load} />
          ) : (
            <View style={styles.body}>
              {/* Real contact + account-type details — the mockup's hero
                  didn't show these, but dropping real information for a
                  visual refresh would be a regression, so they sit just
                  below the seam. */}
              <View style={styles.identity}>
                {user?.email ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="mail-outline" size={14} color={colors.muted} accessible={false} />
                    <Text style={styles.metaText}>{user.email}</Text>
                  </View>
                ) : null}
                {user?.mobile ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="call-outline" size={14} color={colors.muted} accessible={false} />
                    <Text style={styles.metaText}>{user.mobile}</Text>
                  </View>
                ) : null}

                {/* Which portal this account is — the one thing that matters
                    most for someone who holds both a buyer and an exporter
                    account. */}
                <View style={styles.portalPill}>
                  <Text style={styles.portalPillText}>{portalLabel} account</Text>
                </View>

                {org?.name ? (
                  <View style={styles.companyPill}>
                    {verified ? (
                      <Ionicons name="shield-checkmark" size={15} color={colors.success} accessible={false} />
                    ) : (
                      <Ionicons name="business-outline" size={15} color={colors.ink[500]} accessible={false} />
                    )}
                    <Text style={styles.companyPillText} numberOfLines={1}>
                      {org.name}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Company profile + verification — status previews only; the
                  real status chip lives on the screens they open. */}
              <View style={styles.card}>
                <Row
                  icon="business-outline"
                  label="Company profile"
                  onPress={() => navigation.navigate('CompanyProfile')}
                  right={verified ? <VerifiedBadge verified /> : chip ? <Badge tone={chip.tone} label={chip.label} /> : null}
                />
                <Divider />
                <Row
                  icon="shield-checkmark-outline"
                  label="Verification"
                  onPress={() => navigation.navigate('KycHub')}
                  right={verified ? <VerifiedBadge verified /> : chip ? <Badge tone={chip.tone} label={chip.label} /> : null}
                />
              </View>

              <View style={styles.card}>
                <Row icon="lock-closed-outline" label="Security" onPress={() => navigation.navigate('ChangePassword')} />
                <Divider />
                {/* Visibly non-functional — the whole layer arrives later
                    (D5). No chevron: nothing here should look tappable. */}
                <Row icon="notifications-off-outline" label="Notifications" disabled right={<ComingSoon />} />
              </View>

              <View style={styles.card}>
                <Row
                  icon="information-circle-outline"
                  label="About"
                  right={<Text style={styles.rowValue}>App version {appVersion}</Text>}
                />
                <Divider />
                {/* Neither Terms nor Privacy exist yet anywhere (app or web)
                    — merged into one honestly-inert row rather than two dead
                    links. */}
                <Row
                  icon="document-text-outline"
                  label="Terms &amp; Privacy"
                  disabled
                  right={<Text style={styles.disabledTag}>DISABLED</Text>}
                />
              </View>

              <Button
                label="Sign out"
                icon="log-out-outline"
                variant="danger"
                onPress={confirmLogout}
                loading={signingOut}
                disabled={signingOut}
                style={styles.signOut}
              />
            </View>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function Row({ icon, label, onPress, right, disabled = false }) {
  const iconCircle = disabled ? styles.iconCircleMuted : styles.iconCircle;
  const iconColor = disabled ? colors.ink[400] : colors.primary[600];
  const content = (
    <View style={styles.rowInner}>
      <View style={iconCircle}>
        <Ionicons name={icon} size={18} color={iconColor} accessible={false} />
      </View>
      <Text style={disabled ? styles.rowLabelDisabled : styles.rowLabel}>{label}</Text>
      {right}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.ink[400]} accessible={false} /> : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {content}
    </Pressable>
  );
}

function ComingSoon() {
  return (
    <View style={styles.comingSoon}>
      <Text style={styles.comingSoonText}>Coming soon</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const AVATAR_SIZE = 88;
const SHEET_RADIUS = 28;
// Roughly the sticky header's own rendered height (safe-area top excluded —
// that's added separately wherever this is used) — the hero's top padding
// reserves this much extra space so its content starts BELOW the header
// instead of underneath it. Only matters once the header has solidified to
// white; at scroll-top both are the same navy, so a little overlap there is
// invisible anyway.
const STICKY_HEADER_CONTENT_HEIGHT = 44;
// How many px of scroll the header takes to fully crossfade blue → white —
// deliberately small ("2-3%", i.e. almost immediately) so it reads as a
// quick solidify, not a slow scrub.
const HEADER_FADE_DISTANCE = 40;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.primary[800] },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
    alignItems: 'center',
  },
  stickyHeaderBorder: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface.border,
  },
  topBarTitle: { ...typography.h2 },

  hero: {
    backgroundColor: colors.primary[800],
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    // paddingTop is set inline (needs insets.top) — see the JSX.
    // The sheet rises over this by SHEET_RADIUS — same margin math NavyCanopy
    // uses, so the visible gap under the subtitle doesn't collapse to zero.
    paddingBottom: spacing[10] + SHEET_RADIUS,
  },

  // Three nested layers create the "halo" without a gradient dependency:
  // an outer soft-tinted glow shadow, a thin coloured ring, then the icon disc.
  avatarHalo: {
    width: AVATAR_SIZE + 16,
    height: AVATAR_SIZE + 16,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[5],
    marginBottom: spacing[3],
    shadowColor: colors.primary[600],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 8,
  },
  avatarRing: {
    width: AVATAR_SIZE + 10,
    height: AVATAR_SIZE + 10,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.primary[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radii.full,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: { ...typography.display, color: colors.white, textAlign: 'center' },
  heroSubtitle: { ...typography.body, color: colors.primary[100], marginTop: spacing[2] },

  // Rises over the hero — same visual seam as NavyCanopy's sheet.
  // paddingBottom is set inline (needs insets.bottom — see the JSX).
  sheet: {
    marginTop: -SHEET_RADIUS,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    backgroundColor: colors.surface.DEFAULT,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    flexGrow: 1,
  },

  body: { gap: spacing[4] },

  identity: { alignItems: 'center', gap: spacing[1], paddingVertical: spacing[3] },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  metaText: { ...typography.caption, color: colors.muted },

  portalPill: {
    marginTop: spacing[3],
    backgroundColor: colors.primary[700],
    borderRadius: radii.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    shadowColor: colors.primary[700],
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  portalPillText: { ...typography.bodyStrong, color: colors.white },

  companyPill: {
    marginTop: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.surface.DEFAULT,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radii.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    maxWidth: '90%',
  },
  companyPillText: { ...typography.label, color: colors.ink[700], flexShrink: 1 },

  card: {
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    overflow: 'hidden',
    shadowColor: colors.ink[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  row: { minHeight: 56, justifyContent: 'center' },
  rowPressed: { backgroundColor: colors.ink[100] },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 56,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: radii.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleMuted: {
    width: 34,
    height: 34,
    borderRadius: radii.full,
    backgroundColor: colors.ink[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { ...typography.body, color: colors.ink[900], flex: 1 },
  rowLabelDisabled: { ...typography.body, color: colors.ink[400], flex: 1 },
  rowValue: { ...typography.body, color: colors.muted },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface.border,
    marginLeft: spacing[4] + 34 + spacing[3],
  },

  comingSoon: {
    backgroundColor: colors.ink[100],
    borderRadius: radii.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  comingSoonText: { ...typography.tiny, color: colors.muted, fontWeight: '600' },
  disabledTag: { ...typography.tiny, color: colors.ink[400], fontWeight: '700', letterSpacing: 0.5 },

  signOut: {
    marginTop: spacing[2],
    borderRadius: radii.full,
    shadowColor: colors.danger.DEFAULT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4,
  },
});
