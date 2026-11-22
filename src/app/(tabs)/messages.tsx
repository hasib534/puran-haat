import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
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
  const { conversations, proposals, profile } = useApp();
  const { user } = useAuth();
  const [tab, setTab] = useState<InboxTab>('chats');
  const [searchText, setSearchText] = useState('');

  const query = searchText.trim().toLowerCase();

  const conversationById = useMemo(
    () => new Map(conversations.map((conversation) => [conversation.id, conversation])),
    [conversations],
  );

  const filteredConversations = useMemo(() => {
    if (!query) return conversations;
    return conversations.filter((conversation) =>
      [conversation.other.full_name, conversation.lastMessage, conversation.itemTitle]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [conversations, query]);

  const sortedProposals = useMemo(
    () =>
      [...proposals].sort(
        (a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0),
      ),
    [proposals],
  );

  const filteredProposals = useMemo(() => {
    if (!query) return sortedProposals;
    return sortedProposals.filter((proposal) => {
      const isReceiver = proposal.receiver_id === user?.uid;
      const counterpart = isReceiver ? proposal.proposer : proposal.receiver;
      return [counterpart?.full_name, proposal.requested_item_title, proposal.note]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [query, sortedProposals, user?.uid]);

  const openChat = (conversationId?: string) => {
    if (!conversationId) return;
    router.push({ pathname: '/chat/[id]', params: { id: conversationId } } as never);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.push('/(tabs)' as never)}
          accessibilityLabel="Back to home"
        >
          <MaterialIcons name="arrow-back" size={23} color={Colors.primary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>Negotiations and trade proposals</Text>
        </View>

        <TouchableOpacity
          style={styles.avatarButton}
          onPress={() => router.push('/(tabs)/profile' as never)}
          accessibilityLabel="Open profile"
        >
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.headerAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.headerAvatar, styles.avatarFallback]}>
              <MaterialIcons name="person" size={20} color={Colors.primary} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <VerificationBanner />

      {/* Search */}
      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={21} color={Colors.outline} />
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search conversations..."
          placeholderTextColor="rgba(66, 73, 62, 0.55)"
          returnKeyType="search"
          accessibilityLabel="Search conversations"
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')} accessibilityLabel="Clear search">
            <MaterialIcons name="cancel" size={18} color={Colors.outline} />
          </TouchableOpacity>
        )}
      </View>

      {/* Segment */}
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
          data={filteredConversations}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="chat-bubble-outline" size={48} color={Colors.outline} />
              <Text style={styles.emptyTitle}>
                {query ? 'No matching chats' : 'No conversations yet'}
              </Text>
              <Text style={styles.emptyDesc}>
                {query
                  ? 'Try a different name or item.'
                  : 'Start a barter proposal to chat with traders.'}
              </Text>
            </View>
          }
          renderItem={({ item: c }) => (
            <TouchableOpacity
              style={[styles.row, Shadows.card]}
              onPress={() => openChat(c.id)}
              activeOpacity={0.8}
              accessibilityLabel={`Chat with ${c.other.full_name}`}
            >
              <View style={styles.avatarWrap}>
                {c.other.avatar_url ? (
                  <Image source={{ uri: c.other.avatar_url }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.imageFallback]}>
                    <MaterialIcons name="person" size={22} color={Colors.primary} />
                  </View>
                )}
                {c.other.is_verified && (
                  <View style={styles.verifiedBadge}>
                    <MaterialIcons name="verified" size={11} color={Colors.onPrimary} />
                  </View>
                )}
              </View>

              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.name} numberOfLines={1}>{c.other.full_name}</Text>
                  <Text style={styles.time}>{formatInboxTime(c.lastMessageAt)}</Text>
                </View>
                <Text style={styles.preview} numberOfLines={1}>
                  {c.lastMessage || 'Start the conversation'}
                </Text>
                <View style={styles.itemRow}>
                  <MaterialIcons name="swap-horiz" size={12} color={Colors.primary} />
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {c.itemTitle || 'Barter item'}
                  </Text>
                </View>
              </View>

              {c.itemImage ? (
                <Image source={{ uri: c.itemImage }} style={styles.thumb} contentFit="cover" />
              ) : null}

              {c.unread > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{c.unread}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={filteredProposals}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="handshake" size={48} color={Colors.outline} />
              <Text style={styles.emptyTitle}>
                {query ? 'No matching proposals' : 'No proposals yet'}
              </Text>
              <Text style={styles.emptyDesc}>
                {query
                  ? 'Try a different name or item.'
                  : 'Open a listing and send a barter offer to start negotiating.'}
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
                onPress={() => openChat(proposal.conversation_id || conversation?.id)}
                activeOpacity={openable ? 0.8 : 1}
                accessibilityLabel={`Proposal for ${itemTitle}, ${statusLabel}`}
              >
                <View style={styles.avatarWrap}>
                  {itemImage ? (
                    <Image source={{ uri: itemImage }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatar, styles.imageFallback]}>
                      <MaterialIcons name="inventory-2" size={22} color={Colors.primary} />
                    </View>
                  )}
                </View>

                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name} numberOfLines={1}>
                      {counterpart?.full_name || 'Trader'}
                    </Text>
                    <Text style={styles.time}>
                      {formatInboxTime(Date.parse(proposal.created_at) || undefined)}
                    </Text>
                  </View>
                  <Text style={styles.itemTitleStrong} numberOfLines={1}>{itemTitle}</Text>
                  {proposal.note ? (
                    <Text style={styles.preview} numberOfLines={1}>{proposal.note}</Text>
                  ) : null}
                  <View style={styles.rowBottom}>
                    {proposal.cash_adjustment ? (
                      <Text style={styles.cashText}>
                        Cash adjustment ৳{proposal.cash_adjustment}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.margin,
    paddingVertical: Spacing.xs,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { ...Typography.headlineSm, color: Colors.primary, fontWeight: '700' },
  headerSubtitle: { ...Typography.bodySm, color: Colors.onSurfaceVariant, fontSize: 11 },
  avatarButton: { width: 40, height: 40, borderRadius: BorderRadius.full, overflow: 'hidden' },
  headerAvatar: { width: '100%', height: '100%' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.secondaryContainer },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    marginHorizontal: Spacing.margin,
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.07)',
  },
  searchInput: { flex: 1, ...Typography.bodyMd, color: Colors.onSurface, padding: 0 },
  segment: {
    flexDirection: 'row',
    marginHorizontal: Spacing.margin,
    marginTop: Spacing.sm,
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
  segmentTextActive: { color: Colors.onPrimary, fontWeight: '700' },
  listContent: { paddingHorizontal: Spacing.margin, paddingBottom: 100, gap: 10, paddingTop: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.05)',
  },
  rowActionable: { borderColor: Colors.tertiaryFixedDim },
  avatarWrap: { position: 'relative' },
  avatar: { width: 50, height: 50, borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceContainer },
  verifiedBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surfaceContainerLowest,
  },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { ...Typography.labelLg, color: Colors.onSurface, fontWeight: '700', flex: 1 },
  time: { ...Typography.bodySm, color: Colors.outline, fontSize: 10 },
  preview: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 1 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  itemTitle: { ...Typography.labelSm, color: Colors.primary, flex: 1, fontSize: 10 },
  itemTitleStrong: { ...Typography.labelSm, color: Colors.primary, marginTop: 2 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  thumb: { width: 46, height: 46, borderRadius: BorderRadius.sm, backgroundColor: Colors.surfaceContainer },
  spacer: { flex: 1 },
  cashText: { ...Typography.labelSm, color: Colors.onSurfaceVariant, flex: 1, fontSize: 10 },
  unreadBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: Colors.tertiary,
    borderRadius: BorderRadius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
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
