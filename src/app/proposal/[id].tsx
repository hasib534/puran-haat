import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../../constants/theme';
import { MOCK_ITEMS } from '../../data/mock-items';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { AuthGate } from '../../components/auth/AuthGate';
import { isFirebaseConfigured } from '../../lib/firebase';
import { Item } from '../../types';

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
  const { items, sendProposal } = useApp();
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
      Alert.alert('No item to offer', 'Post an item first so you have something to trade.');
      return;
    }
    if (user && requestedItem.user_id === user.uid) {
      Alert.alert('Your listing', 'You cannot propose a trade on your own item.');
      return;
    }
    setSubmitting(true);
    try {
      const conversationId = await sendProposal({
        requestedItem,
        offeredItem: selectedOfferItem,
        cashAdjustment: Number(cashAdjustment) || 0,
        note: proposalNote,
      });
      Alert.alert(
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
      Alert.alert('Could not send proposal', (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Barter Proposal</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageSubtitle}>
          Trade items directly without cash, or balance with a small adjustment!
        </Text>

        {/* 2-Sided Exchange Card */}
        <View style={[styles.exchangeCard, Shadows.card]}>
          {/* Top: Requested Item */}
          <View style={styles.itemSlot}>
            <Text style={styles.slotLabel}>YOU RECEIVE (আপনি চান)</Text>
            <View style={styles.slotItemRow}>
              <Image source={{ uri: requestedItem.images[0] }} style={styles.slotImage} contentFit="cover" />
              <View style={styles.slotDetails}>
                <Text style={styles.slotTitle} numberOfLines={1}>{requestedItem.title}</Text>
                <Text style={styles.slotOwner}>Owner: {requestedItem.user?.full_name}</Text>
                <View style={styles.ecoTag}>
                  <MaterialIcons name="eco" size={12} color={Colors.primary} />
                  <Text style={styles.ecoTagText}>{requestedItem.eco_impact_rating} Eco-Score</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Swap Indicator Pill */}
          <View style={styles.swapDivider}>
            <View style={styles.swapIconCircle}>
              <MaterialIcons name="swap-vert" size={24} color={Colors.onPrimary} />
            </View>
          </View>

          {/* Bottom: Offered Item */}
          <View style={styles.itemSlot}>
            <Text style={styles.slotLabel}>
              {requiresOffer ? 'YOU OFFER (বিনিময়ে আপনি দিচ্ছেন)' : 'YOU OFFER (optional for free gifts)'}
            </Text>
            <View style={styles.slotItemRow}>
              {selectedOfferItem ? (
                <Image source={{ uri: selectedOfferItem.images[0] }} style={styles.slotImage} contentFit="cover" />
              ) : (
                <View style={[styles.slotImage, styles.emptySlot]}>
                  <MaterialIcons name="add-photo-alternate" size={22} color={Colors.outline} />
                </View>
              )}
              <View style={styles.slotDetails}>
                <Text style={styles.slotTitle} numberOfLines={1}>
                  {selectedOfferItem?.title ?? 'No item to offer yet'}
                </Text>
                <Text style={styles.slotOwner}>
                  {selectedOfferItem ? 'From your inventory' : 'Post an item first to trade'}
                </Text>
                {selectedOfferItem ? (
                  <Text style={styles.conditionText}>
                    Condition: {selectedOfferItem.condition.toUpperCase()}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {/* Selector: Choose which of your items to offer */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Item to Trade</Text>
          {myItems.length === 0 ? (
            <Text style={styles.emptyOfferText}>
              {requiresOffer
                ? 'You have no other listings yet. Post an item from the Post tab to offer it here.'
                : 'This is a free gift — no item is required to claim it.'}
            </Text>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerList}>
            {myItems.map((myIt) => {
              const isSelected = selectedOfferId === myIt.id;
              return (
                <TouchableOpacity
                  key={myIt.id}
                  style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                  onPress={() => setSelectedOfferId(myIt.id)}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: myIt.images[0] }} style={styles.pickerThumb} contentFit="cover" />
                  <Text style={styles.pickerTitle} numberOfLines={1}>{myIt.title}</Text>
                  {isSelected && (
                    <View style={styles.checkedCircle}>
                      <MaterialIcons name="check" size={14} color={Colors.onPrimary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Cash Adjustment (Optional) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cash Adjustment (ঐচ্ছিক টাকা সমন্বয়)</Text>
          <Text style={styles.sectionSubtext}>Add cash if your item is of different value (৳ BDT)</Text>
          <View style={styles.cashInputRow}>
            <Text style={styles.currencySymbol}>৳</Text>
            <TextInput
              style={styles.cashInput}
              keyboardType="numeric"
              value={cashAdjustment}
              onChangeText={setCashAdjustment}
              placeholder="0"
              placeholderTextColor={Colors.outline}
            />
          </View>
        </View>

        {/* Proposal Note */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Message to Trader</Text>
          <TextInput
            style={styles.noteInput}
            multiline
            numberOfLines={3}
            value={proposalNote}
            onChangeText={setProposalNote}
            placeholder="Suggest meetup place or terms..."
            placeholderTextColor={Colors.outline}
          />
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={[styles.bottomBar, Shadows.tabBar]}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (submitting || (requiresOffer && !selectedOfferItem)) && { opacity: 0.65 },
          ]}
          onPress={handleSendProposal}
          disabled={submitting || (requiresOffer && !selectedOfferItem)}
          activeOpacity={0.88}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.onPrimary} />
          ) : (
            <MaterialIcons name={requiresOffer ? 'send' : 'volunteer-activism'} size={20} color={Colors.onPrimary} />
          )}
          <Text style={styles.submitButtonText}>
            {submitting
              ? 'Sending…'
              : requiresOffer
                ? 'Send Barter Proposal'
                : 'Claim Free Gift'}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.margin,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(21, 66, 18, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.headlineSm,
    color: Colors.primary,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: Spacing.margin,
    paddingTop: Spacing.xs,
    paddingBottom: 100,
  },
  pageSubtitle: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    marginBottom: Spacing.md,
  },
  exchangeCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.06)',
    marginBottom: Spacing.lg,
  },
  itemSlot: {
    padding: Spacing.xs,
  },
  slotLabel: {
    ...Typography.labelSm,
    color: Colors.primaryContainer,
    marginBottom: 8,
  },
  slotItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  slotImage: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceContainer,
  },
  slotDetails: {
    flex: 1,
  },
  emptySlot: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.outlineVariant,
  },
  emptyOfferText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    marginBottom: Spacing.sm,
  },
  slotTitle: {
    ...Typography.labelLg,
    color: Colors.onSurface,
  },
  slotOwner: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    marginTop: 2,
  },
  ecoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(45, 90, 39, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginTop: 4,
  },
  ecoTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  conditionText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.secondary,
    marginTop: 3,
  },
  swapDivider: {
    alignItems: 'center',
    marginVertical: 4,
  },
  swapIconCircle: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    marginBottom: 4,
  },
  sectionSubtext: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    marginBottom: 8,
  },
  pickerList: {
    gap: 12,
    paddingVertical: 4,
  },
  pickerItem: {
    width: 100,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    padding: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    position: 'relative',
  },
  pickerItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(45, 90, 39, 0.05)',
  },
  pickerThumb: {
    width: 80,
    height: 60,
    borderRadius: BorderRadius.sm,
    marginBottom: 6,
  },
  pickerTitle: {
    ...Typography.labelSm,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  checkedCircle: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
    marginRight: 8,
  },
  cashInput: {
    flex: 1,
    paddingVertical: 10,
    ...Typography.bodyLg,
    color: Colors.onSurface,
  },
  noteInput: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    ...Typography.bodyMd,
    color: Colors.onSurface,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.margin,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: 'rgba(21, 66, 18, 0.08)',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
  },
});
