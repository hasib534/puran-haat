import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { Colors } from '../../constants/colors';
import { BorderRadius, Spacing, Typography } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

export function VerificationBanner() {
  const { user, resendVerification, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!user || user.emailVerified) return null;

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
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.banner}>
      <MaterialIcons name="mark-email-unread" size={22} color={Colors.tertiary} />
      <View style={styles.body}>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.text}>Verify {user.email} to unlock posting and trading.</Text>
        <View style={styles.actions}>
          <TouchableOpacity onPress={handleResend} disabled={busy} style={styles.action}>
            {busy ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Text style={styles.actionText}>Resend email</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRefresh} disabled={busy} style={styles.action}>
            <Text style={styles.actionText}>I&apos;ve verified</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(106, 33, 13, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(106, 33, 13, 0.18)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginHorizontal: Spacing.margin,
    marginBottom: Spacing.md,
  },
  body: { flex: 1 },
  title: { ...Typography.labelMd, color: Colors.tertiary, fontWeight: '700' },
  text: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  action: { paddingVertical: 2 },
  actionText: { ...Typography.labelSm, color: Colors.primary, fontWeight: '700' },
});
