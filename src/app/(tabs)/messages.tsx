import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { AuthGate } from '../../components/auth/AuthGate';
import { VerificationBanner } from '../../components/auth/VerificationBanner';
import type { TradeProposal } from '../../types';

type InboxTab = 'chats' | 'proposals';

function formatInboxTime(timestamp?: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (date.toDateString() === new Date().toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function proposalStatusLabel(proposal: TradeProposal, isReceiver: boolean): string {
  if (proposal.status === 'pending') {
    return isReceiver ? 'Needs your response' : 'Awaiting response';
  }
  if (proposal.status === 'accepted') return 'Accepted';
  if (proposal.status === 'declined') return 'Declined';
  if (proposal.status === 'countered') return 'Countered';
  return 'Completed';
}

export default function MessagesTab() {
  return (
    <AuthGate
      title="Sign in to view your chats"
      description="Your barter conversations and trade proposals live here."
    >
      <InboxView />
    </AuthGate>
  );
}

function InboxView() {
  const { conversations, proposals } = useApp();
  const { user } = useAuth();
  const [tab, setTab] = useState<InboxTab>('chats');

  const conversationById = useMemo(
    () => new Map(conversations.map((conversation) => [conversation.id, conversation])),
    [conversations],
  );

  const sortedProposals = useMemo(
    () =>
      [...proposals].sort(
        (a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0),
      ),
    [proposals],
  );

  const openChat = (conversationId?: string) => {
    if (!conversationId) return;
    router.push({ pathname: '/chat/[id]', params: { id: conversationId } } as never);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <Text style={styles.headerSubtitle}>Negotiations and trade proposals</Text>
      </View>

      <VerificationBanner />

      <View style={styles.segment} accessibilityRole="tablist">
        {(['chats', 'proposals'] as const).map((value) => {
          const active = tab === value;
          const count = value === 'chats' ? conversations.length : sortedProposals.length;
          return (
            <TouchableOpacity
              key={value}
              style={[styles.segmentButton, active && styles.segmentButtonActive]}
              onPress={() => setTab(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {value === 'chats' ? 'Chats' : 'Proposals'} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'chats' ? (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="chat-bubble-outline" size={48} color={Colors.outline} />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyDesc}>Start a barter proposal to chat with traders.</Text>
            </View>
          }
          renderItem={({ item: c }) => (
            <TouchableOpacity
              style={[styles.row, Shadows.card]}
              onPress={() => openChat(c.id)}
              activeOpacity={0.8}
              accessibilityLabel={`Chat with ${c.other.full_name}`}
            >
              {c.other.avatar_url ? (
                <Image
                  source={{ uri: c.other.avatar_url }}
                  style={styles.avatar}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.avatar, styles.imageFallback]}>
                  <MaterialIcons name="person" size={22} color={Colors.primary} />
                </View>
              )}
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.name} numberOfLines={1}>{c.other.full_name}</Text>
                  <Text style={styles.time}>{formatInboxTime(c.lastMessageAt)}</Text>
                </View>
                <Text style={styles.preview} numberOfLines={1}>{c.lastMessage}</Text>
                <View style={styles.rowBottom}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {c.itemTitle || 'Barter item'}
                  </Text>
                  {c.unread > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{c.unread}</Text>
                    </View>
                  )}
                  <View style={[styles.statusPill, c.status === 'accepted' ? styles.statusAccepted : c.status === 'declined' ? styles.statusDeclined : styles.statusPending]}>
                    <Text style={styles.statusText}>{c.status}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={sortedProposals}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="handshake" size={48} color={Colors.outline} />
              <Text style={styles.emptyTitle}>No proposals yet</Text>
              <Text style={styles.emptyDesc}>
                Open a listing and send a barter offer to start negotiating.
              </Text>
            </View>
          }
          renderItem={({ item: proposal }) => {
            const isReceiver = proposal.receiver_id === user?.uid;
            const conversation = proposal.conversation_id
              ? conversationById.get(proposal.conversation_id)
              : undefined;
            const counterpart = isReceiver ? proposal.proposer : proposal.receiver;
            const itemTitle =
              proposal.requested_item_title ||
              conversation?.itemTitle ||
              'Barter item';
            const itemImage =
              proposal.requested_item_image || conversation?.itemImage;
            const needsResponse = proposal.status === 'pending' && isReceiver;
            const statusLabel = proposalStatusLabel(proposal, isReceiver);
            const openable = Boolean(proposal.conversation_id || conversation);

            return (
              <TouchableOpacity
                style={[styles.row, Shadows.card, needsResponse && styles.rowActionable]}
                onPress={() =>
                  openChat(proposal.conversation_id || conversation?.id)
                }
                activeOpacity={openable ? 0.8 : 1}
                accessibilityLabel={`Proposal for ${itemTitle}, ${statusLabel}`}
              >
                {itemImage ? (
                  <Image source={{ uri: itemImage }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, styles.imageFallback]}>
                    <MaterialIcons name="inventory-2" size={22} color={Colors.primary} />
                  </View>
                )}
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name} numberOfLines={1}>
                      {counterpart?.full_name || 'Trader'}
                    </Text>
                    <Text style={styles.time}>
                      {formatInboxTime(Date.parse(proposal.created_at) || undefined)}
                    </Text>
                  </View>
                  <Text style={styles.itemTitle} numberOfLines={1}>{itemTitle}</Text>
                  {proposal.note ? (
                    <Text style={styles.preview} numberOfLines={1}>
                      {proposal.note}
                    </Text>
                  ) : null}
                  <View style={styles.rowBottom}>
                    {proposal.cash_adjustment ? (
                      <Text style={styles.cashText}>
                        Cash adjustment: ৳{proposal.cash_adjustment}
                      </Text>
                    ) : (
                      <View style={styles.spacer} />
                    )}
                    <View
                      style={[
                        styles.statusPill,
                        needsResponse
                          ? styles.statusAction
                          : proposal.status === 'accepted' || proposal.status === 'completed'
                            ? styles.statusAccepted
                            : proposal.status === 'declined'
                              ? styles.statusDeclined
                              : styles.statusPending,
                      ]}
                    >
                      <Text style={styles.statusText}>{statusLabel}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.margin, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  headerTitle: { ...Typography.headlineMd, color: Colors.primary },
  headerSubtitle: { ...Typography.bodySm, color: Colors.primaryContainer, fontWeight: '600' },
  segment: {
    flexDirection: 'row',
    marginHorizontal: Spacing.margin,
    marginTop: Spacing.xs,
    backgroundColor: Colors.secondaryContainer,
    borderRadius: BorderRadius.full,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  segmentButtonActive: { backgroundColor: Colors.primary },
  segmentText: { ...Typography.labelMd, color: Colors.onSecondaryContainer },
  segmentTextActive: { color: Colors.onPrimary },
  listContent: { paddingHorizontal: Spacing.margin, paddingBottom: 90, gap: 10, paddingTop: Spacing.sm },
  row: { flexDirection: 'row', gap: 12, backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.sm, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: 'rgba(21,66,18,0.05)' },
  rowActionable: { borderColor: Colors.tertiaryFixedDim },
  avatar: { width: 48, height: 48, borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceContainer },
  thumb: { width: 52, height: 52, borderRadius: BorderRadius.sm, backgroundColor: Colors.surfaceContainer },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { ...Typography.labelLg, color: Colors.onSurface, flex: 1 },
  time: { ...Typography.bodySm, color: Colors.outline, fontSize: 10 },
  preview: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 2 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  itemTitle: { ...Typography.labelSm, color: Colors.primary, flex: 1 },
  spacer: { flex: 1 },
  cashText: { ...Typography.labelSm, color: Colors.onSurfaceVariant, flex: 1 },
  unreadBadge: { backgroundColor: Colors.tertiary, borderRadius: BorderRadius.full, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  unreadText: { color: Colors.onTertiary, fontSize: 10, fontWeight: '700' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  statusPending: { backgroundColor: 'rgba(106,33,13,0.12)' },
  statusAction: { backgroundColor: Colors.tertiaryFixedDim },
  statusAccepted: { backgroundColor: 'rgba(45,90,39,0.12)' },
  statusDeclined: { backgroundColor: 'rgba(186,26,26,0.12)' },
  statusText: { fontSize: 10, fontWeight: '700', color: Colors.onSurfaceVariant },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.lg },
  emptyTitle: { ...Typography.headlineSm, color: Colors.onSurface, marginTop: Spacing.sm },
  emptyDesc: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, textAlign: 'center', marginTop: 4 },
});
