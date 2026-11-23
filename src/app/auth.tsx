import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';

import { showAlert } from '../lib/alert';
import { Colors } from '../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { GoogleSignInUnavailableError, signInWithGoogleNative } from '../lib/google-signin';

type AuthMode = 'signin' | 'signup';

export default function AuthScreen() {
  const { signIn, signUp, signInWithGoogle, signInWithGooglePopup, configured } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const isSignup = mode === 'signup';

  const handleGooglePress = async () => {
    if (Platform.OS === 'web') {
      setSubmitting(true);
      try {
        await signInWithGooglePopup();
        leaveAuth();
      } catch (e) {
        showAlert('Google sign-in failed', (e as Error)?.message || 'Unknown error');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      const idToken = await signInWithGoogleNative(webClientId);
      if (!idToken) return;
      await signInWithGoogle(idToken);
      leaveAuth();
    } catch (e) {
      const message =
        e instanceof GoogleSignInUnavailableError
          ? (e as Error).message
          : (e as Error)?.message || 'Unknown error';
      showAlert('Google sign-in failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplePress = () => {
    showAlert('Apple Sign-In', 'Apple Sign-In is not available yet. Use email or Google to continue.');
  };

  const handleSubmit = async () => {
    if (isSignup) {
      if (fullName.trim().length < 2) {
        showAlert('Missing name', 'Enter your full name so neighbors know who they are trading with.');
        return;
      }
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
        showAlert('Choose a username', 'Use 3-20 letters, numbers, or underscores.');
        return;
      }
      if (password !== confirmPassword) {
        showAlert('Passwords do not match', 'Re-enter the same password in both fields.');
        return;
      }
    }
    if (!email.trim() || !password.trim()) {
      showAlert('Missing fields', 'Please enter email and password.');
      return;
    }
    if (isSignup && password.length < 6) {
      showAlert('Weak password', 'Use at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
        leaveAuth();
      } else {
        await signUp(email.trim(), password, fullName.trim(), username.trim());
        showAlert(
          'Verify your email',
          `Your account is ready. We sent a verification link to ${email.trim()}. Verify it to start posting and trading.`,
          [{ text: 'OK', onPress: leaveAuth }],
        );
      }
    } catch (e) {
      showAlert('Auth error', (e as Error)?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    router.push({
      pathname: '/forgot-password',
      params: email.trim() ? { email: email.trim() } : {},
    } as never);
  };

  /**
   * Leaves the auth screen. When auth was opened from inside the app (Profile,
   * a gated action, ...) we simply return to it. When it is the entry screen —
   * e.g. right after onboarding, where there is nothing behind it — we send the
   * user to the home feed instead of trapping them on a blank back stack.
   */
  const leaveAuth = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/' as never);
    }
  };

  const googleUnavailable =
    !configured || (Platform.OS !== 'web' && !webClientId) || submitting;

  const inputStyle = (key: string) => [styles.inputShell, focusedField === key && styles.inputShellFocused];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.backdropTop} />
      <View style={styles.backdropBottom} />

      <TouchableOpacity style={styles.closeButton} onPress={leaveAuth} accessibilityLabel="Close">
        <MaterialIcons name="close" size={22} color={Colors.primary} />
      </TouchableOpacity>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.brandBlock}>
              <View style={styles.brandMark}>
                <MaterialIcons name="sync-alt" size={26} color={Colors.onPrimary} />
              </View>
              <Text style={styles.brandTitle}>Puran Haat</Text>
              <Text style={styles.brandSubtitle}>Connect, trade, and sustain.</Text>
            </View>

            <View style={styles.segment} accessibilityRole="tablist">
              {(['signin', 'signup'] as const).map((value) => {
                const active = mode === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[styles.segmentButton, active && styles.segmentButtonActive]}
                    onPress={() => setMode(value)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {value === 'signin' ? 'Login' : 'Sign Up'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {!configured && (
              <View style={styles.warning}>
                <MaterialIcons name="warning" size={20} color={Colors.tertiary} />
                <Text style={styles.warningText}>
                  Firebase is not configured. Set EXPO_PUBLIC_FIREBASE_API_KEY and
                  EXPO_PUBLIC_FIREBASE_PROJECT_ID in .env.local.
                </Text>
              </View>
            )}

            {isSignup && (
              <>
                <Text style={styles.label}>Full Name</Text>
                <View style={inputStyle('name')}>
                  <MaterialIcons name="person" size={20} color={Colors.outline} />
                  <TextInput
                    style={styles.input}
                    value={fullName}
                    onChangeText={setFullName}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Jane Doe"
                    placeholderTextColor="rgba(66, 73, 62, 0.5)"
                    autoCapitalize="words"
                    textContentType="name"
                  />
                </View>

                <Text style={styles.label}>Username</Text>
                <View style={inputStyle('username')}>
                  <MaterialIcons name="alternate-email" size={20} color={Colors.outline} />
                  <TextInput
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="janedoe"
                    placeholderTextColor="rgba(66, 73, 62, 0.5)"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </>
            )}

            <Text style={styles.label}>Email Address</Text>
            <View style={inputStyle('email')}>
              <MaterialIcons name="mail-outline" size={20} color={Colors.outline} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                placeholder="you@example.com"
                placeholderTextColor="rgba(66, 73, 62, 0.5)"
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
              />
            </View>

            <View style={styles.passwordLabelRow}>
              <Text style={styles.labelInline}>Password</Text>
              {!isSignup && (
                <TouchableOpacity onPress={handleForgotPassword}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={inputStyle('password')}>
              <MaterialIcons name="lock-outline" size={20} color={Colors.outline} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                placeholder="••••••••"
                placeholderTextColor="rgba(66, 73, 62, 0.5)"
                secureTextEntry={!showPassword}
                textContentType={isSignup ? 'newPassword' : 'password'}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((value) => !value)}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                hitSlop={8}
              >
                <MaterialIcons
                  name={showPassword ? 'visibility' : 'visibility-off'}
                  size={20}
                  color={Colors.outline}
                />
              </TouchableOpacity>
            </View>

            {isSignup && (
              <>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={inputStyle('confirm')}>
                  <MaterialIcons name="lock-reset" size={20} color={Colors.outline} />
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    onFocus={() => setFocusedField('confirm')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(66, 73, 62, 0.5)"
                    secureTextEntry={!showPassword}
                    textContentType="newPassword"
                  />
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={submitting || !configured}
              activeOpacity={0.88}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.onPrimary} />
              ) : (
                <Text style={styles.buttonText}>{isSignup ? 'Create Account' : 'Login'}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>Or continue with</Text>
              <View style={styles.divider} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity
                style={[styles.socialButton, googleUnavailable && styles.socialButtonDisabled]}
                onPress={handleGooglePress}
                disabled={googleUnavailable}
                activeOpacity={0.85}
              >
                <FontAwesome name="google" size={19} color="#4285F4" />
                <Text style={styles.socialText}>Google</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.socialButton, submitting && styles.socialButtonDisabled]}
                onPress={handleApplePress}
                disabled={submitting}
                activeOpacity={0.85}
              >
                <FontAwesome name="apple" size={21} color={Colors.onSurface} />
                <Text style={styles.socialText}>Apple</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  backdropTop: {
    position: 'absolute',
    top: -130,
    right: -90,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(45, 90, 39, 0.07)',
  },
  backdropBottom: {
    position: 'absolute',
    bottom: -140,
    left: -110,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(106, 33, 13, 0.05)',
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.margin,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(21, 66, 18, 0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.margin,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: 'rgba(253, 250, 231, 0.92)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.card,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  brandTitle: {
    ...Typography.headlineMd,
    color: Colors.primary,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  brandSubtitle: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.full,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  segmentText: {
    ...Typography.labelLg,
    color: Colors.onSurfaceVariant,
  },
  segmentTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  warning: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Colors.tertiaryFixed,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  warningText: { ...Typography.bodySm, color: Colors.tertiary, flex: 1 },
  label: {
    ...Typography.labelMd,
    color: Colors.onSurface,
    marginBottom: 6,
  },
  labelInline: {
    ...Typography.labelMd,
    color: Colors.onSurface,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    marginBottom: 6,
  },
  forgotText: {
    ...Typography.labelSm,
    color: Colors.primary,
    fontWeight: '700',
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(21, 66, 18, 0.12)',
    marginBottom: Spacing.sm,
  },
  inputShellFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    ...Typography.bodyMd,
    color: Colors.onSurface,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  divider: { flex: 1, height: 1, backgroundColor: Colors.outlineVariant },
  dividerText: { ...Typography.bodySm, color: Colors.outline },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.full,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  socialButtonDisabled: { opacity: 0.5 },
  socialText: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    fontWeight: '600',
  },
});
