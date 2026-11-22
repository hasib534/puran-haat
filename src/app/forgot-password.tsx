import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';

import { Colors } from '../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { showAlert } from '../lib/alert';

/**
 * Password reset request.
 *
 * The designs show a three-step code flow (email → enter code → new password),
 * but Firebase Auth can only email a signed reset *link* — it does not expose
 * reset codes — and the design's own first screen promises exactly that link.
 * So this screen sends the link and confirms it, instead of showing a code
 * field that could never verify.
 */
export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { resetPassword, configured } = useAuth();

  const [email, setEmail] = useState(params.email ?? '');
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const send = async () => {
    const address = email.trim();

    if (!address) {
      showAlert('Enter your email', 'Type the email address linked to your Puran Haat account.');
      return;
    }
    if (!address.includes('@') || address.startsWith('@') || address.endsWith('@')) {
      showAlert('Check your email', 'That address does not look complete.');
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(address);
      setSentTo(address);
    } catch (error) {
      showAlert('Could not send reset email', (error as Error)?.message || 'Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          >
            <MaterialIcons name="arrow-back" size={23} color={Colors.primary} />
          </TouchableOpacity>

          <Text style={styles.brandTitle}>Puran Haat</Text>

          <View style={styles.iconButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {sentTo ? (
            <>
              <View style={styles.iconWrap}>
                <MaterialIcons name="mark-email-read" size={38} color={Colors.primary} />
              </View>

              <Text style={styles.title}>Check your inbox</Text>
              <Text style={styles.description}>
                We sent a password reset link to{' '}
                <Text style={styles.descriptionStrong}>{sentTo}</Text>. Open it on this device to
                choose a new password.
              </Text>

              <View style={[styles.noteCard, Shadows.card]}>
                <MaterialIcons name="info-outline" size={18} color={Colors.onSurfaceVariant} />
                <Text style={styles.noteText}>
                  The link expires after one hour. If it does not arrive, check spam or resend it
                  below.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, submitting && styles.primaryDisabled]}
                onPress={send}
                disabled={submitting}
                activeOpacity={0.88}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.onPrimary} />
                ) : (
                  <>
                    <Text style={styles.primaryText}>Resend Link</Text>
                    <MaterialIcons name="forward-to-inbox" size={19} color={Colors.onPrimary} />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                <Text style={styles.switchText}>
                  Back to <Text style={styles.switchLink}>log in</Text>
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.iconWrap}>
                <MaterialIcons name="lock-reset" size={40} color={Colors.primary} />
              </View>

              <Text style={styles.title}>Forgot Password?</Text>
              <Text style={styles.description}>
                Enter the email address associated with your Puran Haat account, and we&apos;ll send
                you a link to reset your password.
              </Text>

              <Text style={styles.label}>Email Address</Text>
              <View style={[styles.inputShell, focused && styles.inputShellFocused]}>
                <MaterialIcons name="mail-outline" size={20} color={Colors.onSurfaceVariant} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.outline}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="send"
                  onSubmitEditing={send}
                  editable={!submitting}
                />
              </View>

              {!configured && (
                <Text style={styles.warning}>
                  Sign-in is not configured in this build, so reset emails cannot be sent.
                </Text>
              )}

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (submitting || !configured) && styles.primaryDisabled,
                ]}
                onPress={send}
                disabled={submitting || !configured}
                activeOpacity={0.88}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.onPrimary} />
                ) : (
                  <>
                    <Text style={styles.primaryText}>Send Reset Link</Text>
                    <MaterialIcons name="arrow-forward" size={19} color={Colors.onPrimary} />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                <Text style={styles.switchText}>
                  Remember your password? <Text style={styles.switchLink}>Log in here</Text>
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    flex: 1,
    textAlign: 'center',
    ...Typography.headlineSm,
    color: Colors.primary,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.displayLg,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  description: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  descriptionStrong: {
    color: Colors.onSurface,
    fontWeight: '700',
  },
  label: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    marginBottom: 6,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(21, 66, 18, 0.12)',
    paddingHorizontal: Spacing.md,
    height: 54,
  },
  inputShellFocused: {
    borderColor: Colors.primary,
  },
  input: {
    flex: 1,
    ...Typography.bodyLg,
    color: Colors.onSurface,
    paddingVertical: 0,
  },
  warning: {
    ...Typography.bodySm,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: 16,
    marginTop: Spacing.lg,
  },
  primaryDisabled: {
    opacity: 0.65,
  },
  primaryText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
    fontWeight: '700',
  },
  switchText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  switchLink: {
    color: Colors.primary,
    fontWeight: '700',
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  noteText: {
    flex: 1,
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
  },
});