import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing } from '../../constants/theme';
import { TopHeader } from '../../components/layout/TopHeader';
import { SearchBar } from '../../components/ui/SearchBar';
import { CategoryChip } from '../../components/ui/CategoryChip';
import { ItemCard } from '../../components/ui/ItemCard';
import { MOCK_CATEGORIES } from '../../data/mock-items';
import { useApp } from '../../context/AppContext';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { VerificationBanner } from '../../components/auth/VerificationBanner';

export default function HomeFeedTab() {
  const { items, toggleFavorite } = useApp();
  const { guard } = useAuthGuard();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [modeFilter, setModeFilter] = useState<'all' | 'trade' | 'free'>('all');

  const communityCo2 = useMemo(
    () => items.reduce((total, item) => total + (Number(item.co2_saved_kg) || 0), 0),
    [items],
  );

  // Filter items based on category, search text, and trade mode
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCategory === 'verified' && !item.user?.is_verified) return false;
      if (selectedCategory !== 'all' && selectedCategory !== 'verified' && item.category_id !== selectedCategory) return false;
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
      Alert.alert('Could not update favorite', error.message),
    );
  };

  const renderHeader = () => (
    <View style={styles.listHeaderContainer}>
      <VerificationBanner />

      {/* Search Input */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search vintage items, books, pots..."
        onPressFilter={() => {
          router.push('/(tabs)/search' as any);
        }}
      />

      {/* Categories Horizontal Carousel */}
      <View style={styles.categoriesSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <Text style={styles.sectionSubtitle}>ক্যাটাগরি</Text>
        </View>
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

      {/* Eco Impact Community Banner */}
      <View style={styles.impactCard}>
        <View style={styles.impactIconBadge}>
          <MaterialIcons name="eco" size={24} color={Colors.primary} />
        </View>
        <View style={styles.impactTextGroup}>
          <Text style={styles.impactTitle}>Community Haat Impact</Text>
          <Text style={styles.impactDesc}>
            🌱 <Text style={styles.impactBold}>{communityCo2.toFixed(1)} kg CO₂</Text> potential savings in current listings
          </Text>
        </View>
      </View>

      {/* Trade Mode Quick Filters (All / Trade / Free) */}
      <View style={styles.filterRow}>
        <View style={styles.filterTabs}>
          {(['all', 'trade', 'free'] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => setModeFilter(mode)}
              style={[
                styles.modeTabButton,
                modeFilter === mode && styles.modeTabButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.modeTabButtonText,
                  modeFilter === mode && styles.modeTabButtonTextActive,
                ]}
              >
                {mode === 'all' ? 'All Haat' : mode === 'trade' ? 'Direct Swap' : 'Free Gift'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.itemCountText}>{filteredItems.length} items</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top App Bar */}
      <TopHeader
        districtName="Dhanmondi, Dhaka"
        unreadNotifications={0}
        onPressLocation={() => {
          Alert.alert('Change Location', 'Current: Dhanmondi, Dhaka.\nProximity radius: 5.0 km');
        }}
        onPressNotifications={() => {
          Alert.alert('Notifications', '1. Tanvir accepted your barter proposal!\n2. 2 new vintage books listed nearby.');
        }}
        onPressProfile={() => {
          router.push('/(tabs)/profile' as any);
        }}
      />

      {/* Main Grid List */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="inventory-2" size={48} color={Colors.outline} />
            <Text style={styles.emptyTitle}>No items found</Text>
            <Text style={styles.emptyDesc}>Try searching for different keywords or clear filters</Text>
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
    paddingBottom: 90, // Leave clearance for bottom tab bar
  },
  listHeaderContainer: {
    marginBottom: Spacing.sm,
  },
  categoriesSection: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: Spacing.margin,
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primaryContainer,
  },
  categoryList: {
    paddingHorizontal: Spacing.margin,
    paddingVertical: 4,
  },
  impactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.secondaryContainer,
    marginHorizontal: Spacing.margin,
    marginVertical: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  impactIconBadge: {
    width: 40,
    height: 40,
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
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.margin,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(85, 97, 88, 0.12)',
    borderRadius: BorderRadius.full,
    padding: 3,
  },
  modeTabButton: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  modeTabButtonActive: {
    backgroundColor: Colors.primary,
  },
  modeTabButtonText: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
  },
  modeTabButtonTextActive: {
    color: Colors.onPrimary,
  },
  itemCountText: {
    ...Typography.labelSm,
    color: Colors.outline,
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
