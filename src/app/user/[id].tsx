import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';

import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { ItemCard } from '../../components/ui/ItemCard';
import { showAlert } from '../../lib/alert';
import { isFirebaseConfigured, subscribeToUserProfile } from '../../lib/firebase';
import type { Profile } from '../../types';

/**
 * Public trader profile, based on the `sustainability_profile` design.
 *
 * Own-profile visits reuse the live context (which already tracks eco points
 * and accepted trades). Other traders are read from their user document, with
 * the seller snapshot embedded in their listings as an instant fallback.
 */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, profile, ecoPoints, tradeCount, toggleFavorite } = useApp();
  const { user } = useAuth();
  const { guard } = useAuthGuard();

  const isOwnProfile = Boolean(user?.uid && user.uid === id);

  const [remoteProfile, setRemoteProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(
    () => Boolean(id) && isFirebaseConfigured && !isOwnProfile,
  );

  useEffect(() => {
    if (!id || isOwnProfile || !isFirebaseConfigured) return;

    const unsubscribe = subscribeToUserProfile(
      id,
      (record) => {
        setRemoteProfile(
          record
            ? {
                id: record.id,
                full_name: String(record.full_name || 'Trader'),
                username: record.username ? String(record.username) : undefined,
                avatar_url: record.avatar_url ? String(record.avatar_url) : undefined,
                district: record.district ? String(record.district) : undefined,
                bio: record.bio ? String(record.bio) : undefined,
                rating: Number(record.rating || 0),
                trade_count: Number(record.trade_count || 0),
                eco_points: Number(record.eco_points || 0),
                is_verified: Boolean(record.is_verified),
              }
            : null,
        );
        setLoading(false);
      },
      () => setLoading(false),
    );

    return unsubscribe;
  }, [id, isOwnProfile]);

  const listings = useMemo(
    () =>
      items
        .filter((item) => item.user_id === id)
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
    [items, id],
  );

  // Fall back to the seller snapshot carried by their listings, then to a stub
  // so a profile with no document and no listings still renders sensibly.
  const displayedProfile: Profile | undefined = isOwnProfile
    ? profile
    : remoteProfile ?? listings.find((item) => item.user)?.user ?? undefined;

  const co2Saved = useMemo(
    () => listings.reduce((total, item) => total + (Number(item.co2_saved_kg) || 0), 0),
    [listings],
  );

  const swaps = isOwnProfile ? tradeCount : displayedProfile?.trade_count ?? 0;
  const points = isOwnProfile ? ecoPoints : displayedProfile?.eco_points ?? 0;

  const handleToggleFavorite = (itemId: string) => {
    if (!guard('save favorites')) return;
    toggleFavorite(itemId).catch((error: Error) =>
      showAlert('Could not update favorite', error.message),
    );
  };

  const displayName = displayedProfile?.full_name || 'Puran Haat trader';

  const header = (
    <View>
      <View style={[styles.profileCard, Shadows.card]}>
        {displayedProfile?.avatar_url ? (
          <Image
            source={{ uri: displayedProfile.avatar_url }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <MaterialIcons name="person" size={40} color={Colors.primary} />
          </View>
        )}

        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          {displayedProfile?.is_verified && (
            <MaterialIcons name="verified" size={18} color={Colors.primary} />
          )}
        </View>

        {displayedProfile?.username ? (
          <Text style={styles.username}>@{displayedProfile.username}</Text>
        ) : null}

        <View style={styles.metaRow}>
          <MaterialIcons name="location-on" size={15} color={Colors.onSurfaceVariant} />
          <Text style={styles.metaText}>
            {displayedProfile?.district || 'Dhaka, Bangladesh'}
          </Text>
          {displayedProfile?.rating ? (
            <>
              <Text style={styles.metaDivider}>·</Text>
              <MaterialIcons name="star" size={15} color={Colors.star} />
              <Text style={styles.metaText}>{displayedProfile.rating.toFixed(1)}</Text>
            </>
          ) : null}
        </View>

        {displayedProfile?.bio ? (
          <Text style={styles.bio}>{displayedProfile.bio}</Text>
        ) : null}

        {isOwnProfile ? (
          <TouchableOpacity
            style={styles.editButton}
            activeOpacity={0.85}
            onPress={() => router.push('/edit-profile' as never)}
          >
            <MaterialIcons name="edit" size={16} color={Colors.primary} />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={[styles.impactCard, Shadows.card]}>
        <View style={styles.impactHeader}>
          <MaterialIcons name="recycling" size={19} color={Colors.primary} />
          <Text style={styles.impactTitle}>Sustainability Impact</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{listings.length}</Text>
            <Text style={styles.statLabel}>Listings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{co2Saved.toFixed(1)}</Text>
            <Text style={styles.statLabel}>kg CO₂ saved</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{swaps}</Text>
            <Text style={styles.statLabel}>Swaps</Text>
          </View>
        </View>

        <View style={styles.pointsPill}>
          <MaterialIcons name="eco" size={15} color={Colors.primary} />
          <Text style={styles.pointsText}>{points} eco-points earned</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Active Listings</Text>
        <Text style={styles.sectionCount}>{listings.length}</Text>
      </View>
    </View>
  );

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

        <Text style={styles.navTitle}>
          {isOwnProfile ? 'Your Profile' : 'Trader Profile'}
        </Text>

        <View style={styles.navButton} />
      </View>

      {!displayedProfile && loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          numColumns={2}
          ListHeaderComponent={header}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={listings.length > 0 ? styles.columnWrapper : undefined}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="inventory-2" size={44} color={Colors.outline} />
              <Text style={styles.emptyTitle}>No active listings</Text>
              <Text style={styles.emptyDesc}>
                {isOwnProfile
                  ? 'Items you post will show up on your profile.'
                  : `${displayName} has no active listings right now.`}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <ItemCard
                item={item}
                onPress={() =>
                  router.push({ pathname: '/item/[id]', params: { id: item.id } } as never)
                }
                onToggleFavorite={() => handleToggleFavorite(item.id)}
              />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  navButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.margin,
    paddingBottom: 110,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginTop: Spacing.xs,
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.secondaryContainer,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: Spacing.sm,
  },
  name: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
    flexShrink: 1,
  },
  username: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.xs,
  },
  metaText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
  },
  metaDivider: {
    ...Typography.bodySm,
    color: Colors.outline,
    marginHorizontal: 2,
  },
  bio: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  editButtonText: {
    ...Typography.labelLg,
    color: Colors.primary,
    fontWeight: '700',
  },
  impactCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  impactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  impactTitle: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...Typography.headlineMd,
    color: Colors.primary,
  },
  statLabel: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 34,
    backgroundColor: Colors.outlineVariant,
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryFixed,
  },
  pointsText: {
    ...Typography.labelMd,
    color: Colors.onPrimaryFixed,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
  },
  sectionCount: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
  },
  columnWrapper: {
    gap: Spacing.gutter,
  },
  cardWrapper: {
    flex: 1,
    marginBottom: Spacing.gutter,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: 6,
  },
  emptyTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
  },
  emptyDesc: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 300,
  },
});