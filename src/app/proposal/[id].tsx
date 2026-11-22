import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../../constants/theme';
import { MOCK_CATEGORIES, MOCK_ITEMS } from '../../data/mock-items';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { AuthGate } from '../../components/auth/AuthGate';
import { isFirebaseConfigured } from '../../lib/firebase';
import type { Item } from '../../types';

const CATEGORY_NAMES = new Map(MOCK_CATEGORIES.map((category) => [category.id, category.name]));

export default function ExchangeProposalScreen() {
  return (
    <AuthGate
      requireVerified
      title="Sign in to propose a trade"
      description="Verify your email, then offer one of your items for a swap."
    >
      <ProposalForm />
    </AuthGate>
  );
}

function ProposalForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, itemsLoading } = useApp();
  const requestedItem = items.find((it) => it.id === id);

  if (itemsLoading && !requestedItem) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.stateScreen}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.stateText}>Loading listing…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!requestedItem) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.stateScreen}>
          <MaterialIcons name="inventory-2" size={52} color={Colors.outline} />
          <Text style={styles.stateTitle}>Listing not available</Text>
          <Text style={styles.stateText}>
            This item may have been removed, so a proposal cannot be sent.
          </Text>
          <TouchableOpacity style={styles.stateButton} onPress={() => router.back()}>
            <Text style={styles.stateButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return <ProposalEditor requestedItem={requestedItem} />;
}

function ProposalEditor({ requestedItem }: { requestedItem: Item }) {
  const { items, sendProposal, profile } = useApp();
  const { user } = useAuth();

  // Only the signed-in user's own listings can be offered.
  const ownedItems = items.filter(
    (item) => item.user_id === user?.uid && item.id !== requestedItem.id,
  );
  const demoItems = [MOCK_ITEMS[3], MOCK_ITEMS[4], MOCK_ITEMS[5]].filter(
    (item) => item.id !== requestedItem.id,
  );
  const myItems: Item[] = isFirebaseConfigured ? ownedItems : demoItems;

  const [selectedOfferId, setSelectedOfferId] = useState<string>(myItems[0]?.id ?? '');
  const [cashAdjustment, setCashAdjustment] = useState<string>('0');
  const [proposalNote, setProposalNote] = useState<string>(
    'Hi! I would love to trade this for your item. Can meet in Dhanmondi or TSC.',
  );
  const [submitting, setSubmitting] = useState(false);
  const selectedOfferItem = myItems.find((it) => it.id === selectedOfferId) || myItems[0];
  const requiresOffer = requestedItem.trade_mode !== 'free';

  const handleSendProposal = async () => {
    if (requiresOffer && !selectedOfferItem) {
      showAlert('No item to offer', 'Post an item first so you have something to trade.');
      return;
    }
    if (user && requestedItem.user_id === user.uid) {
      showAlert('Your listing', 'You cannot propose a trade on your own item.');
      return;
    }
    setSubmitting(true);
    try {
      const conversationId = await sendProposal({
        requestedItem,
        offeredItem: selectedOfferItem,
        cashAdjustment: Math.max(0, Number(cashAdjustment) || 0),
        note: proposalNote,
      });
      showAlert(
        'Proposal Sent!',
        `Your barter exchange proposal has been delivered to ${requestedItem.user?.full_name}. You can chat in real time to finalize!`,
        [
          {
            text: 'Open Chat',
            onPress: () =>
              router.replace({ pathname: '/chat/[id]', params: { id: conversationId } } as never),
          },
          {
            text: 'Back to Haat',
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error) {
      showAlert('Could not send proposal', (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={23} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Puran Haat</Text>
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={() => router.push('/(tabs)/profile' as never)}
          accessibilityLabel="Open profile"
        >
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.headerAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.headerAvatar, styles.avatarFallback]}>
              <MaterialIcons name="person" size={18} color={Colors.primary} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Requested item */}
        <Text style={styles.pageTitle}>You are requesting</Text>
        <Text style={styles.pageSubtitle}>Review the item details before sending your proposal.</Text>

        <View style={[styles.targetCard, Shadows.card]}>
          <Image source={{ uri: requestedItem.images[0] }} style={styles.targetImage} contentFit="cover" />
          <View style={styles.targetBody}>
            <View style={styles.targetTitleRow}>
              <Text style={styles.targetTitle} numberOfLines={2}>{requestedItem.title}</Text>
              <View style={styles.categoryPill}>
                <Text style={styles.categoryPillText}>
                  {CATEGORY_NAMES.get(requestedItem.category_id) || 'Item'}
                </Text>
              </View>
            </View>
            <Text style={styles.targetDesc} numberOfLines={3}>
              {requestedItem.description || 'No description provided by the trader.'}
            </Text>
            <View style={styles.ownerRow}>
              {requestedItem.user?.avatar_url ? (
                <Image
                  source={{ uri: requestedItem.user.avatar_url }}
                  style={styles.ownerAvatar}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.ownerAvatar, styles.avatarFallback]}>
                  <MaterialIcons name="person" size={14} color={Colors.primary} />
                </View>
              )}
              <Text style={styles.ownerText}>
                Offered by <Text style={styles.ownerName}>{requestedItem.user?.full_name || 'Trader'}</Text>
              </Text>
              {requestedItem.user?.is_verified && (
                <MaterialIcons name="verified" size={13} color={Colors.primary} />
              )}
            </View>
          </View>
        </View>

        {/* Your offer */}
        <Text style={styles.sectionTitle}>Your Offer</Text>
        <Text style={styles.sectionHint}>Select an item from your inventory to trade.</Text>

        {myItems.length === 0 ? (
          <Text style={styles.emptyOfferText}>
            {requiresOffer
              ? 'You have no other listings yet. Post an item from the Trade tab to offer it here.'
              : 'This is a free gift — no item is required to claim it.'}
          </Text>
        ) : null}

        <View style={styles.offerGrid}>
          {myItems.map((myIt) => {
            const isSelected = selectedOfferId === myIt.id;
            return (
              <TouchableOpacity
                key={myIt.id}
                style={[styles.offerCard, isSelected && styles.offerCardSelected]}
                onPress={() => setSelectedOfferId(myIt.id)}
                activeOpacity={0.85}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <Image source={{ uri: myIt.images[0] }} style={styles.offerImage} contentFit="cover" />
                <Text style={styles.offerTitle} numberOfLines={2}>{myIt.title}</Text>
                {isSelected && (
                  <View style={styles.checkedCircle}>
                    <MaterialIcons name="check" size={14} color={Colors.onPrimary} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[styles.offerCard, styles.addNewCard]}
            onPress={() => router.push('/(tabs)/post' as never)}
            accessibilityRole="button"
            accessibilityLabel="Add a new item to your inventory"
          >
            <View style={styles.addNewIcon}>
              <MaterialIcons name="add" size={24} color={Colors.primary} />
            </View>
            <Text style={styles.addNewText}>Add New Item</Text>
          </TouchableOpacity>
        </View>

        {/* Message */}
        <Text style={styles.sectionTitle}>Message to Owner (Optional)</Text>
        <TextInput
          style={styles.noteInput}
          multiline
          numberOfLines={3}
          value={proposalNote}
          onChangeText={setProposalNote}
          placeholder="Hi! I have a healthy Monstera that might look great on that table..."
          placeholderTextColor="rgba(66, 73, 62, 0.55)"
          accessibilityLabel="Message to the owner"
        />

        {/* Cash adjustment */}
        {requiresOffer && (
          <>
            <Text style={styles.sectionTitle}>Cash Adjustment (Optional)</Text>
            <Text style={styles.sectionHint}>Add cash if the items differ in value (৳ BDT).</Text>
            <View style={styles.cashInputRow}>
              <Text style={styles.currencySymbol}>৳</Text>
              <TextInput
                style={styles.cashInput}
                keyboardType="numeric"
                value={cashAdjustment}
                onChangeText={setCashAdjustment}
                placeholder="0"
                placeholderTextColor={Colors.outline}
                accessibilityLabel="Cash adjustment in BDT"
              />
            </View>
          </>
        )}

        {/* Trade preview */}
        <View style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewLabel}>Trade Preview</Text>
            <MaterialIcons name="swap-horiz" size={19} color={Colors.primary} />
          </View>

          <View style={styles.previewRow}>
            <View style={styles.previewItem}>
              {selectedOfferItem?.images[0] ? (
                <Image
                  source={{ uri: selectedOfferItem.images[0] }}
                  style={styles.previewThumb}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.previewThumb, styles.avatarFallback]}>
                  <MaterialIcons name="inventory-2" size={16} color={Colors.primary} />
                </View>
              )}
              <Text style={styles.previewItemText} numberOfLines={1}>
                {selectedOfferItem?.title || 'No item selected'}
              </Text>
            </View>

            <Text style={styles.previewFor}>for</Text>

            <View style={[styles.previewItem, styles.previewItemRight]}>
              <Text style={[styles.previewItemText, styles.previewItemTextRight]} numberOfLines={1}>
                {requestedItem.title}
              </Text>
              <Image
                source={{ uri: requestedItem.images[0] }}
                style={styles.previewThumb}
                contentFit="cover"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              (submitting || (requiresOffer && !selectedOfferItem)) && styles.submitButtonDisabled,
            ]}
            onPress={handleSendProposal}
            disabled={submitting || (requiresOffer && !selectedOfferItem)}
            activeOpacity={0.88}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.onPrimary} />
            ) : (
              <>
                <Text style={styles.submitButtonText}>
                  {requiresOffer ? 'Send Proposal' : 'Claim Free Gift'}
                </Text>
                <MaterialIcons
                  name={requiresOffer ? 'send' : 'volunteer-activism'}
                  size={18}
                  color={Colors.onPrimary}
                />
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  stateScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  stateTitle: { ...Typography.headlineSm, color: Colors.onSurface, marginTop: Spacing.md },
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.margin,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...Typography.headlineSm, color: Colors.primary, fontWeight: '700' },
  avatarButton: { width: 38, height: 38, borderRadius: BorderRadius.full, overflow: 'hidden' },
  headerAvatar: { width: '100%', height: '100%' },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.secondaryContainer,
  },
  scrollContent: { paddingHorizontal: Spacing.margin, paddingBottom: Spacing.xl },
  pageTitle: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
    fontWeight: '700',
    marginTop: Spacing.sm,
  },
  pageSubtitle: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  targetCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  targetImage: {
    width: '100%',
    height: 170,
    backgroundColor: Colors.surfaceContainer,
  },
  targetBody: { padding: Spacing.md },
  targetTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  targetTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    fontWeight: '700',
    flex: 1,
  },
  categoryPill: {
    backgroundColor: Colors.secondaryContainer,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  categoryPillText: { ...Typography.labelSm, color: Colors.onSecondaryContainer, fontSize: 10 },
  targetDesc: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    lineHeight: 19,
    marginTop: 6,
  },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm },
  ownerAvatar: { width: 24, height: 24, borderRadius: BorderRadius.full },
  ownerText: { ...Typography.bodySm, color: Colors.onSurfaceVariant, fontSize: 11 },
  ownerName: { fontWeight: '700', color: Colors.primary },
  sectionTitle: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    fontWeight: '700',
    marginTop: Spacing.sm,
  },
  sectionHint: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  emptyOfferText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    marginBottom: Spacing.sm,
  },
  offerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  offerCard: {
    width: '48%',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  offerCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(45, 90, 39, 0.05)',
  },
  offerImage: {
    width: '100%',
    height: 92,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceContainer,
  },
  offerTitle: { ...Typography.labelSm, color: Colors.onSurface, marginTop: 6 },
  checkedCircle: {
    position: 'absolute',
    top: 13,
    right: 13,
    width: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surfaceContainerLowest,
  },
  addNewCard: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 128,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(21, 66, 18, 0.25)',
    backgroundColor: 'rgba(45, 90, 39, 0.03)',
  },
  addNewIcon: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  addNewText: { ...Typography.labelSm, color: Colors.primary, fontWeight: '700' },
  noteInput: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.12)',
    ...Typography.bodyMd,
    color: Colors.onSurface,
    minHeight: 82,
    textAlignVertical: 'top',
  },
  cashInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.12)',
  },
  currencySymbol: { fontSize: 20, fontWeight: '700', color: Colors.primary, marginRight: 8 },
  cashInput: {
    flex: 1,
    paddingVertical: 10,
    ...Typography.bodyLg,
    color: Colors.onSurface,
  },
  previewCard: {
    backgroundColor: Colors.secondaryContainer,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  previewLabel: { ...Typography.labelLg, color: Colors.primary, fontWeight: '700' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  previewItemRight: { justifyContent: 'flex-end' },
  previewThumb: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceContainer,
  },
  previewItemText: { ...Typography.labelSm, color: Colors.onSecondaryContainer, flexShrink: 1 },
  previewItemTextRight: { textAlign: 'right' },
  previewFor: { ...Typography.labelSm, color: Colors.outline, fontSize: 10 },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.md,
  },
  submitButtonDisabled: { opacity: 0.65 },
  submitButtonText: { ...Typography.labelLg, color: Colors.onPrimary, fontWeight: '700' },
});
