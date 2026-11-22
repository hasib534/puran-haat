import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { showAlert } from '../../lib/alert';
import { buildNotifications, unreadNotificationCount } from '../../lib/notifications';
import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing } from '../../constants/theme';
import { TopHeader } from '../../components/layout/TopHeader';
import { SearchBar } from '../../components/ui/SearchBar';
import { CategoryChip } from '../../components/ui/CategoryChip';
import { ItemCard } from '../../components/ui/ItemCard';
import { MOCK_CATEGORIES } from '../../data/mock-items';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { VerificationBanner } from '../../components/auth/VerificationBanner';

export default function HomeFeedTab() {
  const { items, toggleFavorite, proposals, conversations, isOffline } = useApp();
  const { user } = useAuth();
  const { guard } = useAuthGuard();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [modeFilter, setModeFilter] = useState<'all' | 'trade' | 'free'>('all');

  const unreadNotifications = useMemo(
    () =>
      unreadNotificationCount(
        buildNotifications({ uid: user?.uid, proposals, conversations }),
      ),
    [conversations, proposals, user?.uid],
  );

  const communityCo2 = useMemo(
    () => items.reduce((total, item) => total + (Number(item.co2_saved_kg) || 0), 0),
    [items],
  );

  // Only blame the connection when an empty feed really is caused by it; an
  // empty result after filtering should still read as a filter problem.
  const offlineAndEmpty = isOffline && items.length === 0;

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCategory === 'verified' && !item.user?.is_verified) return false;
      if (
        selectedCategory !== 'all' &&
        selectedCategory !== 'verified' &&
        item.category_id !== selectedCategory
      ) {
        return false;
      }
      if (modeFilter !== 'all' && item.trade_mode !== modeFilter) return false;
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesDesc = item.description?.toLowerCase().includes(query);
        const matchesLoc = item.location_name.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc && !matchesLoc) return false;
      }
      return true;
    });
  }, [items, selectedCategory, modeFilter, searchQuery]);

  const handleToggleFavorite = (itemId: string) => {
    if (!guard('save favorites')) return;
    toggleFavorite(itemId).catch((error: Error) =>
      showAlert('Could not update favorite', error.message),
    );
  };

  const renderHeader = () => (
    <View style={styles.listHeaderContainer}>
      <VerificationBanner />

      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search items nearby..."
      />

      <View style={styles.categoriesSection}>
        <Text style={styles.sectionTitle}>Categories</Text>
        <FlatList
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          data={MOCK_CATEGORIES}
          keyExtractor={(cat) => cat.id}
          contentContainerStyle={styles.categoryList}
          renderItem={({ item: cat }) => (
            <CategoryChip
              category={cat}
              isSelected={selectedCategory === cat.id}
              onSelect={() => setSelectedCategory(cat.id)}
            />
          )}
        />
      </View>

      <View style={styles.filterRow}>
        <View style={styles.filterTabs}>
          {(['all', 'trade', 'free'] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => setModeFilter(mode)}
              style={[styles.modeTabButton, modeFilter === mode && styles.modeTabButtonActive]}
            >
              <Text
                style={[
                  styles.modeTabButtonText,
                  modeFilter === mode && styles.modeTabButtonTextActive,
                ]}
              >
                {mode === 'all' ? 'All' : mode === 'trade' ? 'Trade' : 'Free'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.itemCountText}>{filteredItems.length} items</Text>
      </View>

      <View style={styles.listingsHeader}>
        <View style={styles.listingsTitleRow}>
          <MaterialIcons name="new-releases" size={18} color={Colors.primary} />
          <Text style={styles.listingsTitle}>New Listings</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/search' as never)}
          accessibilityRole="button"
          accessibilityLabel="See all listings"
        >
          <Text style={styles.seeAllText}>See all</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFooter = () => (
    <View style={styles.impactCard}>
      <View style={styles.impactIconBadge}>
        <MaterialIcons name="eco" size={24} color={Colors.primary} />
      </View>
      <View style={styles.impactTextGroup}>
        <Text style={styles.impactTitle}>Community Haat Impact</Text>
        <Text style={styles.impactDesc}>
          <Text style={styles.impactBold}>{communityCo2.toFixed(1)} kg CO₂</Text> potential
          savings in current listings
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <TopHeader
        districtName="Dhanmondi, Dhaka"
        unreadNotifications={unreadNotifications}
        avatarUrl={user?.photoURL || undefined}
        onPressLocation={() => {
          showAlert('Change Location', 'Current: Dhanmondi, Dhaka.\nProximity radius: 5.0 km');
        }}
        onPressNotifications={() => {
          router.push('/notifications' as never);
        }}
        onPressProfile={() => {
          router.push('/(tabs)/profile' as any);
        }}
      />

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={filteredItems.length > 0 ? renderFooter : null}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons
              name={offlineAndEmpty ? 'cloud-off' : 'inventory-2'}
              size={48}
              color={Colors.outline}
            />
            <Text style={styles.emptyTitle}>
              {offlineAndEmpty ? 'You’re offline' : 'No items found'}
            </Text>
            <Text style={styles.emptyDesc}>
              {offlineAndEmpty
                ? 'Connect to the internet to load the latest listings.'
                : 'Try searching for different keywords or clear filters'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <ItemCard
              item={item}
              onPress={() => {
                router.push({ pathname: '/item/[id]', params: { id: item.id } } as any);
              }}
              onToggleFavorite={() => handleToggleFavorite(item.id)}
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingBottom: 110,
  },
  listHeaderContainer: {
    marginBottom: Spacing.xs,
  },
  categoriesSection: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    paddingHorizontal: Spacing.margin,
    marginBottom: Spacing.xs,
  },
  categoryList: {
    paddingHorizontal: Spacing.margin,
    paddingVertical: 4,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.margin,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: Colors.secondaryContainer,
    borderRadius: BorderRadius.full,
    padding: 3,
  },
  modeTabButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  modeTabButtonActive: {
    backgroundColor: Colors.primary,
  },
  modeTabButtonText: {
    ...Typography.labelSm,
    color: Colors.onSecondaryContainer,
  },
  modeTabButtonTextActive: {
    color: Colors.onPrimary,
  },
  itemCountText: {
    ...Typography.labelSm,
    color: Colors.outline,
  },
  listingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.margin,
    marginBottom: Spacing.sm,
  },
  listingsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listingsTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  seeAllText: {
    ...Typography.labelMd,
    color: Colors.primary,
    fontWeight: '700',
  },
  columnWrapper: {
    paddingHorizontal: Spacing.margin,
    gap: Spacing.gutter,
    marginBottom: Spacing.gutter,
  },
  cardWrapper: {
    flex: 1,
    maxWidth: '50%',
  },
  impactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.secondaryContainer,
    marginHorizontal: Spacing.margin,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  impactIconBadge: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  impactTextGroup: {
    flex: 1,
  },
  impactTitle: {
    ...Typography.labelMd,
    color: Colors.primary,
  },
  impactDesc: {
    ...Typography.bodySm,
    color: Colors.onSecondaryContainer,
    marginTop: 2,
  },
  impactBold: {
    fontWeight: '700',
    color: Colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.margin,
  },
  emptyTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    marginTop: Spacing.sm,
  },
  emptyDesc: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 4,
  },
});
