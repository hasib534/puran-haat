import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../../constants/theme';
import { MOCK_CATEGORIES } from '../../data/mock-items';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { showAlert } from '../../lib/alert';

const CATEGORY_BY_ID = new Map(MOCK_CATEGORIES.map((category) => [category.id, category]));

const CONDITION_LABELS: Record<string, string> = {
  brand_new: 'Brand new',
  like_new: 'Like new',
  gently_used: 'Gently used',
  fair: 'Fair',
};

function postedLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently posted';
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'Posted today';
  if (days === 1) return 'Posted 1 day ago';
  if (days < 7) return `Posted ${days} days ago`;
  return `Posted ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, itemsLoading, toggleFavorite, ensureConversation, deleteItem } = useApp();
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
  const category = CATEGORY_BY_ID.get(item.category_id);
  const images = item.images.filter(Boolean);
  const heroImage = images[selectedImageIndex] || images[0];

  const handleFavorite = () => {
    if (!guard('save favorites')) return;
    toggleFavorite(item.id).catch((error: Error) =>
      showAlert('Could not update favorite', error.message),
    );
  };

  const handleChat = () => {
    if (isOwnListing) {
      showAlert('Your listing', 'This is your own item. You can manage it from your profile.');
      return;
    }
    if (!guard('message this trader', { requireVerified: true })) return;
    if (!item.user) {
      showAlert('Unavailable', 'This trader has no profile yet.');
      return;
    }
    const conversationId = ensureConversation(item.id, item.user);
    router.push({ pathname: '/chat/[id]', params: { id: conversationId } } as never);
  };

  const handlePropose = () => {
    if (isOwnListing) {
      showAlert('Your listing', 'You cannot propose a trade on your own item.');
      return;
    }
    if (!guard('send a barter proposal', { requireVerified: true })) return;
    router.push({ pathname: '/proposal/[id]', params: { id: item.id } } as never);
  };

  const handleEditListing = () => {
    router.push({ pathname: '/edit-item/[id]', params: { id: item.id } } as never);
  };

  const handleDeleteListing = () => {
    if (!guard('delete this listing', { requireVerified: true })) return;
    showAlert(
      'Delete listing?',
      `"${item.title}" will be removed from the Haat. Existing chats keep their history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteItem(item.id)
              .then(() => {
                showAlert('Listing deleted', 'This item is no longer on the Haat.', [
                  { text: 'OK', onPress: () => router.back() },
                ]);
              })
              .catch((error: Error) =>
                showAlert('Could not delete listing', error.message),
              );
          },
        },
      ],
    );
  };

  const handleMore = () => {
    const buttons = isOwnListing
      ? [
          { text: 'Edit listing', onPress: handleEditListing },
          { text: 'Delete listing', style: 'destructive' as const, onPress: handleDeleteListing },
          { text: 'Cancel', style: 'cancel' as const },
        ]
      : [
          {
            text: isFavorite ? 'Remove from saved' : 'Save item',
            onPress: handleFavorite,
          },
          { text: 'Message trader', onPress: handleChat },
          { text: 'Cancel', style: 'cancel' as const },
        ];
    showAlert('Listing options', item.title, buttons);
  };

  const handleViewProfile = () => {
    const seller = item.user;
    if (!seller) return;
    showAlert(
      seller.full_name,
      [
        seller.district ? `Based in ${seller.district}` : 'Puran Haat community member',
        seller.is_verified ? 'Verified trader' : 'Member',
        seller.rating ? `Rating ${seller.rating.toFixed(1)} from ${seller.trade_count} trades` : 'No ratings yet',
      ].join('\n'),
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>

        <Text style={styles.navTitle}>Puran Haat</Text>

        <TouchableOpacity
          style={styles.navButton}
          onPress={handleMore}
          activeOpacity={0.8}
          accessibilityLabel="Listing options"
        >
          <MaterialIcons name="more-vert" size={23} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Gallery */}
        <View style={styles.gallerySection}>
          <View style={styles.galleryContainer}>
            {heroImage ? (
              <Image
                source={{ uri: heroImage }}
                style={styles.heroImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={styles.heroPlaceholder}>
                <MaterialIcons name="image-not-supported" size={48} color={Colors.outline} />
              </View>
            )}

            <View style={styles.photoCounter}>
              <MaterialIcons name="photo-library" size={14} color={Colors.onSurface} />
              <Text style={styles.photoCounterText}>
                {Math.min(selectedImageIndex + 1, images.length || 1)}/{images.length || 1}
              </Text>
            </View>

            <View style={styles.ecoBadge}>
              <MaterialIcons name="eco" size={14} color={Colors.primary} />
              <Text style={styles.ecoBadgeText}>{item.eco_impact_rating} Eco-Score</Text>
            </View>
          </View>

          {images.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailRow}
            >
              {images.map((img, idx) => (
                <TouchableOpacity
                  key={`${img}-${idx}`}
                  onPress={() => setSelectedImageIndex(idx)}
                  style={[
                    styles.thumbnailWrap,
                    selectedImageIndex === idx && styles.thumbnailActive,
                  ]}
                  accessibilityLabel={`Show photo ${idx + 1}`}
                >
                  <Image source={{ uri: img }} style={styles.thumbnailImg} contentFit="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{item.title}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MaterialIcons name="location-on" size={15} color={Colors.primary} />
              <Text style={styles.metaText}>
                {item.distance_km != null ? `${item.distance_km} km away` : item.location_name}
              </Text>
            </View>
            <Text style={styles.metaDot}>•</Text>
            <View style={styles.metaItem}>
              <MaterialIcons name="schedule" size={14} color={Colors.onSurfaceVariant} />
              <Text style={styles.metaText}>{postedLabel(item.created_at)}</Text>
            </View>
          </View>

          <View style={styles.tagRow}>
            {category && (
              <View style={styles.tagChip}>
                <MaterialIcons name={category.icon as never} size={14} color={Colors.primary} />
                <Text style={styles.tagText}>{category.name}</Text>
              </View>
            )}
            <View style={styles.tagChip}>
              <MaterialIcons name="check-circle" size={14} color={Colors.primary} />
              <Text style={styles.tagText}>
                Condition: {CONDITION_LABELS[item.condition] || item.condition}
              </Text>
            </View>
            {item.user?.is_verified && (
              <View style={styles.tagChip}>
                <MaterialIcons name="verified" size={14} color={Colors.primary} />
                <Text style={styles.tagText}>Verified Trader</Text>
              </View>
            )}
          </View>

          <View style={[styles.descriptionCard, Shadows.card]}>
            <Text style={styles.sectionHeading}>Description</Text>
            <Text style={styles.descriptionText}>
              {item.description || 'No detailed description provided by the trader.'}
            </Text>
          </View>

          {isTrade && (
            <View style={styles.exchangeIntentRow}>
              <View style={[styles.intentCard, Shadows.card]}>
                <View style={styles.intentHeader}>
                  <MaterialIcons name="swap-horiz" size={20} color={Colors.primary} />
                  <Text style={styles.intentTitle}>Looking For</Text>
                </View>
                <Text style={styles.intentText}>
                  This trader is open to barter offers. Propose an item from your inventory that
                  feels like a fair swap.
                </Text>
              </View>

              <View style={[styles.offerCard, Shadows.card]}>
                <View style={styles.offerIcon}>
                  <MaterialIcons name="handshake" size={22} color={Colors.tertiary} />
                </View>
                <Text style={styles.offerTitle}>Open to Offers</Text>
                <Text style={styles.offerText}>
                  Don&apos;t have the exact item? Propose something else — interesting trades are
                  welcome.
                </Text>
              </View>
            </View>
          )}

          <View style={styles.ecoCard}>
            <View style={styles.ecoIconBox}>
              <MaterialIcons name="compost" size={26} color={Colors.primary} />
            </View>
            <View style={styles.ecoTextBox}>
              <Text style={styles.ecoTitle}>Circular Haat Impact</Text>
              <Text style={styles.ecoDesc}>
                Swapping this item prevents{' '}
                <Text style={styles.ecoHighlight}>{item.co2_saved_kg} kg of CO₂</Text> from
                manufacturing a replacement.
              </Text>
            </View>
          </View>

          {item.user && (
            <View style={[styles.sellerCard, Shadows.card]}>
              {item.user.avatar_url ? (
                <Image
                  source={{ uri: item.user.avatar_url }}
                  style={styles.sellerAvatar}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.sellerAvatar, styles.sellerAvatarFallback]}>
                  <MaterialIcons name="person" size={24} color={Colors.primary} />
                </View>
              )}
              <View style={styles.sellerDetails}>
                <View style={styles.sellerNameRow}>
                  <Text style={styles.sellerName}>{item.user.full_name}</Text>
                  {item.user.is_verified && (
                    <MaterialIcons name="verified" size={14} color={Colors.primary} />
                  )}
                </View>
                <View style={styles.sellerRatingRow}>
                  <MaterialIcons name="star" size={14} color={Colors.star} />
                  <Text style={styles.sellerRating}>
                    {item.user.rating ? item.user.rating.toFixed(1) : 'New'} (
                    {item.user.trade_count} trades)
                  </Text>
                </View>
                <Text style={styles.sellerMeta} numberOfLines={1}>
                  {item.user.district
                    ? `Based in ${item.user.district}`
                    : 'Puran Haat community member'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.viewProfileButton}
                onPress={handleViewProfile}
                accessibilityRole="button"
              >
                <Text style={styles.viewProfileText}>View Profile</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, Shadows.tabBar]}>
        {isOwnListing ? (
          <>
            <TouchableOpacity
              style={[styles.chatButton, styles.deleteListingButton]}
              onPress={handleDeleteListing}
              activeOpacity={0.8}
              accessibilityLabel="Delete listing"
            >
              <MaterialIcons name="delete-outline" size={22} color={Colors.error} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.proposeTradeButton}
              onPress={handleEditListing}
              activeOpacity={0.88}
              accessibilityLabel="Edit listing"
            >
              <MaterialIcons name="edit" size={22} color={Colors.onPrimary} />
              <Text style={styles.proposeTradeText}>Edit Listing</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.chatButton}
              onPress={handleChat}
              activeOpacity={0.8}
              accessibilityLabel="Message the trader"
            >
              <MaterialIcons name="forum" size={22} color={Colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.proposeTradeButton}
              onPress={handlePropose}
              activeOpacity={0.88}
            >
              <MaterialIcons name="swap-calls" size={22} color={Colors.onPrimary} />
              <Text style={styles.proposeTradeText}>
                {isFree ? 'Claim Free Gift' : 'Propose Exchange'}
              </Text>
            </TouchableOpacity>
          </>
        )}
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
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    ...Typography.headlineSm,
    color: Colors.primary,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  gallerySection: {
    paddingHorizontal: Spacing.margin,
    paddingTop: Spacing.xs,
  },
  galleryContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceContainer,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCounter: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(253, 250, 231, 0.94)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  photoCounterText: {
    ...Typography.labelSm,
    color: Colors.onSurface,
  },
  ecoBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(253, 250, 231, 0.94)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  ecoBadgeText: {
    ...Typography.labelSm,
    color: Colors.primary,
  },
  thumbnailRow: {
    gap: 8,
    paddingTop: Spacing.xs,
  },
  thumbnailWrap: {
    width: 64,
    height: 52,
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
    paddingHorizontal: Spacing.margin,
    paddingTop: Spacing.md,
  },
  title: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 5,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { ...Typography.bodySm, color: Colors.onSurfaceVariant },
  metaDot: { color: Colors.outline },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: Spacing.sm,
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
    fontWeight: '600',
    color: Colors.onSecondaryContainer,
  },
  descriptionCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionHeading: {
    ...Typography.labelLg,
    color: Colors.primary,
    fontWeight: '700',
    marginBottom: 6,
  },
  descriptionText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    lineHeight: 22,
  },
  exchangeIntentRow: {
    gap: 10,
    marginBottom: Spacing.md,
  },
  intentCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  intentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 5,
  },
  intentTitle: {
    ...Typography.labelLg,
    color: Colors.primary,
    fontWeight: '700',
  },
  intentText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    lineHeight: 19,
  },
  offerCard: {
    backgroundColor: 'rgba(255, 219, 210, 0.45)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  offerIcon: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(106, 33, 13, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  offerTitle: {
    ...Typography.labelLg,
    color: Colors.tertiary,
    fontWeight: '700',
  },
  offerText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    lineHeight: 19,
    marginTop: 3,
  },
  ecoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(45, 90, 39, 0.07)',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
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
    fontWeight: '700',
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
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
  },
  sellerAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(21, 66, 18, 0.08)',
  },
  sellerDetails: {
    flex: 1,
  },
  sellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sellerName: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  sellerRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  sellerRating: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    fontSize: 11,
  },
  sellerMeta: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    marginTop: 1,
  },
  viewProfileButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  viewProfileText: {
    ...Typography.labelSm,
    color: Colors.primary,
    fontWeight: '700',
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
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(21, 66, 18, 0.07)',
  },
  chatButton: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(21, 66, 18, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteListingButton: {
    backgroundColor: Colors.errorContainer,
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
    fontWeight: '700',
  },
});
