import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useAuthGuard } from '../../hooks/useAuthGuard';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, itemsLoading, toggleFavorite, ensureConversation } = useApp();
  const { user } = useAuth();
  const { guard } = useAuthGuard();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const item = items.find((it) => it.id === id);

  if (itemsLoading && !item) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.stateScreen}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.stateText}>Loading listing…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.stateScreen}>
          <MaterialIcons name="inventory-2" size={52} color={Colors.outline} />
          <Text style={styles.stateTitle}>Listing not available</Text>
          <Text style={styles.stateText}>
            This item may have been removed or the link is out of date.
          </Text>
          <TouchableOpacity style={styles.stateButton} onPress={() => router.back()}>
            <Text style={styles.stateButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isFavorite = item.is_favorite || false;
  const isOwnListing = Boolean(user && item.user_id === user.uid);

  const isFree = item.trade_mode === 'free';
  const isTrade = item.trade_mode === 'trade';

  const handleFavorite = () => {
    if (!guard('save favorites')) return;
    toggleFavorite(item.id).catch((error: Error) =>
      Alert.alert('Could not update favorite', error.message),
    );
  };

  const handleChat = () => {
    if (isOwnListing) {
      Alert.alert('Your listing', 'This is your own item. You can manage it from your profile.');
      return;
    }
    if (!guard('message this trader', { requireVerified: true })) return;
    if (!item.user) {
      Alert.alert('Unavailable', 'This trader has no profile yet.');
      return;
    }
    const conversationId = ensureConversation(item.id, item.user);
    router.push({ pathname: '/chat/[id]', params: { id: conversationId } } as never);
  };

  const handlePropose = () => {
    if (isOwnListing) {
      Alert.alert('Your listing', 'You cannot propose a trade on your own item.');
      return;
    }
    if (!guard('send a barter proposal', { requireVerified: true })) return;
    router.push({ pathname: '/proposal/[id]', params: { id: item.id } } as never);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Floating App Bar */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>

        <Text style={styles.navTitle} numberOfLines={1}>
          {item.title}
        </Text>

        <TouchableOpacity style={styles.navButton} onPress={handleFavorite} activeOpacity={0.8}>
          <MaterialIcons
            name={isFavorite ? 'favorite' : 'favorite-border'}
            size={22}
            color={isFavorite ? Colors.error : Colors.primary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Main Hero Gallery */}
        <View style={styles.galleryContainer}>
          <Image
            source={{ uri: item.images[selectedImageIndex] || item.images[0] }}
            style={styles.heroImage}
            contentFit="cover"
            transition={200}
          />

          {/* Eco Pill Overlay */}
          <View style={styles.galleryEcoBadge}>
            <MaterialIcons name="eco" size={14} color={Colors.primary} />
            <Text style={styles.galleryEcoText}>{item.eco_impact_rating} Eco-Score</Text>
          </View>

          {/* Multiple Image Thumbnails */}
          {item.images.length > 1 && (
            <View style={styles.thumbnailRow}>
              {item.images.map((img, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setSelectedImageIndex(idx)}
                  style={[
                    styles.thumbnailWrap,
                    selectedImageIndex === idx && styles.thumbnailActive,
                  ]}
                >
                  <Image source={{ uri: img }} style={styles.thumbnailImg} contentFit="cover" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Content Body */}
        <View style={styles.body}>
          {/* Header Row: Title & Trade Mode Pill */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{item.title}</Text>
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
                {isFree ? 'Free Gift' : isTrade ? 'Direct Trade' : 'Auction'}
              </Text>
            </View>
          </View>

          {/* Location & Time Posted */}
          <View style={styles.metaRow}>
            <MaterialIcons name="location-on" size={16} color={Colors.primary} />
            <Text style={styles.metaText}>
              {item.location_name} • {item.distance_km ? `${item.distance_km} km away` : 'Near you'}
            </Text>
          </View>

          {/* Condition & Category Badges */}
          <View style={styles.tagRow}>
            <View style={styles.tagChip}>
              <MaterialIcons name="check-circle" size={14} color={Colors.primary} />
              <Text style={styles.tagText}>Condition: {item.condition.replace('_', ' ').toUpperCase()}</Text>
            </View>
            <View style={styles.tagChip}>
              <MaterialIcons name="category" size={14} color={Colors.primary} />
              <Text style={styles.tagText}>{item.category_id.toUpperCase()}</Text>
            </View>
          </View>

          {/* Seller Trust Profile Card */}
          <View style={[styles.sellerCard, Shadows.card]}>
            <Image
              source={{ uri: item.user?.avatar_url }}
              style={styles.sellerAvatar}
              contentFit="cover"
            />
            <View style={styles.sellerDetails}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName}>{item.user?.full_name}</Text>
                {item.user?.is_verified && (
                  <View style={styles.verifiedBadge}>
                    <MaterialIcons name="verified" size={13} color={Colors.primary} />
                    <Text style={styles.verifiedText}>Verified Trader</Text>
                  </View>
                )}
              </View>
              <Text style={styles.sellerMeta}>
                ⭐ {item.user?.rating.toFixed(1)} rating • {item.user?.trade_count} successful haat trades
              </Text>
            </View>
          </View>

          {/* Item Description */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>Description</Text>
            <Text style={styles.descriptionText}>
              {item.description || 'No detailed description provided by the trader.'}
            </Text>
          </View>

          {/* Eco Impact Calculation Card */}
          <View style={styles.ecoCard}>
            <View style={styles.ecoIconBox}>
              <MaterialIcons name="compost" size={26} color={Colors.primary} />
            </View>
            <View style={styles.ecoTextBox}>
              <Text style={styles.ecoTitle}>Circular Haat Impact</Text>
              <Text style={styles.ecoDesc}>
                Swapping this item prevents <Text style={styles.ecoHighlight}>{item.co2_saved_kg} kg of CO₂</Text> from manufacturing a replacement!
              </Text>
            </View>
          </View>

          {/* Barter Preferences */}
          {isTrade && (
            <View style={styles.prefCard}>
              <View style={styles.prefHeader}>
                <MaterialIcons name="swap-horiz" size={20} color={Colors.primaryContainer} />
                <Text style={styles.prefTitle}>Trader&apos;s Exchange Wishlist</Text>
              </View>
              <Text style={styles.prefText}>
                Open to barter for vintage decor, books, study equipment, or gardening tools. Cash adjustments accepted.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={[styles.bottomBar, Shadows.tabBar]}>
        <TouchableOpacity style={styles.chatButton} onPress={handleChat} activeOpacity={0.8}>
          <MaterialIcons name="chat" size={22} color={Colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.proposeTradeButton}
          onPress={handlePropose}
          activeOpacity={0.88}
        >
          <MaterialIcons name="swap-calls" size={22} color={Colors.onPrimary} />
          <Text style={styles.proposeTradeText}>
            {isFree ? 'Claim Free Gift' : 'Propose Barter Exchange'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  stateScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  stateTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    marginTop: Spacing.md,
  },
  stateText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 6,
  },
  stateButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
  },
  stateButtonText: { ...Typography.labelLg, color: Colors.onPrimary },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.margin,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(21, 66, 18, 0.05)',
  },
  navButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(21, 66, 18, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    ...Typography.headlineSm,
    color: Colors.primary,
    maxWidth: '70%',
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: 110,
  },
  galleryContainer: {
    position: 'relative',
    width: '100%',
    height: 280,
    backgroundColor: Colors.surfaceContainer,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  galleryEcoBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(253, 250, 231, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  galleryEcoText: {
    ...Typography.labelMd,
    color: Colors.primary,
  },
  thumbnailRow: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    flexDirection: 'row',
    gap: 8,
  },
  thumbnailWrap: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: Colors.primary,
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
  },
  body: {
    padding: Spacing.margin,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  title: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
    flex: 1,
  },
  modePill: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  modeTrade: {
    backgroundColor: 'rgba(45, 90, 39, 0.12)',
  },
  modeFree: {
    backgroundColor: 'rgba(106, 33, 13, 0.12)',
  },
  modeText: {
    ...Typography.labelMd,
  },
  modeTradeText: {
    color: Colors.primaryContainer,
  },
  modeFreeText: {
    color: Colors.tertiary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  metaText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.md,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.secondaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.onSecondaryContainer,
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.06)',
    marginBottom: Spacing.lg,
  },
  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
  },
  sellerDetails: {
    flex: 1,
  },
  sellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  sellerName: {
    ...Typography.labelLg,
    color: Colors.onSurface,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(45, 90, 39, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  sellerMeta: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  sectionBlock: {
    marginBottom: Spacing.lg,
  },
  sectionHeading: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    marginBottom: 6,
  },
  descriptionText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    lineHeight: 22,
  },
  ecoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(45, 90, 39, 0.08)',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(45, 90, 39, 0.15)',
    marginBottom: Spacing.lg,
  },
  ecoIconBox: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ecoTextBox: {
    flex: 1,
  },
  ecoTitle: {
    ...Typography.labelMd,
    color: Colors.primary,
  },
  ecoDesc: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  ecoHighlight: {
    fontWeight: '700',
    color: Colors.primary,
  },
  prefCard: {
    backgroundColor: 'rgba(217, 230, 218, 0.5)',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(45, 90, 39, 0.12)',
  },
  prefHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  prefTitle: {
    ...Typography.labelMd,
    color: Colors.primary,
  },
  prefText: {
    ...Typography.bodySm,
    color: Colors.onSecondaryContainer,
    lineHeight: 20,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.margin,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(21, 66, 18, 0.08)',
  },
  chatButton: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(21, 66, 18, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proposeTradeButton: {
    flex: 1,
    height: 50,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  proposeTradeText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
  },
});
