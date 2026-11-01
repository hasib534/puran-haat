import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { Colors } from '../constants/colors';
import { Typography, BorderRadius, Spacing } from '../constants/theme';

const SECTIONS = [
  { title: 'Verified Traders', body: 'Look for the verified badge. Verified traders have completed identity checks and have a strong trade history.' },
  { title: 'Safe Meetups', body: 'Always meet in public places like Dhanmondi Lake, TSC, or community centers. Bring a friend if possible.' },
  { title: 'Inspect Before Swap', body: 'Check item condition thoroughly before exchanging. Cash adjustments should be settled on the spot.' },
  { title: 'Report Issues', body: 'Use the report option in chat to flag suspicious activity. Our team reviews all reports within 24 hours.' },
  { title: 'Eco Points & Trust', body: 'Earn Eco Points by completing trades. Higher points unlock trust badges and priority listing.' },
];

export default function TrustSafetyScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trust & Safety</Text>
        <View style={{ width: 38 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.card}>
            <Text style={styles.cardTitle}>{s.title}</Text>
            <Text style={styles.cardBody}>{s.body}</Text>
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
  card: { backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: 'rgba(21,66,18,0.05)' },
  cardTitle: { ...Typography.labelLg, color: Colors.primary, marginBottom: 4 },
  cardBody: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, lineHeight: 20 },
});