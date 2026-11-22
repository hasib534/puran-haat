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
  unreadNotificationCount,
  type AppNotification,
} from '../lib/notifications';

const ICON_TINT: Record<
  AppNotification['kind'],
  { background: string; color: string }
> = {
  proposal: { background: 'rgba(217, 230, 218, 0.9)', color: Colors.primary },
  trade: { background: 'rgba(217, 230, 218, 0.9)', color: Colors.primary },
  message: { background: 'rgba(106, 33, 13, 0.1)', color: Colors.tertiary },
};

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
  const unreadCount = useMemo(() => unreadNotificationCount(notifications), [notifications]);

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
          style={styles.iconButton}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={23} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Activity</Text>
          <Text style={styles.headerSubtitle}>
            {unreadCount > 0
              ? `${unreadCount} ${unreadCount === 1 ? 'update needs' : 'updates need'} your attention`
              : 'Proposals, trades, and messages'}
          </Text>
        </View>
        {unreadCount > 0 ? (
          <View style={styles.unreadPill}>
            <Text style={styles.unreadPillText}>{unreadCount} new</Text>
          </View>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          notifications.length > 0 ? (
            <Text style={styles.sectionLabel}>Recent activity</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <MaterialIcons name="notifications-none" size={40} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>You&apos;re all caught up</Text>
            <Text style={styles.emptyText}>
              When someone sends a proposal, replies to a trade, or accepts an offer, it will
              show up here.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const tint = ICON_TINT[item.kind];
          const tappable = Boolean(item.conversationId);
          return (
            <TouchableOpacity
              activeOpacity={tappable ? 0.8 : 1}
              onPress={() => openNotification(item)}
              disabled={!tappable}
              style={[styles.row, Shadows.card, item.unread && styles.rowUnread]}
              accessibilityRole={tappable ? 'button' : undefined}
              accessibilityLabel={item.title}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: item.icon === 'cancel' ? Colors.errorContainer : tint.background },
                ]}
              >
                <MaterialIcons
                  name={item.icon}
                  size={20}
                  color={item.icon === 'cancel' ? Colors.error : tint.color}
                />
              </View>

              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={[styles.title, item.unread && styles.titleUnread]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.time}>{relativeTime(item.createdAt)}</Text>
                </View>
                <Text style={styles.body} numberOfLines={2}>
                  {item.body}
                </Text>
              </View>

              {tappable && (
                <MaterialIcons name="chevron-right" size={18} color={Colors.outline} />
              )}
              {item.unread && !tappable && <View style={styles.dot} />}
            </TouchableOpacity>
          );
        }}
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
  headerSubtitle: { ...Typography.bodySm, color: Colors.onSurfaceVariant, fontSize: 11 },
  headerSpacer: { width: 38 },
  unreadPill: {
    backgroundColor: Colors.tertiary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  unreadPillText: { ...Typography.labelSm, color: Colors.onTertiary, fontWeight: '700', fontSize: 10 },
  scrollContent: {
    paddingHorizontal: Spacing.margin,
    paddingBottom: 24,
    gap: 10,
    paddingTop: Spacing.sm,
    flexGrow: 1,
  },
  sectionLabel: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(21,66,18,0.05)',
  },
  rowUnread: { borderColor: 'rgba(21, 66, 18, 0.22)', backgroundColor: Colors.surface },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { ...Typography.labelLg, color: Colors.onSurface, flex: 1 },
  titleUnread: { fontWeight: '700', color: Colors.primary },
  time: { ...Typography.bodySm, color: Colors.outline, fontSize: 10 },
  body: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 2, lineHeight: 18 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.tertiary,
    alignSelf: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 8,
    paddingHorizontal: Spacing.md,
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
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
});