import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { router } from 'expo-router';

import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../../constants/theme';
import { formatDistanceKm, RADIUS_OPTIONS } from '../../lib/geo';
import { MOCK_CATEGORIES } from '../../data/mock-items';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../context/LocationContext';
import { showAlert } from '../../lib/alert';
import { TopHeader } from '../../components/layout/TopHeader';
import { ItemCard } from '../../components/ui/ItemCard';
import {
  loadRecentSearches,
  mergeRecentSearch,
  saveRecentSearches,
} from '../../lib/recent-searches';

const CATEGORY_NAME_BY_ID = new Map(
  MOCK_CATEGORIES.map((category) => [category.id, category.name]),
);

export default function SearchTab() {
  const { items } = useApp();
  const { user } = useAuth();
  const { radiusKm, setRadiusKm, sortByDistance, location, distanceTo } = useLocation();
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showAllTrending, setShowAllTrending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadRecentSearches(user?.uid).then((terms) => {
      if (!cancelled) setRecentSearches(terms);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const persistRecentSearches = useCallback(
    (next: string[]) => {
      setRecentSearches(next);
      void saveRecentSearches(user?.uid, next);
    },
    [user?.uid],
  );

  const rememberSearch = useCallback(
    (term: string) => {
      const next = mergeRecentSearch(recentSearches, term);
      if (next === recentSearches) return;
      persistRecentSearches(next);
    },
    [persistRecentSearches, recentSearches],
  );

  const query = searchText.trim().toLowerCase();
  const isFiltering = query.length > 0 || selectedCategory !== 'all';

  const filteredResults = useMemo(() => {
    if (!isFiltering) return [];
    const matched = items.filter((item) => {
      if (selectedCategory !== 'all' && item.category_id !== selectedCategory) return false;
      if (radiusKm != null && location) {
        // Only a known area can honestly decide "within X km"; without one we
        // show everything rather than silently hiding the whole catalogue.
        const km = distanceTo(item);
        if (km == null || km > radiusKm) return false;
      }
      if (!query) return true;
      return (
        item.title.toLowerCase().includes(query) ||
        Boolean(item.description?.toLowerCase().includes(query)) ||
        item.location_name.toLowerCase().includes(query)
      );
    });
    return sortByDistance(matched);
  }, [distanceTo, isFiltering, items, location, query, radiusKm, selectedCategory, sortByDistance]);

  const trendingItems = useMemo(
    () =>
      [...items]
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
        .slice(0, 4),
    [items],
  );

  const allTrendingItems = useMemo(
    () =>
      [...items].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
    [items],
  );

  const clearFilters = () => {
    setSearchText('');
    setSelectedCategory('all');
  };

  const openItem = (itemId: string) => {
    if (query) rememberSearch(searchText);
    router.push({ pathname: '/item/[id]', params: { id: itemId } } as never);
  };

  const handleMicPress = () => {
    showAlert('Voice search', 'Voice search is not available yet. Type a keyword to search.');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <TopHeader
        showNotifications
        onPressNotifications={() => router.push('/notifications' as never)}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.headerTitle}>Discover</Text>

        <View style={styles.searchBarWrapper}>
          <MaterialIcons name="search" size={22} color={Colors.outline} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items to exchange..."
            placeholderTextColor="rgba(66, 73, 62, 0.6)"
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={() => rememberSearch(searchText)}
            returnKeyType="search"
            accessibilityLabel="Search listings"
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchText('')}
              accessibilityLabel="Clear search text"
              hitSlop={8}
            >
              <MaterialIcons name="cancel" size={18} color={Colors.outline} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.searchAction}
            onPress={handleMicPress}
            accessibilityLabel="Search by voice"
          >
            <MaterialIcons name="mic-none" size={21} color={Colors.primary} />
          </TouchableOpacity>
          <View style={styles.searchDivider} />
          <TouchableOpacity
            style={styles.searchAction}
            onPress={() => setShowFilters((value) => !value)}
            accessibilityLabel="Toggle distance filters"
            accessibilityState={{ expanded: showFilters }}
          >
            <MaterialIcons
              name="tune"
              size={20}
              color={showFilters ? Colors.tertiary : Colors.primary}
            />
          </TouchableOpacity>
        </View>

        {showFilters ? (
          <View style={styles.radiusBlock}>
            <View style={styles.radiusRow}>
              <Text style={styles.radiusLabel}>Within</Text>
              {RADIUS_OPTIONS.map((option) => {
                const active = radiusKm === option.value;
                return (
                  <TouchableOpacity
                    key={option.label}
                    style={[styles.radiusPill, active && styles.radiusPillActive]}
                    onPress={() => setRadiusKm(option.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={
                      option.value == null
                        ? 'Any distance'
                        : `Within ${option.value} kilometres`
                    }
                  >
                    <Text style={[styles.radiusText, active && styles.radiusTextActive]}>
                      {option.value == null ? 'Any' : `< ${option.label}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={styles.radiusAreaLink}
              onPress={() => router.push('/location' as never)}
              accessibilityRole="button"
              accessibilityLabel="Change the area distances are measured from"
            >
              <MaterialIcons name="location-on" size={13} color={Colors.primary} />
              <Text style={styles.radiusAreaText} numberOfLines={1}>
                {location ? `Measuring from ${location.label}` : 'Set an area to filter by distance'}
              </Text>
              <MaterialIcons name="chevron-right" size={15} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        ) : null}

        {isFiltering && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Results ({filteredResults.length})</Text>
              <TouchableOpacity onPress={clearFilters} accessibilityRole="button">
                <Text style={styles.clearAllText}>CLEAR FILTERS</Text>
              </TouchableOpacity>
            </View>

            {selectedCategory !== 'all' && (
              <View style={styles.activeFilterRow}>
                <View style={styles.activeFilterChip}>
                  <MaterialIcons name="filter-list" size={14} color={Colors.primary} />
                  <Text style={styles.activeFilterText}>
                    {CATEGORY_NAME_BY_ID.get(selectedCategory) || selectedCategory}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setSelectedCategory('all')}
                    accessibilityLabel="Clear category filter"
                    hitSlop={8}
                  >
                    <MaterialIcons name="close" size={14} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {filteredResults.length === 0 ? (
              <Text style={styles.emptyText}>
                No items match these filters. Try a wider distance or another category.
              </Text>
            ) : (
              filteredResults.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.resultRow, Shadows.card]}
                  onPress={() => openItem(item.id)}
                  accessibilityLabel={`Open ${item.title}`}
                >
                  <Image
                    source={{ uri: item.images[0] }}
                    style={styles.resultThumb}
                    contentFit="cover"
                  />
                  <View style={styles.resultBody}>
                    <Text style={styles.resultTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.resultMeta}>
                      {item.location_name}
                      {formatDistanceKm(item.distance_km)
                        ? ` • ${formatDistanceKm(item.distance_km)}`
                        : ''}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {recentSearches.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent Searches</Text>
              <TouchableOpacity
                onPress={() => persistRecentSearches([])}
                accessibilityRole="button"
              >
                <Text style={styles.clearAllText}>CLEAR ALL</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.recentTagsWrapper}>
              {recentSearches.map((term) => (
                <View key={term} style={styles.recentTag}>
                  <TouchableOpacity
                    style={styles.recentTagMain}
                    onPress={() => {
                      setSearchText(term);
                      rememberSearch(term);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Search for ${term}`}
                  >
                    <MaterialIcons name="history" size={16} color={Colors.outline} />
                    <Text style={styles.recentTagText}>{term}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      persistRecentSearches(recentSearches.filter((entry) => entry !== term))
                    }
                    accessibilityLabel={`Remove ${term} from recent searches`}
                    hitSlop={8}
                  >
                    <MaterialIcons name="close" size={14} color={Colors.outline} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Browse Categories</Text>
          <View style={styles.catGrid}>
            {MOCK_CATEGORIES.filter((category) => category.id !== 'all').map((category) => {
              const active = selectedCategory === category.id;
              return (
                <TouchableOpacity
                  key={category.id}
                  style={styles.catCard}
                  onPress={() => setSelectedCategory(active ? 'all' : category.id)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <View style={[styles.catIconCircle, active && styles.catIconCircleActive]}>
                    <MaterialIcons
                      name={category.icon as never}
                      size={26}
                      color={active ? Colors.onPrimary : Colors.primary}
                    />
                  </View>
                  <Text style={styles.catName} numberOfLines={1}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Trending Near You</Text>
            <TouchableOpacity
              onPress={() => setShowAllTrending((value) => !value)}
              accessibilityRole="button"
            >
              <Text style={styles.clearAllText}>
                {showAllTrending ? 'SHOW LESS' : 'SEE ALL'}
              </Text>
            </TouchableOpacity>
          </View>

          {showAllTrending ? (
            <View style={styles.trendingGrid}>
              {allTrendingItems.map((item) => (
                <View key={item.id} style={styles.trendingGridCard}>
                  <ItemCard item={item} onPress={() => openItem(item.id)} />
                </View>
              ))}
            </View>
          ) : (
            <FlatList
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              data={trendingItems}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.trendingList}
              renderItem={({ item }) => (
                <View style={styles.trendingCardWrap}>
                  <ItemCard item={item} onPress={() => openItem(item.id)} />
                </View>
              )}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerTitle: {
    ...Typography.displayLg,
    color: Colors.primary,
    paddingHorizontal: Spacing.margin,
    marginTop: Spacing.xs,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.full,
    paddingLeft: Spacing.md,
    paddingRight: 6,
    paddingVertical: 6,
    marginHorizontal: Spacing.margin,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.08)',
    ...Shadows.card,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMd,
    color: Colors.onSurface,
    paddingVertical: 6,
    padding: 0,
  },
  searchAction: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(21, 66, 18, 0.12)',
    marginHorizontal: 2,
  },
  radiusBlock: {
    marginTop: Spacing.sm,
  },
  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: Spacing.margin,
  },
  radiusAreaLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginHorizontal: Spacing.margin,
    marginTop: 8,
  },
  radiusAreaText: {
    ...Typography.bodySm,
    color: Colors.primary,
    flexShrink: 1,
  },
  radiusLabel: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
  },
  radiusPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.secondaryContainer,
  },
  radiusPillActive: {
    backgroundColor: Colors.primary,
  },
  radiusText: {
    ...Typography.labelSm,
    color: Colors.onSecondaryContainer,
  },
  radiusTextActive: {
    color: Colors.onPrimary,
  },
  section: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.margin,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  clearAllText: {
    ...Typography.labelSm,
    color: Colors.primary,
    fontWeight: '700',
  },
  activeFilterRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.secondaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  activeFilterText: {
    ...Typography.labelSm,
    color: Colors.primary,
  },
  recentTagsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceContainer,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
  },
  recentTagMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentTagText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  catCard: {
    width: '33.333%',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  catIconCircle: {
    width: 58,
    height: 58,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(45, 90, 39, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  catIconCircleActive: {
    backgroundColor: Colors.primary,
  },
  catName: {
    ...Typography.labelMd,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  trendingList: {
    gap: 12,
    paddingVertical: 4,
  },
  trendingCardWrap: {
    width: 202,
  },
  trendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.gutter,
  },
  trendingGridCard: {
    width: '47.7%',
  },
  emptyText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    marginTop: 4,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginBottom: 8,
  },
  resultThumb: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceContainer,
  },
  resultBody: { flex: 1 },
  resultTitle: { ...Typography.labelLg, color: Colors.onSurface },
  resultMeta: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 2 },
});
