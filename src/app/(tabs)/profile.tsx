import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../../constants/theme';
import { MOCK_CATEGORIES } from '../../data/mock-items';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { isFirebaseConfigured } from '../../lib/firebase';
import { showAlert } from '../../lib/alert';
import { buildNotifications, unreadNotificationCount } from '../../lib/notifications';
import { TopHeader } from '../../components/layout/TopHeader';
import { VerificationBanner } from '../../components/auth/VerificationBanner';

const CATEGORY_BY_ID = new Map(MOCK_CATEGORIES.map((category) => [category.id, category]));

export default function ProfileTab() {
  const { profile, ecoPoints, tradeCount, items, seedItems, proposals, conversations } = useApp();
  const { user, signOut, resetPassword, isGuest } = useAuth();
  const [showEcoImpact, setShowEcoImpact] = useState(true);

  const favCount = items.filter((i) => i.is_favorite).length;
  const myItems = items.filter((item) =>
    isFirebaseConfigured ? Boolean(user && item.user_id === user.uid) : item.user_id === 'me',
  );
  const myListingCount = myItems.length;
  const unreadNotifications = useMemo(
    () => unreadNotificationCount(buildNotifications({ uid: user?.uid, proposals, conversations })),
    [conversations, proposals, user?.uid],
  );

  const interestCategories = useMemo(() => {
    const ids = new Set([
      ...myItems.map((item) => item.category_id),
      ...items.filter((item) => item.is_favorite).map((item) => item.category_id),
    ]);
    return [...ids]
      .map((id) => CATEGORY_BY_ID.get(id))
      .filter((category): category is NonNullable<typeof category> => Boolean(category))
      .slice(0, 4);
  }, [items, myItems]);

  const handleChangePassword = () => {
    if (!user?.email) {
      showAlert('Sign in required', 'Sign in to change your password.');
      return;
    }
    showAlert('Change password', `We will email a reset link to ${user.email}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send link',
        onPress: () => {
          resetPassword(user.email!)
            .then(() => showAlert('Reset link sent', `Check ${user.email} for the link.`))
            .catch((error: Error) =>
              showAlert('Could not send reset link', error.message),
            );
        },
      },
    ]);
  };

  const handleSignOut = () => {
    showAlert('Sign out?', 'You can sign back in anytime to keep trading.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <TopHeader
        districtName={profile.district || undefined}
        avatarUrl={profile.avatar_url}
        onPressLocation={() => router.push('/edit-profile' as never)}
        onPressProfile={() => router.push('/edit-profile' as never)}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Profile Settings</Text>
          <Text style={styles.pageSubtitle}>
            Manage your account details and Puran Haat preferences.
          </Text>
        </View>

        <VerificationBanner />

        {isGuest ? (
          <View style={[styles.card, styles.guestCard, Shadows.card]}>
            <View style={styles.guestRow}>
              <View style={styles.guestIcon}>
                <MaterialIcons name="person-add" size={22} color={Colors.primary} />
              </View>
              <View style={styles.guestBody}>
                <Text style={styles.guestTitle}>You&apos;re browsing as a guest</Text>
                <Text style={styles.guestText}>
                  Create a free account to post items, send trade proposals, and keep your chats for
                  good.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.guestButton}
              onPress={() => router.push('/auth' as never)}
              activeOpacity={0.88}
            >
              <MaterialIcons name="person-add" size={18} color={Colors.onPrimary} />
              <Text style={styles.guestButtonText}>Create account</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Account information */}
        <View style={[styles.card, Shadows.card]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="account-circle" size={20} color={Colors.primary} />
              <Text style={styles.cardTitle}>Account Information</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/edit-profile' as never)}
              accessibilityRole="button"
            >
              <Text style={styles.cardAction}>EDIT</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.identityRow}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <MaterialIcons name="person" size={30} color={Colors.primary} />
              </View>
            )}
            <View style={styles.identityBody}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{profile.full_name}</Text>
                {profile.is_verified && (
                  <MaterialIcons name="verified" size={16} color={Colors.primary} />
                )}
                {isGuest ? (
                  <View style={styles.guestChip}>
                    <Text style={styles.guestChipText}>Guest</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.identityMeta}>
                {profile.username ? `@${profile.username}` : 'Community trader'}
                {profile.district ? ` • ${profile.district}` : ''}
              </Text>
              {profile.bio ? (
                <Text style={styles.bio} numberOfLines={2}>
                  {profile.bio}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.fieldGrid}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <View style={styles.fieldValue}>
                <Text style={styles.fieldText} numberOfLines={1}>
                  {profile.full_name}
                </Text>
              </View>
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Username</Text>
              <View style={styles.fieldValue}>
                <Text style={styles.fieldText} numberOfLines={1}>
                  {profile.username ? `@${profile.username}` : 'Not set'}
                </Text>
              </View>
            </View>
          </View>
          <Text style={styles.fieldLabel}>Email Address</Text>
          <View style={styles.fieldValue}>
            <Text style={styles.fieldText} numberOfLines={1}>
              {user?.email || (isGuest ? 'Guest account — no email yet' : 'Sign in to add an email')}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <MaterialIcons name="eco" size={18} color={Colors.primary} />
              <Text style={styles.statValue}>{ecoPoints}</Text>
              <Text style={styles.statLabel}>Eco Points</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <MaterialIcons name="swap-horiz" size={18} color={Colors.primary} />
              <Text style={styles.statValue}>{tradeCount}</Text>
              <Text style={styles.statLabel}>Trades</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <MaterialIcons name="favorite" size={18} color={Colors.tertiary} />
              <Text style={styles.statValue}>{favCount}</Text>
              <Text style={styles.statLabel}>Saved</Text>
            </View>
          </View>
        </View>

        {/* Verification */}
        <View style={[styles.card, Shadows.card]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="verified-user" size={20} color={Colors.primary} />
              <Text style={styles.cardTitle}>Verification</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/verification' as never)}
            accessibilityRole="button"
          >
            <View style={styles.settingBody}>
              <Text style={styles.settingTitle}>
                {profile.is_verified ? 'Verified trader' : 'Get verified'}
              </Text>
              <Text style={styles.settingSubtitle}>
                {profile.is_verified
                  ? 'Your identity review was approved'
                  : 'Send an identity document for review'}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
          </TouchableOpacity>
        </View>

        {/* Sustainability */}
        <View style={[styles.card, Shadows.card]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="eco" size={20} color={Colors.primary} />
              <Text style={styles.cardTitle}>Sustainability</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Interested Categories</Text>
          <View style={styles.chipRow}>
            {interestCategories.length > 0 ? (
              interestCategories.map((category) => (
                <View key={category.id} style={styles.interestChip}>
                  <MaterialIcons name={category.icon as never} size={14} color={Colors.primary} />
                  <Text style={styles.interestText}>{category.name}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.helperText}>Save or post items to build your interests.</Text>
            )}
            <TouchableOpacity
              style={styles.addChip}
              onPress={() => router.push('/(tabs)/search' as never)}
              accessibilityRole="button"
            >
              <MaterialIcons name="add" size={15} color={Colors.primary} />
              <Text style={styles.addChipText}>Add</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleBody}>
              <Text style={styles.toggleTitle}>Eco-Impact Visibility</Text>
              <Text style={styles.toggleSubtitle}>Show carbon saved and points on this profile</Text>
            </View>
            <Switch
              value={showEcoImpact}
              onValueChange={setShowEcoImpact}
              trackColor={{ false: Colors.surfaceContainerHighest, true: Colors.primaryFixedDim }}
              thumbColor={showEcoImpact ? Colors.primary : Colors.surfaceContainerLowest}
              ios_backgroundColor={Colors.surfaceContainerHighest}
            />
          </View>

          {showEcoImpact ? (
            <View style={styles.impactCard}>
              <Text style={styles.impactTitle}>Community Haat Impact</Text>
              <Text style={styles.impactDesc}>
                You helped divert ~{Math.round(ecoPoints / 10)} kg of CO₂ from landfills by
                trading instead of buying new.
              </Text>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${Math.min(100, ecoPoints / 10)}%` }]} />
              </View>
            </View>
          ) : null}
        </View>

        {/* Notifications */}
        <View style={[styles.card, Shadows.card]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="notifications" size={20} color={Colors.primary} />
              <Text style={styles.cardTitle}>Notifications</Text>
            </View>
            {unreadNotifications > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{unreadNotifications}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/notifications' as never)}
            accessibilityRole="button"
          >
            <View style={styles.settingBody}>
              <Text style={styles.settingTitle}>New Trades & Proposals</Text>
              <Text style={styles.settingSubtitle}>Offers waiting for your response</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/(tabs)/messages' as never)}
            accessibilityRole="button"
          >
            <View style={styles.settingBody}>
              <Text style={styles.settingTitle}>Messages</Text>
              <Text style={styles.settingSubtitle}>Chats about your barter exchanges</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
          </TouchableOpacity>
        </View>

        {/* Security */}
        <View style={[styles.card, Shadows.card]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="security" size={20} color={Colors.primary} />
              <Text style={styles.cardTitle}>Security</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={handleChangePassword}
            accessibilityRole="button"
          >
            <View style={styles.settingBody}>
              <Text style={styles.settingTitle}>Change Password</Text>
              <Text style={styles.settingSubtitle}>We will email you a secure reset link</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/trust-safety' as never)}
            accessibilityRole="button"
          >
            <View style={styles.settingBody}>
              <Text style={styles.settingTitle}>Trust & Safety</Text>
              <Text style={styles.settingSubtitle}>Community rules and reporting</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
          </TouchableOpacity>
        </View>

        {/* Account links */}
        <View style={[styles.card, Shadows.card]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="tune" size={20} color={Colors.primary} />
              <Text style={styles.cardTitle}>Haat Account</Text>
            </View>
          </View>

          {[
            {
              icon: 'inventory-2',
              label: `My Listings (${myListingCount})`,
              subtitle: 'Manage items you have posted',
              route: '/my-listings',
            },
            {
              icon: 'person-outline',
              label: 'Edit Profile',
              subtitle: 'Photo, bio, and trader details',
              route: '/edit-profile',
            },
            {
              icon: 'help-outline',
              label: 'Help Center',
              subtitle: 'Get support from the Haat team',
              route: '/help',
            },
          ].map((row) => (
            <TouchableOpacity
              key={row.label}
              style={styles.settingRow}
              onPress={() => router.push(row.route as never)}
              accessibilityRole="button"
            >
              <View style={styles.rowIcon}>
                <MaterialIcons name={row.icon as never} size={18} color={Colors.primary} />
              </View>
              <View style={styles.settingBody}>
                <Text style={styles.settingTitle}>{row.label}</Text>
                <Text style={styles.settingSubtitle}>{row.subtitle}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={isGuest ? () => router.push('/auth' as never) : handleSignOut}
          activeOpacity={0.85}
        >
          <MaterialIcons
            name={isGuest ? 'person-add' : 'logout'}
            size={20}
            color={Colors.tertiary}
          />
          <Text style={styles.logoutText}>{isGuest ? 'Create an account' : 'Logout'}</Text>
        </TouchableOpacity>

        {__DEV__ && isFirebaseConfigured && user && !isGuest && (
          <TouchableOpacity
            style={styles.seedButton}
            onPress={async () => {
              try {
                await seedItems();
                showAlert('Done', 'Sample items seeded to Firebase.');
              } catch (error) {
                showAlert('Could not seed data', (error as Error).message);
              }
            }}
          >
            <MaterialIcons name="cloud-upload" size={20} color={Colors.onPrimary} />
            <Text style={styles.seedText}>Seed Sample Data to Firebase</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: Spacing.margin, paddingBottom: 110 },
  pageHeader: { paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
  pageTitle: { ...Typography.headlineMd, color: Colors.primary, fontWeight: '700' },
  pageSubtitle: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, marginTop: 2 },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(21, 66, 18, 0.06)',
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { ...Typography.labelLg, color: Colors.primary, fontWeight: '700' },
  cardAction: { ...Typography.labelSm, color: Colors.tertiary, fontWeight: '700' },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.md,
  },
  avatar: { width: 62, height: 62, borderRadius: BorderRadius.full },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(21, 66, 18, 0.08)',
  },
  identityBody: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { ...Typography.headlineSm, color: Colors.onSurface, fontWeight: '700' },
  identityMeta: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 1 },
  bio: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 4, lineHeight: 17 },
  fieldGrid: { flexDirection: 'row', gap: 10 },
  fieldHalf: { flex: 1 },
  fieldLabel: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
    marginBottom: 5,
    fontWeight: '700',
  },
  fieldValue: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    marginBottom: Spacing.sm,
  },
  fieldText: { ...Typography.bodyMd, color: Colors.onSurface },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 230, 218, 0.55)',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.xs,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 1 },
  statValue: { ...Typography.labelLg, color: Colors.primary, fontWeight: '700' },
  statLabel: { ...Typography.labelSm, color: Colors.onSurfaceVariant, fontSize: 9 },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(21, 66, 18, 0.1)' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: Spacing.sm },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.secondaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  interestText: { ...Typography.labelSm, color: Colors.onSecondaryContainer },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  addChipText: { ...Typography.labelSm, color: Colors.primary, fontWeight: '700' },
  helperText: { ...Typography.bodySm, color: Colors.onSurfaceVariant },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: Spacing.xs,
  },
  toggleBody: { flex: 1 },
  toggleTitle: { ...Typography.bodyMd, color: Colors.onSurface, fontWeight: '600' },
  toggleSubtitle: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 1 },
  impactCard: {
    backgroundColor: 'rgba(45, 90, 39, 0.06)',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  impactTitle: { ...Typography.labelMd, color: Colors.primary, fontWeight: '700' },
  impactDesc: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 2, lineHeight: 17 },
  barBg: {
    height: 7,
    backgroundColor: Colors.secondaryContainer,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xs,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: BorderRadius.full },
  countBadge: {
    backgroundColor: Colors.tertiary,
    borderRadius: BorderRadius.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countBadgeText: { color: Colors.onTertiary, fontSize: 10, fontWeight: '700' },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(21, 66, 18, 0.05)',
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(45, 90, 39, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingBody: { flex: 1 },
  settingTitle: { ...Typography.bodyMd, color: Colors.onSurface, fontWeight: '600' },
  settingSubtitle: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 1, fontSize: 11 },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(106, 33, 13, 0.3)',
    backgroundColor: 'rgba(106, 33, 13, 0.05)',
    marginTop: Spacing.xs,
  },
  logoutText: { ...Typography.labelLg, color: Colors.tertiary, fontWeight: '700' },
  seedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  seedText: { ...Typography.labelLg, color: Colors.onPrimary, fontWeight: '700' },
  guestCard: {
    borderWidth: 1,
    borderColor: 'rgba(45, 90, 39, 0.16)',
    // Opaque on purpose: a translucent fill lets Android's elevation shadow
    // bleed through the card and paint a muddy second layer inside it.
    backgroundColor: Colors.secondaryContainer,
  },
  guestRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  guestIcon: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(45, 90, 39, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestBody: { flex: 1 },
  guestTitle: { ...Typography.bodyMd, color: Colors.onSurface, fontWeight: '700' },
  guestText: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 2, lineHeight: 18 },
  guestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  guestButtonText: { ...Typography.labelLg, color: Colors.onPrimary, fontWeight: '700' },
  guestChip: {
    backgroundColor: Colors.secondaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  guestChipText: { ...Typography.labelSm, color: Colors.onSecondaryContainer, fontWeight: '700' },
});
