import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { Colors } from '../constants/colors';
import { Typography, BorderRadius, Spacing } from '../constants/theme';

const FAQS = [
  { q: 'How do I post an item?', a: 'Go to the Post tab, add photos and details, choose barter or free gift, then publish.' },
  { q: 'Is Puran Haat free to use?', a: 'Yes! Listing and trading items is completely free. No commissions.' },
  { q: 'How do Eco Points work?', a: 'You earn 50 Eco Points per completed trade. Points reflect your positive environmental impact.' },
  { q: 'Can I adjust with cash?', a: 'Yes, when proposing a barter you can add a cash adjustment (BDT) to balance value.' },
  { q: 'How do I report a user?', a: 'Open the chat, tap the menu icon, and select Report / Safety.' },
];

export default function HelpScreen() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 38 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>Frequently asked questions. Need more help? Email support@puranhaat.bd</Text>
        {FAQS.map((f, i) => (
          <TouchableOpacity
            key={i}
            style={styles.faq}
            onPress={() => setOpen(open === i ? null : i)}
            activeOpacity={0.8}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQ}>{f.q}</Text>
              <MaterialIcons name={open === i ? 'expand-less' : 'expand-more'} size={22} color={Colors.primary} />
            </View>
            {open === i && <Text style={styles.faqA}>{f.a}</Text>}
          </TouchableOpacity>
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
  intro: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, marginBottom: Spacing.sm },
  faq: { backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: 'rgba(21,66,18,0.05)' },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  faqQ: { ...Typography.labelLg, color: Colors.onSurface, flex: 1 },
  faqA: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, marginTop: Spacing.sm, lineHeight: 20 },
});