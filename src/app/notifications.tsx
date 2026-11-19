import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { Colors } from '../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { AuthGate } from '../components/auth/AuthGate';
import {
  buildNotifications,
  relativeTime,
  type AppNotification,
} from '../lib/notifications';

export default function NotificationsScreen() {
  return (
    <AuthGate
      title="Sign in to see notifications"
      description="Proposal updates and new messages from your barter trades appear here."
    >
      <NotificationsView />
    </AuthGate>
  );
}

function NotificationsView() {
  const { proposals, conversations } = useApp();
  const { user } = useAuth();

  const notifications = useMemo(
    () => buildNotifications({ uid: user?.uid, proposals, conversations }),
    [conversations, proposals, user?.uid],
  );

  const openNotification = (notification: AppNotification) => {
    if (!notification.conversationId) return;
    router.push({
      pathname: '/chat/[id]',
      params: { id: notification.conversationId },
    } as never);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="notifications-none" size={48} color={Colors.outline} />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyText}>
              When someone sends a proposal, replies to a trade, or accepts an offer, it will
              show up here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={item.conversationId ? 0.8 : 1}
            onPress={() => openNotification(item)}
            style={[styles.row, Shadows.card, item.unread && styles.rowUnread]}
          >
            <View style={styles.iconCircle}>
              <MaterialIcons
                name={item.icon}
                size={20}
                color={item.icon === 'cancel' ? Colors.error : Colors.primary}
              />
            </View>
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.time}>{relativeTime(item.createdAt)}</Text>
              </View>
              <Text style={styles.body} numberOfLines={2}>
                {item.body}
              </Text>
            </View>
            {item.unread && <View style={styles.dot} />}
          </TouchableOpacity>
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.margin,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(21,66,18,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...Typography.headlineSm, color: Colors.primary, fontWeight: '700' },
  headerSpacer: { width: 38 },
  scrollContent: {
    paddingHorizontal: Spacing.margin,
    paddingBottom: 20,
    gap: 10,
    paddingTop: Spacing.sm,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(21,66,18,0.05)',
  },
  rowUnread: { borderColor: Colors.primaryFixed },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(45,90,39,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { ...Typography.labelLg, color: Colors.onSurface, flex: 1 },
  time: { ...Typography.bodySm, color: Colors.outline, fontSize: 10 },
  body: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 2, lineHeight: 18 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.tertiary,
    alignSelf: 'center',
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { ...Typography.headlineSm, color: Colors.onSurface },
  emptyText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
});
