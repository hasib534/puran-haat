import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { Colors } from '../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { AuthGate } from '../components/auth/AuthGate';
import { useAuthGuard } from '../hooks/useAuthGuard';
import { showAlert } from '../lib/alert';
import { MOCK_CATEGORIES } from '../data/mock-items';
import { isFirebaseConfigured } from '../lib/firebase';
import type { Item } from '../types';

const CATEGORY_NAMES = new Map(MOCK_CATEGORIES.map((category) => [category.id, category.name]));

function formatListingDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function tradeModeLabel(item: Item): string {
  if (item.trade_mode === 'free') return 'Free gift';
  if (item.trade_mode === 'auction') return 'Auction';
  return 'Barter';
}

export default function MyListingsScreen() {
  return (
    <AuthGate
      title="Sign in to manage your listings"
      description="Edit details or remove items you no longer want to trade."
    >
      <MyListingsView />
    </AuthGate>
  );
}

function MyListingsView() {
  const { items, deleteItem } = useApp();
  const { user } = useAuth();
  const { guard } = useAuthGuard();

  const myItems = useMemo(() => {
    if (!isFirebaseConfigured) return items.filter((item) => item.user_id === 'me');
    return user ? items.filter((item) => item.user_id === user.uid) : [];
  }, [items, user]);

  const handleDelete = (item: Item) => {
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
            deleteItem(item.id).catch((error: Error) =>
              showAlert('Could not delete listing', error.message),
            );
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={23} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>My Listings</Text>
          <Text style={styles.headerSubtitle}>
            {myItems.length} {myItems.length === 1 ? 'item' : 'items'} on the Haat
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/(tabs)/post' as never)}
          accessibilityLabel="Post a new item"
        >
          <MaterialIcons name="add" size={22} color={Colors.onPrimary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={myItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          myItems.length > 0 ? (
            <View style={styles.introRow}>
              <View style={styles.liveDot} />
              <Text style={styles.introText}>Live and visible to nearby traders</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <MaterialIcons name="inventory-2" size={42} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No listings yet</Text>
            <Text style={styles.emptyText}>
              Post something you no longer need and trade it for something useful.
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/post' as never)}
              accessibilityRole="button"
            >
              <MaterialIcons name="add-circle-outline" size={18} color={Colors.onPrimary} />
              <Text style={styles.emptyButtonText}>Post an item</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, Shadows.card]}>
            <TouchableOpacity
              style={styles.cardMain}
              activeOpacity={0.85}
              onPress={() =>
                router.push({ pathname: '/item/[id]', params: { id: item.id } } as never)
              }
              accessibilityLabel={`Open ${item.title}`}
            >
              <View style={styles.thumbWrap}>
                <Image source={{ uri: item.images[0] }} style={styles.thumb} contentFit="cover" />
                <View style={styles.modeBadge}>
                  <MaterialIcons
                    name={item.trade_mode === 'free' ? 'volunteer-activism' : 'swap-horiz'}
                    size={11}
                    color={Colors.onPrimary}
                  />
                  <Text style={styles.modeBadgeText}>{tradeModeLabel(item)}</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={styles.metaRow}>
                  <MaterialIcons name="category" size={12} color={Colors.onSurfaceVariant} />
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {CATEGORY_NAMES.get(item.category_id) || item.category_id}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <MaterialIcons name="schedule" size={12} color={Colors.outline} />
                  <Text style={styles.cardDate}>Listed {formatListingDate(item.created_at)}</Text>
                </View>
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() =>
                  router.push({ pathname: '/edit-item/[id]', params: { id: item.id } } as never)
                }
                accessibilityLabel={`Edit ${item.title}`}
              >
                <MaterialIcons name="edit" size={16} color={Colors.primary} />
                <Text style={styles.secondaryActionText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() =>
                  router.push({ pathname: '/item/[id]', params: { id: item.id } } as never)
                }
                accessibilityLabel={`View ${item.title}`}
              >
                <MaterialIcons name="visibility" size={16} color={Colors.primary} />
                <Text style={styles.secondaryActionText}>View</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryAction, styles.deleteAction]}
                onPress={() => handleDelete(item)}
                accessibilityLabel={`Delete ${item.title}`}
              >
                <MaterialIcons name="delete-outline" size={16} color={Colors.error} />
                <Text style={[styles.secondaryActionText, styles.deleteActionText]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.margin,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(21,66,18,0.05)',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(21,66,18,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: { ...Typography.headlineSm, color: Colors.primary, fontWeight: '700' },
  headerSubtitle: { ...Typography.bodySm, color: Colors.onSurfaceVariant },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.margin,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
    gap: 12,
    flexGrow: 1,
  },
  introRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 2,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  introText: { ...Typography.bodySm, color: Colors.onSurfaceVariant, fontSize: 11 },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(21,66,18,0.06)',
    padding: Spacing.xs,
  },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumbWrap: { position: 'relative' },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceContainer,
  },
  modeBadge: {
    position: 'absolute',
    left: 5,
    bottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  modeBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.onPrimary },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { ...Typography.labelLg, color: Colors.onSurface, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMeta: { ...Typography.bodySm, color: Colors.primary, fontSize: 11 },
  cardDate: { ...Typography.bodySm, color: Colors.outline, fontSize: 11 },
  divider: {
    height: 1,
    backgroundColor: 'rgba(21,66,18,0.06)',
    marginTop: Spacing.xs,
    marginBottom: 6,
  },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(21,66,18,0.06)',
  },
  secondaryActionText: { ...Typography.labelSm, color: Colors.primary, fontWeight: '700' },
  deleteAction: { backgroundColor: Colors.errorContainer },
  deleteActionText: { color: Colors.error },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    gap: 8,
    paddingTop: 60,
  },
  emptyIconWrap: {
    width: 84,
    height: 84,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { ...Typography.headlineSm, color: Colors.onSurface, fontWeight: '700' },
  emptyText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 21,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    borderRadius: BorderRadius.full,
  },
  emptyButtonText: { ...Typography.labelLg, color: Colors.onPrimary, fontWeight: '700' },
});