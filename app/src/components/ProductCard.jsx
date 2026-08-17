import { useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radii, spacing, typography } from '../theme/index.js';

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
 */
export function ProductCard({ product, onPress, savedId, onToggleSave, style }) {
  const cover = product.images?.[0];
  const saved = savedId != null;

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
      </Animated.View>
    </Pressable>
  );
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
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    backgroundColor: colors.ink[50],
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  imageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  sellerName: { ...typography.caption, color: colors.muted, flexShrink: 1 },
  price: { ...typography.h3, fontWeight: '700', color: colors.ink[900], marginTop: 2 },
});
