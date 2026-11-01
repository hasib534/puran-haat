import React from 'react';
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
import { AuthGate } from '../../components/auth/AuthGate';
import { VerificationBanner } from '../../components/auth/VerificationBanner';

function formatConversationTime(timestamp?: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (date.toDateString() === new Date().toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function MessagesTab() {
  return (
    <AuthGate
      title="Sign in to view your chats"
      description="Your barter conversations and trade updates live here."
    >
      <MessagesInbox />
    </AuthGate>
  );
}

function MessagesInbox() {
  const { conversations } = useApp();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <Text style={styles.headerSubtitle}>Active barter negotiations</Text>
      </View>

      <VerificationBanner />

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
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id } } as never)}
            activeOpacity={0.8}
          >
            <Image source={{ uri: c.other.avatar_url }} style={styles.avatar} contentFit="cover" />
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <Text style={styles.name} numberOfLines={1}>{c.other.full_name}</Text>
                <Text style={styles.time}>{formatConversationTime(c.lastMessageAt)}</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.margin, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  headerTitle: { ...Typography.headlineMd, color: Colors.primary },
  headerSubtitle: { ...Typography.bodySm, color: Colors.primaryContainer, fontWeight: '600' },
  listContent: { paddingHorizontal: Spacing.margin, paddingBottom: 90, gap: 10, paddingTop: Spacing.sm },
  row: { flexDirection: 'row', gap: 12, backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.sm, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: 'rgba(21,66,18,0.05)' },
  avatar: { width: 48, height: 48, borderRadius: BorderRadius.full },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { ...Typography.labelLg, color: Colors.onSurface, flex: 1 },
  time: { ...Typography.bodySm, color: Colors.outline, fontSize: 10 },
  preview: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 2 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  itemTitle: { ...Typography.labelSm, color: Colors.primary, flex: 1 },
  unreadBadge: { backgroundColor: Colors.tertiary, borderRadius: BorderRadius.full, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  unreadText: { color: Colors.onTertiary, fontSize: 10, fontWeight: '700' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  statusPending: { backgroundColor: 'rgba(106,33,13,0.12)' },
  statusAccepted: { backgroundColor: 'rgba(45,90,39,0.12)' },
  statusDeclined: { backgroundColor: 'rgba(186,26,26,0.12)' },
  statusText: { fontSize: 10, fontWeight: '700', color: Colors.onSurfaceVariant, textTransform: 'capitalize' },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyTitle: { ...Typography.headlineSm, color: Colors.onSurface, marginTop: Spacing.sm },
  emptyDesc: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, textAlign: 'center', marginTop: 4 },
});