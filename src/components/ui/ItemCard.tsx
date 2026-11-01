import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../../constants/theme';
import { Item } from '../../types';

interface ItemCardProps {
  item: Item;
  onPress?: () => void;
  onToggleFavorite?: () => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onPress, onToggleFavorite }) => {
  const isFree = item.trade_mode === 'free';
  const isTrade = item.trade_mode === 'trade';

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={[styles.card, Shadows.card]}
      onPress={onPress}
    >
      {/* Product Image */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item.images[0] }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />

        {/* Eco Score Badge */}
        <View style={styles.ecoBadge}>
          <MaterialIcons name="eco" size={13} color={Colors.primary} />
          <Text style={styles.ecoBadgeText}>{item.eco_impact_rating}</Text>
        </View>

        {/* CO2 Saved Pill */}
        {item.co2_saved_kg ? (
          <View style={styles.co2Badge}>
            <Text style={styles.co2BadgeText}>-{item.co2_saved_kg} kg CO₂</Text>
          </View>
        ) : null}
      </View>

      {/* Item Details */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>

        {/* Distance & Location */}
        <View style={styles.rowMeta}>
          <MaterialIcons name="location-on" size={13} color={Colors.onSurfaceVariant} />
          <Text style={styles.distanceText}>
            {item.distance_km ? `${item.distance_km} km away` : item.location_name}
          </Text>
        </View>

        {/* Trust Badges */}
        <View style={styles.badgeRow}>
          {item.user?.is_verified && (
            <View style={styles.verifiedBadge}>
              <MaterialIcons name="verified" size={11} color={Colors.primary} />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}

          {item.user?.rating ? (
            <View style={styles.ratingBadge}>
              <MaterialIcons name="star" size={12} color={Colors.star} />
              <Text style={styles.ratingText}>{item.user.rating.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>

        {/* Bottom Bar: Mode + Favorite Button */}
        <View style={styles.footer}>
          <View
            style={[
              styles.modePill,
              isFree ? styles.modeFree : styles.modeTrade,
            ]}
          >
            <Text
              style={[
                styles.modeText,
                isFree ? styles.modeFreeText : styles.modeTradeText,
              ]}
            >
              {isFree ? 'Free Gift' : isTrade ? 'Trade' : 'Auction'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.favButton}
            onPress={onToggleFavorite}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons
              name={item.is_favorite ? 'favorite' : 'favorite-border'}
              size={18}
              color={item.is_favorite ? Colors.error : Colors.secondary}
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.05)',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 140,
    backgroundColor: Colors.surfaceContainer,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  ecoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(253, 250, 231, 0.94)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ecoBadgeText: {
    ...Typography.labelSm,
    color: Colors.onSurface,
  },
  co2Badge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(21, 66, 18, 0.85)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  co2BadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.onPrimary,
  },
  content: {
    padding: Spacing.sm,
  },
  title: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    marginBottom: 4,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 6,
  },
  distanceText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    fontSize: 11,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(45, 90, 39, 0.1)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.primary,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(21, 66, 18, 0.04)',
  },
  modePill: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  modeTrade: {
    backgroundColor: 'rgba(45, 90, 39, 0.12)',
  },
  modeFree: {
    backgroundColor: 'rgba(106, 33, 13, 0.12)',
  },
  modeText: {
    ...Typography.labelSm,
  },
  modeTradeText: {
    color: Colors.primaryContainer,
  },
  modeFreeText: {
    color: Colors.tertiary,
  },
  favButton: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
