import React, { useState } from 'react';
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
import { MOCK_CATEGORIES } from '../../data/mock-items';
import { useApp } from '../../context/AppContext';
import { ItemCard } from '../../components/ui/ItemCard';

export default function SearchTab() {
  const { items } = useApp();
  const [searchText, setSearchText] = useState('');
  const [selectedRadius, setSelectedRadius] = useState<'1km' | '5km' | '10km' | 'all'>('5km');
  const [recentSearches, setRecentSearches] = useState(['Vintage chair', 'Clay pots', 'Poetry books', 'Desk lamp']);

  const trendingItems = items.slice(0, 4);

  const filteredResults = searchText.trim()
    ? items.filter((it) => {
        const q = searchText.toLowerCase();
        return it.title.toLowerCase().includes(q) || it.description?.toLowerCase().includes(q) || it.location_name.toLowerCase().includes(q);
      })
    : [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover Haat</Text>
        <Text style={styles.headerSubtitle}>খুঁজুন ও অদলবদল করুন</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Search Bar Input */}
        <View style={styles.searchBarWrapper}>
          <MaterialIcons name="search" size={22} color={Colors.outline} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items to exchange..."
            placeholderTextColor="rgba(66, 73, 62, 0.6)"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <MaterialIcons name="cancel" size={18} color={Colors.outline} />
            </TouchableOpacity>
          )}
        </View>

        {/* Distance Radius Filter Pills */}
        <View style={styles.radiusRow}>
          <Text style={styles.radiusLabel}>Distance:</Text>
          {(['1km', '5km', '10km', 'all'] as const).map((rad) => (
            <TouchableOpacity
              key={rad}
              style={[
                styles.radiusPill,
                selectedRadius === rad && styles.radiusPillActive,
              ]}
              onPress={() => setSelectedRadius(rad)}
            >
              <Text
                style={[
                  styles.radiusText,
                  selectedRadius === rad && styles.radiusTextActive,
                ]}
              >
                {rad === 'all' ? 'All Dhaka' : `< ${rad}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search Results */}
        {searchText.trim().length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Results ({filteredResults.length})</Text>
            {filteredResults.length === 0 ? (
              <Text style={styles.emptyText}>No items match your search.</Text>
            ) : (
              filteredResults.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.resultRow, Shadows.card]}
                  onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } } as any)}
                >
                  <Image source={{ uri: item.images[0] }} style={styles.resultThumb} contentFit="cover" />
                  <View style={styles.resultBody}>
                    <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.resultMeta}>{item.location_name} • {item.distance_km} km</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent Searches</Text>
              <TouchableOpacity onPress={() => setRecentSearches([])}>
                <Text style={styles.clearAllText}>CLEAR ALL</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.recentTagsWrapper}>
              {recentSearches.map((term, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.recentTag}
                  onPress={() => setSearchText(term)}
                >
                  <MaterialIcons name="history" size={16} color={Colors.outline} />
                  <Text style={styles.recentTagText}>{term}</Text>
                  <TouchableOpacity
                    onPress={() => setRecentSearches((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <MaterialIcons name="close" size={14} color={Colors.outline} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Browse Categories Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Browse Categories</Text>
          <View style={styles.catGrid}>
            {MOCK_CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catCard, Shadows.card]}
                onPress={() => setSearchText(cat.name)}
                activeOpacity={0.8}
              >
                <View style={styles.catIconCircle}>
                  <MaterialIcons name={cat.icon as any} size={24} color={Colors.primary} />
                </View>
                <Text style={styles.catName} numberOfLines={1}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Trending Near You */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Trending Near You (জনপ্রিয় জিনিস)</Text>
          </View>
          <FlatList
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            data={trendingItems}
            keyExtractor={(it) => it.id}
            contentContainerStyle={styles.trendingList}
            renderItem={({ item }) => (
              <View style={styles.trendingCardWrap}>
                <ItemCard
                  item={item}
                  onPress={() => {
                    router.push({ pathname: '/item/[id]', params: { id: item.id } } as any);
                  }}
                />
              </View>
            )}
          />
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
  header: {
    paddingHorizontal: Spacing.margin,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  headerTitle: {
    ...Typography.headlineMd,
    color: Colors.primary,
  },
  headerSubtitle: {
    ...Typography.bodySm,
    color: Colors.primaryContainer,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: Spacing.margin,
    paddingBottom: 90,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.08)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMd,
    color: Colors.onSurface,
    padding: 0,
  },
  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  radiusLabel: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
  },
  radiusPill: {
    paddingHorizontal: 10,
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
    marginBottom: Spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.labelLg,
    color: Colors.onSurface,
  },
  clearAllText: {
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
    gap: 6,
    backgroundColor: Colors.surfaceContainer,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  recentTagText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 6,
  },
  catCard: {
    width: '30%',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.05)',
  },
  catIconCircle: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  catName: {
    ...Typography.labelSm,
    color: Colors.onSurface,
  },
  trendingList: {
    gap: 12,
    paddingVertical: 4,
  },
  trendingCardWrap: {
    width: 200,
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
    borderWidth: 1,
    borderColor: 'rgba(21,66,18,0.05)',
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
