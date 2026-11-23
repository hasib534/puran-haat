import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
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

/** Eco-point milestones. Points come from accepted trades (50 pts each). */
const ECO_TIERS = [
  { min: 0, name: 'Seedling', icon: 'eco' },
  { min: 50, name: 'Sapling', icon: 'park' },
  { min: 150, name: 'Tree', icon: 'forest' },
  { min: 300, name: 'Grove', icon: 'nature' },
  { min: 600, name: 'Forest', icon: 'public' },
] as const;

/** CO₂ offset shown as progress toward this goal, in kg. */
const CO2_GOAL_KG = 50;

type ListingFilter = 'all' | 'trade' | 'free' | 'auction';

const FILTERS: { key: ListingFilter; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'apps' },
  { key: 'trade', label: 'Barter', icon: 'swap-horiz' },
  { key: 'free', label: 'Free', icon: 'volunteer-activism' },
  { key: 'auction', label: 'Auction', icon: 'gavel' },
];

/** Formats an ISO date as "September 2025"; `null` when unparseable. */
function formatMonth(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString([], { month: 'long', year: 'numeric' });
}

function ecoTierFor(points: number) {
  let index = 0;
  for (let i = 0; i < ECO_TIERS.length; i += 1) {
    if (points >= ECO_TIERS[i].min) index = i;
  }
  return { index, tier: ECO_TIERS[index], next: ECO_TIERS[index + 1] };
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, profile, ecoPoints, tradeCount, toggleFavorite, ensureConversation } = useApp();
  const { user } = useAuth();
  const { guard } = useAuthGuard();

  const isOwnProfile = Boolean(user?.uid && user.uid === id);

  const [remoteProfile, setRemoteProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(
    () => Boolean(id) && isFirebaseConfigured && !isOwnProfile,
  );
  const [filter, setFilter] = useState<ListingFilter>('all');

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

  // Always carry the route id so actions can address the trader unambiguously.
  const traderProfile: Profile | undefined = displayedProfile
    ? { ...displayedProfile, id: id || displayedProfile.id }
    : undefined;

  const sortedByDate = useMemo(
    () => [...listings].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')),
    [listings],
  );

  const co2Saved = useMemo(
    () => listings.reduce((total, item) => total + (Number(item.co2_saved_kg) || 0), 0),
    [listings],
  );

  const swaps = isOwnProfile ? tradeCount : displayedProfile?.trade_count ?? 0;
  const points = isOwnProfile ? ecoPoints : displayedProfile?.eco_points ?? 0;

  const { tier, next } = ecoTierFor(points);
  const tierProgress = next
    ? Math.min(1, (points - tier.min) / (next.min - tier.min))
    : 1;
  const tierProgressWidth: `${number}%` = `${Math.round(tierProgress * 100)}%`;

  const co2ProgressWidth: `${number}%` = `${Math.min(100, Math.round((co2Saved / CO2_GOAL_KG) * 100))}%`;

  const tradingSince = formatMonth(sortedByDate[0]?.created_at);

  const counts = useMemo(
    () => ({
      all: listings.length,
      trade: listings.filter((item) => item.trade_mode === 'trade').length,
      free: listings.filter((item) => item.trade_mode === 'free').length,
      auction: listings.filter((item) => item.trade_mode === 'auction').length,
    }),
    [listings],
  );

  const visibleListings = useMemo(
    () => (filter === 'all' ? listings : listings.filter((item) => item.trade_mode === filter)),
    [listings, filter],
  );

  const achievements = useMemo(
    () => [
      { key: 'first', label: 'First Swap', icon: 'swap-horiz', unlocked: swaps >= 1, hint: 'Complete a swap' },
      { key: 'five', label: '5 Swaps', icon: 'repeat', unlocked: swaps >= 5, hint: 'Complete 5 swaps' },
      { key: 'ten', label: '10 Swaps', icon: 'military-tech', unlocked: swaps >= 10, hint: 'Complete 10 swaps' },
      { key: 'carbon', label: 'Carbon Saver', icon: 'cloud-done', unlocked: co2Saved >= 25, hint: 'Save 25 kg CO₂' },
      { key: 'curator', label: 'Curator', icon: 'inventory-2', unlocked: listings.length >= 5, hint: 'Keep 5+ listings' },
      {
        key: 'verified',
        label: 'Verified',
        icon: 'verified',
        unlocked: Boolean(displayedProfile?.is_verified),
        hint: 'Verify your identity',
      },
    ],
    [co2Saved, listings.length, swaps, displayedProfile?.is_verified],
  );

  const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;

  // Recognition banner mirrors the design's "Top Contributor" card, but is
  // earned from real activity instead of being hard-coded.
  const recognition = useMemo(() => {
    if (points >= 300 || swaps >= 10) {
      return { title: 'Top Contributor', body: 'Top trader in your neighborhood', icon: 'workspace-premium' };
    }
    if (swaps >= 5) {
      return { title: 'Trusted Trader', body: 'A solid trade history on the Haat', icon: 'handshake' };
    }
    if (displayedProfile?.is_verified) {
      return { title: 'Verified Trader', body: 'Identity confirmed by Puran Haat', icon: 'verified-user' };
    }
    if (swaps >= 1) {
      return { title: 'Rising Trader', body: 'First swaps completed — keep it going', icon: 'trending-up' };
    }
    return null;
  }, [displayedProfile?.is_verified, points, swaps]);

  const handleToggleFavorite = (itemId: string) => {
    if (!guard('save favorites')) return;
    toggleFavorite(itemId).catch((error: Error) =>
      showAlert('Could not update favorite', error.message),
    );
  };

  const displayName = displayedProfile?.full_name || 'Puran Haat trader';
  const newestListing = listings[0];

  const handleMessage = () => {
    if (!traderProfile || !newestListing) return;
    if (!guard('message this trader')) return;
    const conversationId = ensureConversation(newestListing.id, traderProfile);
    router.push({ pathname: '/chat/[id]', params: { id: conversationId } } as never);
  };

  const handlePropose = () => {
    if (!newestListing) return;
    if (!guard('send a barter proposal', { requireVerified: true })) return;
    router.push({ pathname: '/proposal/[id]', params: { id: newestListing.id } } as never);
  };

  const handleShare = () => {
    const handle = displayedProfile?.username ? `@${displayedProfile.username}` : displayName;
    Share.share({
      message: `Check out ${handle} on Puran Haat — swap, donate and trade pre-loved goods across Bangladesh.`,
    }).catch(() => {
      /* Sharing was dismissed or unsupported; nothing to recover. */
    });
  };

  const handleReport = () => {
    showAlert(
      'Report this trader?',
      'Our trust & safety team reviews every report. You can also report a specific message from inside a chat.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () =>
            showAlert(
              'Report received',
              'Thanks — we will review this profile within 24 hours. You can read more safety guidance in Trust & Safety.',
              [
                { text: 'Close', style: 'cancel' },
                {
                  text: 'Trust & Safety',
                  onPress: () => router.push('/trust-safety' as never),
                },
              ],
            ),
        },
      ],
    );
  };

  const header = (
    <View>
      <View style={[styles.profileCard, Shadows.card]}>
        <View style={styles.avatarRing}>
          {displayedProfile?.avatar_url ? (
            <Image
              source={{ uri: displayedProfile.avatar_url }}
              style={styles.avatar}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <MaterialIcons name="person" size={42} color={Colors.primary} />
            </View>
          )}
        </View>

        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          {displayedProfile?.is_verified && (
            <View style={styles.verifiedPill}>
              <MaterialIcons name="verified" size={13} color={Colors.primary} />
              <Text style={styles.verifiedPillText}>VERIFIED</Text>
            </View>
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
          <Text style={styles.metaDivider}>·</Text>
          <MaterialIcons name="swap-horiz" size={15} color={Colors.onSurfaceVariant} />
          <Text style={styles.metaText}>
            {swaps} {swaps === 1 ? 'swap' : 'swaps'}
          </Text>
        </View>

        {tradingSince ? (
          <View style={styles.metaRow}>
            <MaterialIcons name="event-available" size={14} color={Colors.outline} />
            <Text style={styles.metaSubtle}>Trading since {tradingSince}</Text>
          </View>
        ) : null}

        {displayedProfile?.bio ? (
          <Text style={styles.bio}>{displayedProfile.bio}</Text>
        ) : null}

        {isOwnProfile ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.85}
              onPress={() => router.push('/edit-profile' as never)}
              accessibilityLabel="Edit profile"
            >
              <MaterialIcons name="edit" size={16} color={Colors.onPrimary} />
              <Text style={styles.primaryButtonText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.outlineButton}
              activeOpacity={0.85}
              onPress={() => router.push('/my-listings' as never)}
              accessibilityLabel="Manage listings"
            >
              <MaterialIcons name="inventory-2" size={16} color={Colors.primary} />
              <Text style={styles.outlineButtonText}>My Listings</Text>
            </TouchableOpacity>
          </View>
        ) : newestListing ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.85}
              onPress={handleMessage}
              accessibilityLabel={`Message ${displayName}`}
            >
              <MaterialIcons name="chat-bubble-outline" size={16} color={Colors.onPrimary} />
              <Text style={styles.primaryButtonText}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.outlineButton}
              activeOpacity={0.85}
              onPress={handlePropose}
              accessibilityLabel={`Propose a swap with ${displayName}`}
            >
              <MaterialIcons name="swap-horiz" size={17} color={Colors.primary} />
              <Text style={styles.outlineButtonText}>Propose Swap</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.noListingsHint}>
            This trader has no active listings to discuss yet.
          </Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>Sustainability Impact</Text>

      <View style={[styles.impactCard, Shadows.card]}>
        <View style={styles.impactHeader}>
          <MaterialIcons name="recycling" size={18} color={Colors.primary} />
          <Text style={styles.impactLabel}>LANDFILL DIVERTED</Text>
        </View>

        <View style={styles.impactTopRow}>
          <View style={styles.impactValueWrap}>
            <Text style={styles.impactValue}>{listings.length}</Text>
            <Text style={styles.impactUnit}>
              {listings.length === 1 ? 'item reused' : 'items reused'}
            </Text>
          </View>
          <View style={styles.tierBadge}>
            <MaterialIcons name={tier.icon as never} size={26} color={Colors.primary} />
          </View>
        </View>

        <View style={styles.tierHeader}>
          <Text style={styles.tierName}>{tier.name} level</Text>
          <Text style={styles.tierPoints}>{points} eco-points</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: tierProgressWidth }]} />
        </View>
        <Text style={styles.tierHint}>
          {next
            ? `${next.min - points} more to unlock ${next.name}`
            : 'Top level reached — a Haat legend!'}
        </Text>
      </View>

      <View style={styles.miniRow}>
        <View style={[styles.miniCard, Shadows.card]}>
          <View style={styles.miniHeader}>
            <MaterialIcons name="cloud" size={16} color={Colors.primary} />
            <Text style={styles.miniLabel}>CO₂ Offset</Text>
          </View>
          <View style={styles.miniValueRow}>
            <Text style={styles.miniValue}>{co2Saved.toFixed(1)}</Text>
            <Text style={styles.miniUnit}>kg</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: co2ProgressWidth }]} />
          </View>
          <Text style={styles.miniHint}>Goal {CO2_GOAL_KG} kg</Text>
        </View>

        <View style={[styles.miniCard, Shadows.card]}>
          <View style={styles.miniHeader}>
            <MaterialIcons name="handshake" size={16} color={Colors.tertiary} />
            <Text style={styles.miniLabel}>Swaps</Text>
          </View>
          <View style={styles.miniValueRow}>
            <Text style={styles.miniValue}>{swaps}</Text>
          </View>
          <Text style={styles.miniHint}>
            {swaps > 0 ? 'Total completed' : 'No swaps yet'}
          </Text>
        </View>
      </View>

      {recognition ? (
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <MaterialIcons name={recognition.icon as never} size={24} color={Colors.onPrimary} />
          </View>
          <View style={styles.bannerBody}>
            <Text style={styles.bannerTitle}>{recognition.title}</Text>
            <Text style={styles.bannerText}>{recognition.body}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitleInline}>Achievements</Text>
        <Text style={styles.sectionCount}>
          {unlockedCount}/{achievements.length}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.achievementRow}
      >
        {achievements.map((achievement) => (
          <View
            key={achievement.key}
            style={styles.achievement}
            accessibilityLabel={`${achievement.label}: ${
              achievement.unlocked ? 'unlocked' : `locked, ${achievement.hint}`
            }`}
          >
            <View
              style={[
                styles.achievementIcon,
                achievement.unlocked && styles.achievementIconUnlocked,
              ]}
            >
              <MaterialIcons
                name={achievement.icon as never}
                size={24}
                color={achievement.unlocked ? Colors.primary : Colors.outline}
              />
            </View>
            <Text
              style={[
                styles.achievementLabel,
                !achievement.unlocked && styles.achievementLabelLocked,
              ]}
              numberOfLines={1}
            >
              {achievement.label}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitleInline}>Active Listings</Text>
        <Text style={styles.sectionCount}>{listings.length}</Text>
      </View>

      {listings.length > 0 ? (
        <View style={styles.filterRow}>
          {FILTERS.map((option) => {
            const selected = filter === option.key;
            const count = counts[option.key];
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.filterChip, selected && styles.filterChipSelected]}
                activeOpacity={0.85}
                onPress={() => setFilter(option.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Show ${option.label} listings, ${count}`}
              >
                <MaterialIcons
                  name={option.icon as never}
                  size={14}
                  color={selected ? Colors.onPrimary : Colors.onSurfaceVariant}
                />
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                  {option.label} {count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
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

        <TouchableOpacity
          style={styles.navButton}
          onPress={handleShare}
          activeOpacity={0.8}
          accessibilityLabel="Share profile"
        >
          <MaterialIcons name="ios-share" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {!displayedProfile && loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={visibleListings}
          keyExtractor={(item) => item.id}
          numColumns={2}
          ListHeaderComponent={header}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={visibleListings.length > 0 ? styles.columnWrapper : undefined}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="inventory-2" size={44} color={Colors.outline} />
              <Text style={styles.emptyTitle}>
                {listings.length === 0 ? 'No active listings' : 'Nothing here yet'}
              </Text>
              <Text style={styles.emptyDesc}>
                {listings.length === 0
                  ? isOwnProfile
                    ? 'Items you post will show up on your profile.'
                    : `${displayName} has no active listings right now.`
                  : `No ${FILTERS.find((option) => option.key === filter)?.label.toLowerCase()} listings right now.`}
              </Text>
            </View>
          }
          ListFooterComponent={
            isOwnProfile ? (
              <TouchableOpacity
                style={styles.dashedCta}
                activeOpacity={0.85}
                onPress={() => router.push('/(tabs)/post' as never)}
                accessibilityLabel="List a new item"
              >
                <View style={styles.dashedIcon}>
                  <MaterialIcons name="add" size={22} color={Colors.primary} />
                </View>
                <Text style={styles.dashedText}>List New Item</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.reportRow}
                activeOpacity={0.7}
                onPress={handleReport}
                accessibilityLabel={`Report ${displayName}`}
              >
                <MaterialIcons name="flag" size={15} color={Colors.outline} />
                <Text style={styles.reportText}>Report this trader</Text>
              </TouchableOpacity>
            )
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

  // Profile hero -----------------------------------------------------------
  profileCard: {
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginTop: Spacing.xs,
  },
  avatarRing: {
    padding: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: Colors.primaryFixed,
  },
  avatar: {
    width: 88,
    height: 88,
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
    gap: 7,
    marginTop: Spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  name: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
    flexShrink: 1,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryFixed,
  },
  verifiedPillText: {
    ...Typography.labelSm,
    fontSize: 9,
    fontWeight: '700',
    color: Colors.onPrimaryFixed,
    letterSpacing: 0.4,
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
    marginTop: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  metaText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
  },
  metaSubtle: {
    ...Typography.bodySm,
    color: Colors.outline,
    fontSize: 11,
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
    lineHeight: 21,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    width: '100%',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  primaryButtonText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
    fontWeight: '700',
  },
  outlineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  outlineButtonText: {
    ...Typography.labelLg,
    color: Colors.primary,
    fontWeight: '700',
  },
  noListingsHint: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: Spacing.md,
  },

  // Impact -----------------------------------------------------------------
  sectionTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    fontWeight: '700',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  impactCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
  },
  impactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  impactLabel: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  impactTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  impactValueWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  impactValue: {
    ...Typography.displayLg,
    color: Colors.primary,
    fontSize: 38,
    lineHeight: 42,
  },
  impactUnit: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    marginBottom: 6,
  },
  tierBadge: {
    width: 54,
    height: 54,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    marginBottom: 6,
  },
  tierName: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  tierPoints: {
    ...Typography.bodySm,
    color: Colors.primary,
    fontWeight: '700',
  },
  progressTrack: {
    height: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(21, 66, 18, 0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  tierHint: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    marginTop: 6,
    fontSize: 11,
  },

  // Mini stat cards --------------------------------------------------------
  miniRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  miniCard: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
  },
  miniHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  miniLabel: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
    fontWeight: '700',
  },
  miniValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    minHeight: 30,
  },
  miniValue: {
    ...Typography.headlineMd,
    color: Colors.tertiary,
    fontWeight: '700',
  },
  miniUnit: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    marginBottom: 4,
  },
  miniHint: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    marginTop: 6,
    fontSize: 11,
  },

  // Recognition banner -----------------------------------------------------
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
  },
  bannerIcon: {
    width: 46,
    height: 46,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerBody: {
    flex: 1,
  },
  bannerTitle: {
    ...Typography.headlineSm,
    color: Colors.onPrimary,
    fontWeight: '700',
  },
  bannerText: {
    ...Typography.bodySm,
    color: 'rgba(255, 255, 255, 0.82)',
    marginTop: 1,
  },

  // Achievements -----------------------------------------------------------
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionTitleInline: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  sectionCount: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
  },
  achievementRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.md,
  },
  achievement: {
    width: 74,
    alignItems: 'center',
    gap: 6,
  },
  achievementIcon: {
    width: 58,
    height: 58,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  achievementIconUnlocked: {
    backgroundColor: Colors.primaryFixed,
    borderColor: Colors.primaryFixedDim,
  },
  achievementLabel: {
    ...Typography.bodySm,
    color: Colors.onSurface,
    fontWeight: '600',
    fontSize: 11,
    textAlign: 'center',
  },
  achievementLabelLocked: {
    color: Colors.outline,
    fontWeight: '400',
  },

  // Listing filters --------------------------------------------------------
  filterRow: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: Spacing.sm,
  },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  filterChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
    fontWeight: '700',
    fontSize: 11,
  },
  filterTextSelected: {
    color: Colors.onPrimary,
  },

  // Grid -------------------------------------------------------------------
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

  // Footer CTA / report ----------------------------------------------------
  dashedCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.outlineVariant,
  },
  dashedIcon: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedText: {
    ...Typography.labelLg,
    color: Colors.primary,
    fontWeight: '700',
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  reportText: {
    ...Typography.bodySm,
    color: Colors.outline,
  },
});
