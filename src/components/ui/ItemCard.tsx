import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Shadows } from '../../constants/theme';
import { Item } from '../../types';

interface ItemCardProps {
  item: Item;
  onPress?: () => void;
  onToggleFavorite?: () => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onPress, onToggleFavorite }) => {
  const isFree = item.trade_mode === 'free';
  const isTrade = item.trade_mode === 'trade';
  const rating = Number(item.user?.rating) || 0;
  const hasTrustRow = Boolean(item.user?.is_verified) || rating > 0;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[styles.card, Shadows.card]}
      onPress={onPress}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item.images[0] }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />

        <View style={styles.ecoBadge}>
          <MaterialIcons name="eco" size={13} color={Colors.primary} />
          <Text style={styles.ecoBadgeText}>{item.eco_impact_rating}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>

        <View style={styles.rowMeta}>
          <MaterialIcons name="location-on" size={13} color={Colors.onSurfaceVariant} />
          <Text style={styles.distanceText} numberOfLines={1}>
            {item.distance_km != null ? `${item.distance_km} km away` : item.location_name}
          </Text>
        </View>

        {hasTrustRow ? (
          <View style={styles.trustRow}>
            {item.user?.is_verified ? (
              <View style={styles.verifiedBadge}>
                <MaterialIcons name="verified" size={11} color={Colors.primary} />
                <Text style={styles.verifiedText}>Verified Trader</Text>
              </View>
            ) : null}
            {rating > 0 ? (
              <View style={styles.ratingBadge}>
                <MaterialIcons name="star" size={12} color={Colors.star} />
                <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.footer}>
          <View style={[styles.modePill, isFree ? styles.modeFree : styles.modeTrade]}>
            <Text style={[styles.modeText, isFree ? styles.modeFreeText : styles.modeTradeText]}>
              {isFree ? 'Free' : isTrade ? 'Trade' : 'Auction'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.favButton}
            onPress={onToggleFavorite}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={
              item.is_favorite ? `Remove ${item.title} from saved items` : `Save ${item.title}`
            }
          >
            <MaterialIcons
              name={item.is_favorite ? 'favorite' : 'favorite-border'}
              size={19}
              color={item.is_favorite ? Colors.tertiary : Colors.primary}
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
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 138,
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
    backgroundColor: 'rgba(253, 250, 231, 0.95)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ecoBadgeText: {
    ...Typography.labelSm,
    color: Colors.primary,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 10,
  },
  title: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    fontWeight: '600',
    minHeight: 36,
    lineHeight: 18,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  distanceText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    flex: 1,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
    minHeight: 17,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.primary,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modePill: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  modeTrade: {
    backgroundColor: 'rgba(45, 90, 39, 0.1)',
  },
  modeFree: {
    backgroundColor: 'rgba(106, 33, 13, 0.1)',
  },
  modeText: {
    ...Typography.labelSm,
    fontSize: 10,
  },
  modeTradeText: {
    color: Colors.primaryContainer,
  },
  modeFreeText: {
    color: Colors.tertiary,
  },
  favButton: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(21, 66, 18, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
