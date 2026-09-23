import { useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radii, spacing, typography, MIN_TOUCH_TARGET } from '../theme/index.js';
import { monogramTone } from '../utils/monogramTone.js';

/**
 * THE product card (owner, 2026-08-17: "for all my app use exact same product
 * card everywhere") — built to the owner-supplied mockup: borderless and
 * image-first. The photo tile IS the card: square, `radii.lg`, soft `ink-50`
 * ground behind the photo; below it, in open space with no box, the name,
 * the seller line and a large bold price. Used by the product listing grid
 * and Home's "Recently Listed" rail — one component so they can never drift.
 *
 * Honesty rules baked in, not left to call sites:
 * - Seller line shows the GREEN verified tick (`checkmark-circle`) only when
 *   the server-derived `verified` is true. The mockup drew a blue seal; green
 *   is this product's one app-wide verified colour (Badge.jsx, web) and the
 *   trust signal must not fork per surface — flagged to the owner, not
 *   silently swapped.
 * - Price renders the three real modes; unit ("/ kg") appended only when the
 *   product actually has one. No strikethrough compare-at price — no
 *   discount data exists. No ratings — no rating system exists.
 *
 * The heart is REAL (M3 saved items — same API as web's save button):
 * `savedId` = the saved ROW id when saved (needed to unsave), undefined
 * otherwise; `onToggleSave` omitted = heart not rendered at all (never a
 * dead control).
 *
 * @param {object} product       public search/listing projection
 * @param {func}   onPress       card tap
 * @param {string} [savedId]     saved row id when this product is saved
 * @param {func}   [onToggleSave] (product, savedId) => void — omit to hide the heart
 * @param {object} [style]       width override for horizontal rails
 * @param {func}   [onEnquire]   (product) => void — omit to hide the button
 *
 * TRADE DATA (2026-09-24, owner's mockup — web's card carries the same): MOQ /
 * lead time for goods, engagement / timeline for services, as a compact strip.
 * Empty cells are DROPPED rather than shown as dashes, and with nothing filled
 * the strip does not render — a seller who left lead time blank must not make
 * the card look broken.
 *
 * 🔴 `onEnquire` follows `onToggleSave`'s rule: OMIT IT AND NOTHING RENDERS,
 * never a dead control. It is deliberately not wired on the exporter's own list
 * (enquiring about your own listing is meaningless) and not in narrow
 * horizontal rails, where a full-width button would crowd the tile.
 *
 * 🔴 The mockup also put a "Verification pending" chip beside the seller. NOT
 * built: there is no "not verified" badge in this product — the ABSENCE of the
 * tick is the only signal, and a pending chip would leak review state onto a
 * buyer-facing surface.
 */
export function ProductCard({ product, onPress, savedId, onToggleSave, onEnquire, showStatus = false, style }) {
  // `ownView` (seller's own list) returns image REFS `{url, publicId}`; the
  // public projections return bare URL strings. Accept both rather than making
  // every call site normalise.
  const first = product.images?.[0];
  const cover = typeof first === 'string' ? first : first?.url;
  const saved = savedId != null;
  const statusChip = showStatus ? statusChipFor(product) : null;

  // Same spring press-response Home's tiles use — a touch response, not a loop.
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, friction: 6, tension: 300 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 300 }).start();

  return (
    <Pressable
      onPress={() => onPress?.(product)}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityRole="button"
      accessibilityLabel={product.name}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={styles.tile}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.image} />
          ) : (
            <View style={styles.imageFallback}>
              <Ionicons name="image-outline" size={28} color={colors.ink[300]} accessible={false} />
            </View>
          )}
          {/* Seller-side only (2026-08-18): the owner's own list shows
              lifecycle; a buyer-facing card must NEVER carry status. White
              pill so it stays legible on any photo; top-LEFT so it can never
              collide with the heart. `takedown` outranks status — a blocked
              product reads as blocked, not as Live. */}
          {statusChip ? (
            <View style={styles.statusChip}>
              <View style={[styles.statusDot, { backgroundColor: statusChip.fg }]} />
              <Text style={[styles.statusText, { color: statusChip.fg }]}>{statusChip.label}</Text>
            </View>
          ) : null}
          {onToggleSave ? (
            <Pressable
              onPress={() => onToggleSave(product, savedId)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Remove from saved' : 'Save product'}
              accessibilityState={{ selected: saved }}
              style={styles.heart}
            >
              <Ionicons
                name={saved ? 'heart' : 'heart-outline'}
                size={18}
                color={saved ? colors.primary[600] : colors.ink[500]}
                accessible={false}
              />
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        {product.seller?.name ? (
          <View style={styles.sellerRow}>
            {/* The company's LOGO when it has one (2026-09-24, as on the web);
                tinted initials otherwise. `logo` is public organisation data. */}
            {product.seller.logo ? (
              <Image source={{ uri: product.seller.logo }} style={styles.sellerLogo} accessible={false} />
            ) : (
              <View style={[styles.sellerLogo, { backgroundColor: monogramTone(product.seller.name).bg }]}>
                <Text style={[styles.sellerInitials, { color: monogramTone(product.seller.name).fg }]}>
                  {initialsOf(product.seller.name)}
                </Text>
              </View>
            )}
            <Text style={styles.sellerName} numberOfLines={1}>
              {product.seller.name}
            </Text>
            {product.seller.verified ? (
              <Ionicons name="checkmark-circle" size={14} color={colors.success} accessible={false} />
            ) : null}
          </View>
        ) : null}
        <Text style={styles.price} numberOfLines={1}>
          {formatPrice(product.price, product.unit)}
        </Text>

        {tradeCells(product).length > 0 ? (
          <View style={styles.trade}>
            {tradeCells(product).map(([label, value], i) => (
              <View key={label} style={[styles.tradeCell, i > 0 && styles.tradeDivider]}>
                <Text style={styles.tradeLabel} numberOfLines={1}>{label}</Text>
                <Text style={styles.tradeValue} numberOfLines={1}>{value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {onEnquire ? (
          <Pressable
            onPress={() => onEnquire(product)}
            accessibilityRole="button"
            accessibilityLabel={`Send enquiry about ${product.name}`}
            style={({ pressed }) => [styles.enquire, pressed && styles.enquirePressed]}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.white} accessible={false} />
            <Text style={styles.enquireText}>Send enquiry</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

/**
 * Two trade facts, chosen by the leaf's goods/service type — the same split
 * `Product` itself uses. Two, not three: the app's tile is far narrower than
 * web's card, and a third column truncated every value to noise.
 */
function tradeCells(product) {
  const cells =
    product.category?.type === 'service'
      ? [
          ['Engagement', product.engagementType],
          ['Timeline', product.timeline],
        ]
      : [
          [
            'MOQ',
            product.moq != null
              ? `${product.moq.toLocaleString()}${product.unit ? ` ${product.unit}` : ''}`
              : null,
          ],
          ['Lead time', product.leadTime],
        ];
  return cells.filter(([, value]) => value != null && value !== '');
}

/**
 * Seller-facing lifecycle chip (§1.2 vocabulary — Draft / Live / Hidden /
 * Archived). "Blocked" is an OVERLAY, not a status: a taken-down product
 * returns the takedown chip whatever its underlying status, because that is
 * the fact the seller has to act on. Never called for a buyer-facing card.
 */
function statusChipFor(product) {
  if (product.takedown) return { label: 'Taken down', fg: colors.danger.DEFAULT };
  switch (product.status) {
    case 'active':
      return { label: 'Live', fg: '#05603A' };
    case 'draft':
      return { label: 'Draft', fg: colors.ink[600] };
    case 'inactive':
      return { label: 'Hidden', fg: '#93370D' };
    case 'archived':
      return { label: 'Archived', fg: colors.ink[500] };
    default:
      return null;
  }
}

/** Three real modes (mirrors web's PriceLine): fixed / range / on request.
 *  No currency conversion in this phase (§A27.1) — ISO code as-is; the unit
 *  suffix renders only when the product genuinely has one. */
function formatPrice(price, unit) {
  const { mode, min, max, currency } = price ?? {};
  const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-IN') : n);
  const suffix = unit ? ` / ${unit}` : '';
  if (mode === 'on_request' || (min == null && max == null)) return 'Price on request';
  if (mode === 'range') return `${currency} ${fmt(min)}–${fmt(max)}${suffix}`;
  return `${currency} ${fmt(min)}${suffix}`;
}

const styles = StyleSheet.create({
  trade: {
    flexDirection: 'row',
    marginTop: spacing[2],
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface.subtle,
    overflow: 'hidden',
  },
  tradeCell: { flex: 1, minWidth: 0, paddingHorizontal: spacing[2], paddingVertical: spacing[1] },
  tradeDivider: { borderLeftWidth: 1, borderLeftColor: colors.surface.border },
  tradeLabel: { ...typography.tiny, color: colors.muted },
  tradeValue: { ...typography.caption, color: colors.ink[900], fontWeight: '600' },
  enquire: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radii.md,
    backgroundColor: colors.primary[600],
  },
  enquirePressed: { backgroundColor: colors.primary[700] },
  enquireText: { ...typography.label, color: colors.white },
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    backgroundColor: colors.ink[50],
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  imageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statusChip: {
    position: 'absolute',
    top: spacing[2],
    left: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 22,
    paddingHorizontal: spacing[2],
    borderRadius: radii.full,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
  },
  statusDot: { width: 6, height: 6, borderRadius: radii.full },
  statusText: { ...typography.tiny, fontWeight: '600' },
  heart: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
    width: 34,
    height: 34,
    borderRadius: radii.full,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // No reserved second line on the name (`minHeight` was here and read as a
  // hole in every card with a one-line name — owner flagged it against the
  // reference): the text stack sits tight, and a two-line name simply makes
  // its own card taller, exactly like the reference design.
  name: { ...typography.bodyStrong, color: colors.ink[900], marginTop: spacing[2] },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  sellerLogo: {
    width: 16,
    height: 16,
    borderRadius: radii.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ink[200],
  },
  sellerInitials: { fontSize: 7, fontWeight: '700' },
  sellerName: { ...typography.caption, color: colors.muted, flexShrink: 1 },
  price: { ...typography.h3, fontWeight: '700', color: colors.ink[900], marginTop: 2 },
});

function initialsOf(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || '?'
  );
}
