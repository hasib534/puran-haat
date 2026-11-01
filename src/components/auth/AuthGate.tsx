import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { Colors } from '../../constants/colors';
import { BorderRadius, Spacing, Typography } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

interface AuthGateProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  requireVerified?: boolean;
}

export function AuthGate({
  children,
  title = 'Sign in to continue',
  description = 'Join the haat to post items, save favorites, and trade with your community.',
  requireVerified = false,
}: AuthGateProps) {
  const { user, loading, configured, resendVerification, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);

  // Demo mode: the app still works with mock data when Firebase is unset.
  if (!configured) return <>{children}</>;

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Checking your session…</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="lock-outline" size={34} color={Colors.primary} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/auth' as never)}
            activeOpacity={0.88}
          >
            <MaterialIcons name="login" size={20} color={Colors.onPrimary} />
            <Text style={styles.primaryButtonText}>Sign In / Create Account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (requireVerified && !user.emailVerified) {
    const handleResend = async () => {
      setBusy(true);
      try {
        await resendVerification();
        Alert.alert('Verification sent', `Check ${user.email} for the verification link.`);
      } catch (error) {
        Alert.alert('Could not send email', (error as Error).message);
      } finally {
        setBusy(false);
      }
    };

    const handleRefresh = async () => {
      setBusy(true);
      try {
        await refreshUser();
        Alert.alert('Still verifying?', 'If you already clicked the link, try again in a moment.');
      } finally {
        setBusy(false);
      }
    };

    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="mark-email-unread" size={34} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.description}>
            We sent a verification link to {user.email}. Verify your email to post items and start
            trading.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, busy && styles.disabled]}
            onPress={handleResend}
            disabled={busy}
            activeOpacity={0.88}
          >
            {busy ? (
              <ActivityIndicator color={Colors.onPrimary} />
            ) : (
              <>
                <MaterialIcons name="send" size={20} color={Colors.onPrimary} />
                <Text style={styles.primaryButtonText}>Resend verification email</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleRefresh} disabled={busy}>
            <Text style={styles.secondaryButtonText}>I&apos;ve verified — refresh</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.background,
  },
  loadingText: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  card: {
    margin: Spacing.margin,
    marginTop: Spacing.xxl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.08)',
    alignItems: 'center',
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(45, 90, 39, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 6,
    marginBottom: Spacing.lg,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: 14,
  },
  primaryButtonText: { ...Typography.labelLg, color: Colors.onPrimary, fontWeight: '700' },
  secondaryButton: { marginTop: Spacing.md, padding: 6 },
  secondaryButtonText: { ...Typography.bodySm, color: Colors.primary, fontWeight: '600' },
  disabled: { opacity: 0.7 },
});
