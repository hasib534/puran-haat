import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { Colors } from '../constants/colors';
import { Typography, BorderRadius, Spacing } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const { signIn, signUp, signInWithGoogle, signInWithGooglePopup, resetPassword, configured } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    // The web client ID is the fallback. For the best native experience add
    // dedicated iOS/Android OAuth clients to .env.local as well.
    clientId: webClientId,
    webClientId,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  const handleGooglePress = async () => {
    // On web, use Firebase's popup flow. It goes through the Firebase auth
    // handler that is already registered as an authorized Google OAuth
    // redirect, so localhost and future production domains work without
    // editing the OAuth client for every origin.
    if (Platform.OS === 'web') {
      setSubmitting(true);
      try {
        await signInWithGooglePopup();
        router.back();
      } catch (e) {
        Alert.alert('Google sign-in failed', (e as Error)?.message || 'Unknown error');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    try {
      const result = await promptAsync();
      if (result.type === 'success') {
        const idToken = result.authentication?.idToken || result.params?.id_token;
        if (!idToken) {
          Alert.alert(
            'Google sign-in incomplete',
            'Google did not return an ID token. Check that the OAuth redirect URI for this app is authorized in Google Cloud Console.',
          );
          return;
        }
        setSubmitting(true);
        try {
          await signInWithGoogle(idToken);
          router.back();
        } catch (e) {
          Alert.alert('Google sign-in failed', (e as Error)?.message || 'Unknown error');
        } finally {
          setSubmitting(false);
        }
      } else if (result.type === 'error') {
        Alert.alert('Google sign-in error', result.error?.message || 'Unknown error');
      }
    } catch (e) {
      Alert.alert('Google sign-in error', (e as Error)?.message || 'Unknown error');
    }
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter email and password.');
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      Alert.alert('Weak password', 'Use at least 6 characters.');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
        router.back();
      } else {
        await signUp(email.trim(), password);
        Alert.alert(
          'Verify your email',
          `Your account is ready. We sent a verification link to ${email.trim()}. Verify it to start posting and trading.`,
          [{ text: 'OK', onPress: () => router.back() }],
        );
      }
    } catch (e) {
      Alert.alert('Auth error', (e as Error)?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Type your account email above, then tap Forgot password.');
      return;
    }
    try {
      await resetPassword(email.trim());
      Alert.alert('Reset link sent', `Check ${email.trim()} for a password reset link.`);
    } catch (e) {
      Alert.alert('Could not send reset email', (e as Error)?.message || 'Try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>
          <View style={{ width: 38 }} />
        </View>

        <View style={styles.body}>
          {!configured && (
            <View style={styles.warning}>
              <MaterialIcons name="warning" size={20} color={Colors.tertiary} />
              <Text style={styles.warningText}>
                Firebase is not configured. Set EXPO_PUBLIC_FIREBASE_API_KEY and EXPO_PUBLIC_FIREBASE_PROJECT_ID in .env.local.
              </Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={Colors.outline}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={Colors.outline}
              secureTextEntry
            />
            {mode === 'signin' && (
              <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotButton}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.button, submitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={submitting || !configured}
            activeOpacity={0.88}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>{mode === 'signin' ? 'Sign In' : 'Sign Up'}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            style={[styles.googleButton, (!request || !configured) && { opacity: 0.5 }]}
            onPress={handleGooglePress}
            disabled={!request || !configured || submitting}
            activeOpacity={0.88}
          >
            <MaterialIcons name="g-translate" size={20} color={Colors.onSurface} />
            <Text style={styles.googleText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')} style={styles.toggle}>
            <Text style={styles.toggleText}>
              {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.margin, paddingVertical: Spacing.sm, backgroundColor: Colors.surface },
  backButton: { width: 38, height: 38, borderRadius: BorderRadius.full, backgroundColor: 'rgba(21,66,18,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.headlineSm, color: Colors.primary, fontWeight: '700' },
  body: { flex: 1, paddingHorizontal: Spacing.margin, paddingTop: Spacing.lg },
  warning: { flexDirection: 'row', gap: 8, backgroundColor: Colors.tertiaryFixed, padding: Spacing.sm, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  warningText: { ...Typography.bodySm, color: Colors.tertiary, flex: 1 },
  field: { marginBottom: Spacing.md },
  label: { ...Typography.labelMd, color: Colors.onSurface, marginBottom: 6 },
  input: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.outlineVariant, paddingHorizontal: Spacing.md, paddingVertical: 12, ...Typography.bodyMd, color: Colors.onSurface },
  button: { backgroundColor: Colors.primary, borderRadius: BorderRadius.full, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  buttonText: { ...Typography.labelLg, color: Colors.onPrimary, fontWeight: '700' },
  forgotButton: { alignSelf: 'flex-end', marginTop: 6 },
  forgotText: { ...Typography.labelSm, color: Colors.primary, fontWeight: '600' },
  toggle: { marginTop: Spacing.md, alignItems: 'center' },
  toggleText: { ...Typography.bodySm, color: Colors.primary, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  divider: { flex: 1, height: 1, backgroundColor: Colors.outlineVariant },
  dividerText: { ...Typography.labelSm, color: Colors.outline },
  googleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.surfaceContainerLowest, borderRadius: BorderRadius.full, paddingVertical: 14, borderWidth: 1, borderColor: Colors.outlineVariant },
  googleText: { ...Typography.labelLg, color: Colors.onSurface, fontWeight: '600' },
});