import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { Colors } from '../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../constants/theme';

const NOTIFICATIONS = [
  { id: '1', icon: 'handshake', title: 'Barter accepted', body: 'Tanvir accepted your swap proposal for Vintage Oak Chair.', time: '2h ago', unread: true },
  { id: '2', icon: 'eco', title: 'Eco milestone', body: 'You reached 340 Eco Points! Keep trading green.', time: '1d ago', unread: true },
  { id: '3', icon: 'inventory-2', title: 'New listing nearby', body: '2 new vintage books listed within 5 km.', time: '2d ago', unread: false },
  { id: '4', icon: 'star', title: 'Rating received', body: 'Sadia rated you 5 stars for the terracotta trade.', time: '3d ago', unread: false },
];

export default function NotificationsScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 38 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {NOTIFICATIONS.map((n) => (
          <View key={n.id} style={[styles.row, Shadows.card, n.unread && styles.rowUnread]}>
            <View style={styles.iconCircle}>
              <MaterialIcons name={n.icon as any} size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <Text style={styles.title}>{n.title}</Text>
                <Text style={styles.time}>{n.time}</Text>
              </View>
              <Text style={styles.body}>{n.body}</Text>
            </View>
            {n.unread && <View style={styles.dot} />}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.margin, paddingVertical: Spacing.sm, backgroundColor: Colors.surface },
  backButton: { width: 38, height: 38, borderRadius: BorderRadius.full, backgroundColor: 'rgba(21,66,18,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.headlineSm, color: Colors.primary, fontWeight: '700' },
  scrollContent: { paddingHorizontal: Spacing.margin, paddingBottom: 20, gap: 10, paddingTop: Spacing.sm },
  row: { flexDirection: 'row', gap: 12, backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.sm, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: 'rgba(21,66,18,0.05)' },
  rowUnread: { borderColor: Colors.primaryFixed },
  iconCircle: { width: 40, height: 40, borderRadius: BorderRadius.full, backgroundColor: 'rgba(45,90,39,0.1)', alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...Typography.labelLg, color: Colors.onSurface },
  time: { ...Typography.bodySm, color: Colors.outline, fontSize: 10 },
  body: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 2, lineHeight: 18 },
  dot: { width: 8, height: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.tertiary, alignSelf: 'center' },
});