import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { catalogueApi } from '../api/catalogue.js';
import { inquiriesApi } from '../api/inquiries.js';
import { findCountry } from '../constants/countries.js';
import { Button } from '../components/Button.jsx';
import { EmptyState, ErrorState, Skeleton } from '../components/Feedback.jsx';
import { useToast } from '../components/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { colors, radii, spacing, typography } from '../theme/index.js';
import { toAppError } from '../utils/errors.js';

/**
 * M2 app screen 3 — product detail ("the screen buyers judge the platform
 * by", design brief §4). Built 2026-08-18; product cards everywhere now tap
 * through here instead of the "coming soon" alert.
 *
 * Two fetches, by design: the product (public projection, id or slug) and
 * its category's attribute DEFINITIONS — the product stores `{key, value}`
 * snapshots only, and the labels/units live on the category (same split
 * web's SpecTable documents). A value whose definition was since deleted
 * still renders under its raw key — the seller did enter it.
 *
 * Brief rules kept, not re-decided:
 * - Gallery: full-width pager, dots + "2/5" counter, designed no-image
 *   fallback (images are optional at publish).
 * - Price is information in all three modes — "Price on request" is never
 *   styled as an absence. Unit shown when the product has one. No currency
 *   conversion in this phase (§A27.1) — ISO code as-is.
 * - Facts strip renders ONLY filled fields (goods and service sets differ);
 *   a sparse listing must still look intentional.
 * - 🔴 No status word, no takedown trace, no "seller not yet verified" line.
 *   404 covers every unavailable case indistinguishably.
 * - 🆕 2026-08-18 — REAL "Send Enquiry" (owner ask; M4 Enquiry & Chat is
 *   month-1 scope and its backend shipped): a pinned footer button opens a
 *   compose sheet — the required 1–200-char note (the enquiry's only free
 *   text, M4-7) — and `POST /inquiries` creates the whole thread server-side.
 *   Buyers only (`role === 'buyer'` hides it; the server enforces the role,
 *   the buyer-side-org check AND the self-enquiry guard — a rejection's
 *   message surfaces in the toast). 201 vs 200 is told to the user honestly:
 *   a second enquiry never opens a second thread (M4-5). The thread itself
 *   lives in the Messages tab once M4's chat screens ship — the toast says
 *   where it went rather than pretending there's nothing to see yet.
 * - Seller card taps toward the supplier profile — NOT BUILT (M2 screen 4),
 *   so it shows the honest coming-soon alert; ledgered in UiWebNotes.
 * - Share omitted for now: the OS share needs the real public web URL and
 *   the app has no web-origin config — inventing one would ship a broken
 *   link. Flagged, not silently skipped.
 */
const WINDOW_WIDTH = Dimensions.get('window').width;
// Title bar fades in as the square gallery scrolls mostly out of view.
const BAR_REVEAL_START = WINDOW_WIDTH * 0.45;
const BAR_REVEAL_END = WINDOW_WIDTH * 0.75;

// Fixed-field rows, per type — label + payload key, rendered only when filled.
const GOODS_FACTS = [
  ['MOQ', 'moqLine'], // synthesised below so the unit rides along
  ['HS code', 'hsCode'],
  ['Country of origin', 'originName'],
  ['Supply ability', 'supplyAbility'],
  ['Lead time', 'leadTime'],
  ['Packaging', 'packaging'],
  ['Payment terms', 'terms'],
];
const SERVICE_FACTS = [
  ['Engagement type', 'engagementType'],
  ['Delivery model', 'deliveryModel'],
  ['Team size', 'teamSize'],
  ['Pricing model', 'pricingModel'],
  ['Timeline', 'timeline'],
];

export function ProductDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { role } = useAuth();
  const { idOrSlug } = route.params ?? {};
  const [state, setState] = useState({ loading: true, error: null, product: null, defs: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  // Reveal-on-scroll title bar (owner, 2026-08-18: "on scroll we also need a
  // header") — same pattern as Home's: the floating back circle serves the
  // top-of-page state over the gallery, and once the gallery scrolls mostly
  // away a solid white bar (back + product name) fades in while the circle
  // fades out. `barVisible` (plain state, from the scroll listener) drives
  // `pointerEvents` so whichever control is invisible can't eat taps.
  const scrollY = useRef(new Animated.Value(0)).current;
  const [barVisible, setBarVisible] = useState(false);
  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
    listener: (e) => {
      const shouldShow = e.nativeEvent.contentOffset.y > BAR_REVEAL_END - 40;
      setBarVisible((prev) => (prev === shouldShow ? prev : shouldShow));
    },
  });
  const barOpacity = scrollY.interpolate({
    inputRange: [BAR_REVEAL_START, BAR_REVEAL_END],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const circleOpacity = scrollY.interpolate({
    inputRange: [BAR_REVEAL_START, BAR_REVEAL_END],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const product = await catalogueApi.product(idOrSlug);
        // Labels ride along but never block the product — a failed defs read
        // just renders specs under their raw keys.
        const defs = await catalogueApi.categoryAttributes(product.category?.slug ?? product.category?.id).catch(() => []);
        setState({ loading: false, error: null, product, defs });
      } catch (error) {
        setState((s) => ({ ...s, loading: false, error: toAppError(error) }));
      } finally {
        if (isRefresh) setRefreshing(false);
      }
    },
    [idOrSlug],
  );

  useEffect(() => {
    load();
  }, [load]);

  const { loading, error, product, defs } = state;

  const header = (
    <Animated.View
      pointerEvents={barVisible ? 'none' : 'auto'}
      style={[styles.headerOverlay, { top: insets.top + spacing[2], opacity: circleOpacity }]}
    >
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={styles.backCircle}
      >
        <Ionicons name="arrow-back" size={22} color={colors.ink[900]} />
      </Pressable>
    </Animated.View>
  );

  if (loading && !product) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />
        <DetailSkeleton topInset={insets.top} />
        {header}
      </View>
    );
  }

  if (error && !product) {
    const notFound = error.status === 404;
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        {notFound ? (
          <EmptyState
            icon="cube-outline"
            title="Product not available"
            message="It may have been removed or the link is out of date."
            actionLabel="Go back"
            onAction={() => navigation.goBack()}
          />
        ) : (
          <ErrorState error={error} onRetry={load} />
        )}
        {header}
      </View>
    );
  }

  const images = product.images ?? [];
  const price = formatPrice(product.price, product.unit);
  const listed = formatListedSince(product.listedSince);
  const seller = product.seller ?? {};
  const sellerCountry = seller.country ? findCountry(seller.country)?.name ?? seller.country : null;

  // Facts — synthesise the two derived values, then keep only filled rows.
  const isService = product.engagementType != null || product.deliveryModel != null || product.pricingModel != null;
  const factSource = {
    ...product,
    moqLine: product.moq != null ? `${product.moq.toLocaleString('en-IN')}${product.unit ? ` ${product.unit}` : ''}` : null,
    originName: product.countryOfOrigin ? findCountry(product.countryOfOrigin)?.name ?? product.countryOfOrigin : null,
  };
  const facts = (isService ? SERVICE_FACTS : GOODS_FACTS)
    .map(([label, key]) => [label, factSource[key]])
    .filter(([, value]) => value != null && value !== '');

  const defByKey = new Map(defs.map((d) => [d.key, d]));
  const specs = (product.attributes ?? []).filter((a) => a.value !== null && a.value !== undefined && a.value !== '');

  // 2026-08-18 — real destination: M2 screen 4.
  const openSeller = () => navigation.navigate('SupplierProfile', { idOrSlug: seller.slug ?? seller.id });

  const isBuyer = role === 'buyer';

  const sendEnquiry = async () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const result = await inquiriesApi.create({ productId: product.id, note: trimmed });
      setEnquiryOpen(false);
      setNote('');
      toast.show(
        result.created
          ? `Enquiry sent to ${seller.name}. Find the conversation in Messages once chat launches.`
          : 'You already have a conversation about this product — this seller can see it.',
        { tone: 'success', duration: 5000 },
      );
    } catch (error) {
      // The server's own message (self-enquiry guard, rate limit…) — never
      // invent detail it withheld.
      toast.show(toAppError(error).message, { tone: 'danger' });
    } finally {
      setSending(false);
    }
  };

  // Footer clearance: the pinned Send Enquiry bar (buyers only). The guard
  // floor (spacing[6]) keeps the last content clear of Android's translucent
  // gesture-nav strip even when the inset reports 0 — the "bottom safe area
  // not working" fix (owner, 2026-08-18), same treatment on every pushed
  // catalogue screen.
  const bottomClearance = Math.max(insets.bottom, spacing[6]) + (isBuyer ? spacing[16] + spacing[6] : spacing[8]);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <Animated.ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomClearance }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary[600]} />
        }
      >
        {/* Gallery — full-width pager. The counter/dots only render with 2+
            images; a single image is just an image, not a carousel of one. */}
        <View>
          {images.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setGalleryIndex(Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width))
              }
            >
              {images.map((uri) => (
                <Image key={uri} source={{ uri }} style={styles.galleryImage} />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.galleryImage, styles.galleryFallback]}>
              <Ionicons name="image-outline" size={42} color={colors.ink[300]} accessible={false} />
              <Text style={styles.galleryFallbackText}>No photos yet</Text>
            </View>
          )}
          {images.length > 1 ? (
            <>
              <View style={styles.galleryCounter}>
                <Text style={styles.galleryCounterText}>
                  {galleryIndex + 1}/{images.length}
                </Text>
              </View>
              <View style={styles.galleryDots}>
                {images.map((uri, i) => (
                  <View key={uri} style={[styles.dot, i === galleryIndex && styles.dotActive]} />
                ))}
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.body}>
          <Text style={styles.name}>{product.name}</Text>
          {listed ? <Text style={styles.listed}>Listed {listed}</Text> : null}
          <Text style={styles.price}>{price}</Text>

          {/* Seller card — name + tick + country + entity type. Never contact
              details (brief). */}
          <Pressable
            onPress={openSeller}
            accessibilityRole="button"
            accessibilityLabel={`Seller: ${seller.name}`}
            style={({ pressed }) => [styles.sellerCard, pressed && styles.pressed]}
          >
            <View style={styles.sellerLogoWrap}>
              {seller.logo ? (
                <Image source={{ uri: seller.logo }} style={styles.sellerLogo} />
              ) : (
                <Text style={styles.sellerMonogram}>{initials(seller.name)}</Text>
              )}
            </View>
            <View style={styles.sellerText}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName} numberOfLines={1}>
                  {seller.name}
                </Text>
                {seller.verified ? (
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} accessible={false} />
                ) : null}
              </View>
              <Text style={styles.sellerMeta} numberOfLines={1}>
                {[sellerCountry, humanise(seller.entityType)].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.ink[400]} accessible={false} />
          </Pressable>

          {facts.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>{isService ? 'Service details' : 'Trade details'}</Text>
              <View style={styles.factsCard}>
                {facts.map(([label, value], i) => (
                  <View key={label} style={[styles.factRow, i > 0 && styles.factRowBorder]}>
                    <Text style={styles.factLabel}>{label}</Text>
                    <Text style={styles.factValue} numberOfLines={2}>
                      {String(value)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {product.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>Description</Text>
              <Text style={styles.description} numberOfLines={descExpanded ? undefined : 6}>
                {product.description}
              </Text>
              {product.description.length > 240 ? (
                <Pressable onPress={() => setDescExpanded((v) => !v)} accessibilityRole="button" hitSlop={8}>
                  <Text style={styles.readMore}>{descExpanded ? 'Read less' : 'Read more'}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {specs.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>Specifications</Text>
              <View style={styles.factsCard}>
                {specs.map((attr, i) => {
                  const def = defByKey.get(attr.key);
                  return (
                    <View key={attr.key} style={[styles.factRow, i > 0 && styles.factRowBorder]}>
                      <Text style={styles.factLabel}>{def?.name ?? humanise(attr.key)}</Text>
                      <Text style={styles.factValue} numberOfLines={2}>
                        {presentSpec(attr.value, def)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>
      {header}
      {/* Revealed title bar — solid, above everything once scrolled. */}
      <Animated.View
        pointerEvents={barVisible ? 'auto' : 'none'}
        style={[styles.titleBar, { paddingTop: insets.top + spacing[2], opacity: barOpacity }]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.titleBarBack}
        >
          <Ionicons name="arrow-back" size={22} color={colors.ink[900]} />
        </Pressable>
        <Text style={styles.titleBarText} numberOfLines={1}>
          {product.name}
        </Text>
      </Animated.View>

      {/* Pinned enquiry bar — buyers only (server re-checks regardless). */}
      {isBuyer ? (
        <View style={[styles.enquiryBar, { paddingBottom: Math.max(insets.bottom, spacing[4]) }]}>
          <Button label="Send Enquiry" onPress={() => setEnquiryOpen(true)} />
        </View>
      ) : null}

      {/* Compose sheet — the note is the enquiry's ONLY free text (M4-7). */}
      <Modal visible={enquiryOpen} transparent animationType="slide" onRequestClose={() => setEnquiryOpen(false)}>
        <KeyboardAvoidingView style={styles.sheetScrim} behavior="padding">
          <Pressable style={styles.sheetScrimTouch} onPress={() => !sending && setEnquiryOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[5]) }]}>
            <Text style={styles.sheetTitle}>Send enquiry</Text>
            <Text style={styles.sheetSubtitle} numberOfLines={2}>
              {product.name} · {seller.name}
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="What would you like to ask? Quantity, specs, delivery…"
              placeholderTextColor={colors.ink[400]}
              multiline
              maxLength={200}
              style={styles.sheetInput}
              accessibilityLabel="Enquiry message"
              autoFocus
            />
            <Text style={styles.sheetCounter}>{note.trim().length}/200</Text>
            <Text style={styles.sheetNote}>
              This starts a conversation with the seller. MPX Global stays part of the thread.
            </Text>
            <Button
              label="Send"
              onPress={sendEnquiry}
              loading={sending}
              disabled={note.trim().length === 0}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function DetailSkeleton({ topInset }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading product">
      <Skeleton width="100%" height={WINDOW_WIDTH} radius={0} />
      <View style={[styles.body, { paddingTop: spacing[4] }]}>
        <Skeleton width="80%" height={22} />
        <Skeleton width="35%" height={14} style={{ marginTop: spacing[2] }} />
        <Skeleton width="50%" height={24} style={{ marginTop: spacing[3] }} />
        <Skeleton width="100%" height={72} radius={radii.lg} style={{ marginTop: spacing[4] }} />
      </View>
      {/* keeps the skeleton below the translucent back button */}
      <View style={{ height: topInset }} />
    </View>
  );
}

/** Booleans read Yes/No, numbers carry the definition's unit ("120 gsm") —
 *  web SpecTable's rules, unchanged. */
function presentSpec(value, def) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' && def?.unit) return `${value.toLocaleString('en-IN')} ${def.unit}`;
  if (typeof value === 'number') return value.toLocaleString('en-IN');
  return String(value);
}

function formatPrice(price, unit) {
  const { mode, min, max, currency } = price ?? {};
  const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-IN') : n);
  const suffix = unit ? ` / ${unit}` : '';
  if (mode === 'on_request' || (min == null && max == null)) return 'Price on request';
  if (mode === 'range') return `${currency} ${fmt(min)}–${fmt(max)}${suffix}`;
  return `${currency} ${fmt(min)}${suffix}`;
}

function formatListedSince(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

/** "private_limited" → "Private limited" — display fallback only. */
function humanise(value) {
  if (!value) return null;
  const s = String(value).replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function initials(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.DEFAULT },

  headerOverlay: { position: 'absolute', left: spacing[5], zIndex: 10 },
  titleBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 11,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
    backgroundColor: colors.surface.DEFAULT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  titleBarBack: { width: 32, alignItems: 'flex-start', justifyContent: 'center' },
  titleBarText: { ...typography.h3, color: colors.ink[900], flex: 1 },
  backCircle: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
  },

  galleryImage: { width: WINDOW_WIDTH, height: WINDOW_WIDTH, backgroundColor: colors.ink[50] },
  galleryFallback: { alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  galleryFallbackText: { ...typography.caption, color: colors.muted },
  galleryCounter: {
    position: 'absolute',
    top: spacing[3],
    right: spacing[3],
    backgroundColor: colors.scrim,
    borderRadius: radii.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
  },
  galleryCounterText: { ...typography.tiny, color: colors.white, fontWeight: '600' },
  galleryDots: {
    position: 'absolute',
    bottom: spacing[3],
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: radii.full, backgroundColor: 'rgba(255,255,255,0.6)' },
  dotActive: { backgroundColor: colors.white, width: 16 },

  body: { paddingHorizontal: spacing[5], paddingTop: spacing[4] },
  name: { ...typography.h2, color: colors.ink[900] },
  listed: { ...typography.caption, color: colors.muted, marginTop: 2 },
  price: { ...typography.h1, color: colors.ink[900], marginTop: spacing[2] },

  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[4],
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.DEFAULT,
  },
  pressed: { backgroundColor: colors.ink[50] },
  sellerLogoWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sellerLogo: { width: 44, height: 44 },
  sellerMonogram: { ...typography.label, color: colors.primary[700] },
  sellerText: { flex: 1 },
  sellerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sellerName: { ...typography.bodyStrong, color: colors.ink[900], flexShrink: 1 },
  sellerMeta: { ...typography.caption, color: colors.muted, marginTop: 1 },

  section: { marginTop: spacing[6] },
  sectionHeading: { ...typography.h3, color: colors.ink[900], marginBottom: spacing[3] },
  factsCard: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    paddingHorizontal: spacing[4],
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[4],
    paddingVertical: spacing[3],
  },
  factRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surface.border },
  factLabel: { ...typography.caption, color: colors.muted, flexShrink: 0 },
  factValue: { ...typography.caption, fontWeight: '600', color: colors.ink[900], flex: 1, textAlign: 'right' },

  description: { ...typography.body, color: colors.ink[700] },
  readMore: { ...typography.label, color: colors.primary[700], marginTop: spacing[2] },

  enquiryBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    backgroundColor: colors.surface.DEFAULT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface.border,
  },

  sheetScrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheetScrimTouch: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface.DEFAULT,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    gap: spacing[2],
  },
  sheetTitle: { ...typography.h3, color: colors.ink[900] },
  sheetSubtitle: { ...typography.caption, color: colors.muted },
  sheetInput: {
    ...typography.body,
    color: colors.ink[900],
    minHeight: 96,
    maxHeight: 160,
    textAlignVertical: 'top',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    borderRadius: radii.lg,
    padding: spacing[3],
    marginTop: spacing[2],
  },
  sheetCounter: { ...typography.tiny, color: colors.ink[400], alignSelf: 'flex-end' },
  sheetNote: { ...typography.tiny, color: colors.muted, marginBottom: spacing[2] },
});
