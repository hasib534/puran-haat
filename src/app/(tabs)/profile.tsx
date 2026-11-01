import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../../constants/theme';
import { router } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { isFirebaseConfigured } from '../../lib/firebase';
import { VerificationBanner } from '../../components/auth/VerificationBanner';

export default function ProfileTab() {
  const { profile, ecoPoints, tradeCount, items, seedItems } = useApp();
  const { user, signOut } = useAuth();
  const favCount = items.filter((i) => i.is_favorite).length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Eco Impact</Text>
          <Text style={styles.headerSubtitle}>Your sustainability profile</Text>
        </View>

        <VerificationBanner />

        <View style={[styles.profileCard, Shadows.card]}>
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{profile.full_name}</Text>
            {profile.username ? <Text style={styles.username}>@{profile.username}</Text> : null}
            <Text style={styles.meta}>{profile.district} • {profile.is_verified ? 'Verified Trader' : 'Member'}</Text>
            {user ? <Text style={styles.username}>{user.email}</Text> : null}
            {profile.bio ? <Text style={styles.bio} numberOfLines={2}>{profile.bio}</Text> : null}
            <View style={styles.ratingRow}>
              <MaterialIcons name="star" size={14} color={Colors.star} />
              <Text style={styles.rating}>{profile.rating.toFixed(1)} rating</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, Shadows.card]}>
            <MaterialIcons name="eco" size={22} color={Colors.primary} />
            <Text style={styles.statValue}>{ecoPoints}</Text>
            <Text style={styles.statLabel}>Eco Points</Text>
          </View>
          <View style={[styles.statCard, Shadows.card]}>
            <MaterialIcons name="swap-horiz" size={22} color={Colors.primary} />
            <Text style={styles.statValue}>{tradeCount}</Text>
            <Text style={styles.statLabel}>Trades</Text>
          </View>
          <View style={[styles.statCard, Shadows.card]}>
            <MaterialIcons name="favorite" size={22} color={Colors.tertiary} />
            <Text style={styles.statValue}>{favCount}</Text>
            <Text style={styles.statLabel}>Saved</Text>
          </View>
        </View>

        <View style={[styles.impactCard, Shadows.card]}>
          <Text style={styles.impactTitle}>Community Haat Impact</Text>
          <Text style={styles.impactDesc}>
            🌱 You helped divert ~{Math.round(ecoPoints / 10)} kg of CO₂ from landfills by trading instead of buying new.
          </Text>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${Math.min(100, ecoPoints / 10)}%` }]} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          {[
            { icon: 'person', label: 'Edit Profile', route: '/edit-profile' },
            { icon: 'notifications', label: 'Notifications', route: '/notifications' },
            { icon: 'shield', label: 'Trust & Safety', route: '/trust-safety' },
            { icon: 'help-outline', label: 'Help & Support', route: '/help' },
            { icon: user ? 'logout' : 'login', label: user ? 'Sign Out' : 'Sign In', route: user ? null : '/auth' },
          ].map((a) => (
            <TouchableOpacity
              key={a.label}
              style={styles.menuRow}
              onPress={() => {
                if (a.route) router.push(a.route as any);
                else signOut();
              }}
              activeOpacity={0.8}
            >
              <MaterialIcons name={a.icon as any} size={20} color={Colors.primary} />
              <Text style={styles.menuLabel}>{a.label}</Text>
              <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
            </TouchableOpacity>
          ))}
        </View>

        {__DEV__ && isFirebaseConfigured && user && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.seedButton}
              onPress={async () => {
                try {
                  await seedItems();
                  Alert.alert('Done', 'Sample items seeded to Firebase.');
                } catch (error) {
                  Alert.alert('Could not seed data', (error as Error).message);
                }
              }}
            >
              <MaterialIcons name="cloud-upload" size={20} color={Colors.onPrimary} />
              <Text style={styles.seedText}>Seed Sample Data to Firebase</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: Spacing.margin, paddingBottom: 90 },
  header: { paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  headerTitle: { ...Typography.headlineMd, color: Colors.primary },
  headerSubtitle: { ...Typography.bodySm, color: Colors.primaryContainer, fontWeight: '600' },
  profileCard: { flexDirection: 'row', gap: 12, backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.md, borderRadius: BorderRadius.lg, marginTop: Spacing.md, borderWidth: 1, borderColor: 'rgba(21,66,18,0.05)' },
  avatar: { width: 64, height: 64, borderRadius: BorderRadius.full },
  profileInfo: { flex: 1, justifyContent: 'center' },
  name: { ...Typography.headlineSm, color: Colors.onSurface },
  username: { ...Typography.bodySm, color: Colors.primary, marginTop: 2, fontWeight: '600' },
  bio: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 4, lineHeight: 18 },
  meta: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  rating: { ...Typography.bodySm, color: Colors.onSurfaceVariant },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: Spacing.md },
  statCard: { flex: 1, backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.sm, borderRadius: BorderRadius.lg, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(21,66,18,0.05)' },
  statValue: { ...Typography.headlineSm, color: Colors.primary, marginTop: 4 },
  statLabel: { ...Typography.labelSm, color: Colors.onSurfaceVariant, marginTop: 2 },
  impactCard: { backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.md, borderRadius: BorderRadius.lg, marginTop: Spacing.md, borderWidth: 1, borderColor: 'rgba(21,66,18,0.05)' },
  impactTitle: { ...Typography.labelLg, color: Colors.primary },
  impactDesc: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 4, lineHeight: 18 },
  barBg: { height: 8, backgroundColor: Colors.secondaryContainer, borderRadius: BorderRadius.full, marginTop: Spacing.sm, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: BorderRadius.full },
  section: { marginTop: Spacing.lg },
  sectionTitle: { ...Typography.labelLg, color: Colors.onSurface, marginBottom: Spacing.xs },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(21,66,18,0.05)' },
  menuLabel: { ...Typography.bodyMd, color: Colors.onSurface, flex: 1 },
  seedButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: BorderRadius.full },
  seedText: { ...Typography.labelLg, color: Colors.onPrimary, fontWeight: '700' },
});