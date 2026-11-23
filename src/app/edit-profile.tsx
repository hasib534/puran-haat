import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { showAlert } from '../lib/alert';
import { Colors } from '../constants/colors';
import { Typography, BorderRadius, Spacing } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { AuthGate } from '../components/auth/AuthGate';
import { LocationField, type LocationValue } from '../components/location/LocationField';
import { coordsForAreaLabel } from '../lib/geo';

const BIO_LIMIT = 160;

export default function EditProfileScreen() {
  return (
    <AuthGate
      title="Sign in to edit your profile"
      description="Sign in to update your name, photo, and trader details."
    >
      <EditProfileForm />
    </AuthGate>
  );
}

function EditProfileForm() {
  const { profile, updateProfile } = useApp();

  const [fullName, setFullName] = useState(profile.full_name);
  const [username, setUsername] = useState(profile.username || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [location, setLocation] = useState<LocationValue>(() => ({
    label: profile.district || '',
    coords:
      profile.latitude != null && profile.longitude != null
        ? { latitude: profile.latitude, longitude: profile.longitude }
        : coordsForAreaLabel(profile.district || '') ?? null,
  }));
  const [avatarUri, setAvatarUri] = useState(profile.avatar_url || '');
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const dirty = useMemo(() => {
    return (
      fullName.trim() !== profile.full_name ||
      username.trim() !== (profile.username || '') ||
      bio.trim() !== (profile.bio || '') ||
      location.label.trim() !== (profile.district || '') ||
      (location.coords?.latitude ?? null) !== (profile.latitude ?? null) ||
      (location.coords?.longitude ?? null) !== (profile.longitude ?? null) ||
      avatarUri !== (profile.avatar_url || '')
    );
  }, [fullName, username, bio, location, avatarUri, profile]);

  const usernameValid = username.trim() === '' || /^[a-zA-Z0-9_]{3,20}$/.test(username.trim());
  const nameValid = fullName.trim().length >= 2;
  const canSave = dirty && nameValid && usernameValid && !saving;

  const handleBack = useCallback(() => {
    if (dirty) {
      showAlert('Discard changes?', 'You have unsaved changes. Discard them?', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  }, [dirty]);

  const pickImage = useCallback(async (source: 'camera' | 'library') => {
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          showAlert('Permission needed', 'Camera permission is required.');
          return;
        }
        const res = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
        if (!res.canceled && res.assets?.[0]) setAvatarUri(res.assets[0].uri);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          showAlert('Permission needed', 'Photo library permission is required.');
          return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
        if (!res.canceled && res.assets?.[0]) setAvatarUri(res.assets[0].uri);
      }
    } catch {
      showAlert('Error', 'Could not pick image.');
    }
  }, []);

  const handleChangePhoto = useCallback(() => {
    showAlert('Change Photo', 'Choose a source', [
      { text: 'Camera', onPress: () => pickImage('camera') },
      { text: 'Photo Library', onPress: () => pickImage('library') },
      { text: 'Remove Photo', style: 'destructive', onPress: () => setAvatarUri('') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [pickImage]);

  const handleSave = useCallback(async () => {
    if (!nameValid) {
      showAlert('Invalid Name', 'Full name must be at least 2 characters.');
      return;
    }
    if (!usernameValid) {
      showAlert('Invalid Username', 'Username must be 3-20 characters (letters, numbers, underscore).');
      return;
    }
    setSaving(true);
    try {
      const { avatarUploadFailed } = await updateProfile({
        full_name: fullName.trim(),
        username: username.trim(),
        bio: bio.trim(),
        district: location.label.trim(),
        latitude: location.coords?.latitude,
        longitude: location.coords?.longitude,
        avatar_url: avatarUri,
      });
      if (avatarUploadFailed) {
        showAlert(
          'Profile saved',
          'Your details were saved, but the photo could not be uploaded. Photo uploads need Cloudinary — add EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET to .env.local and restart Expo.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
        return;
      }
      showAlert('Profile Updated', 'Your changes have been saved.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      showAlert('Could not save profile', (error as Error).message);
    } finally {
      setSaving(false);
    }
  }, [fullName, username, bio, location, avatarUri, nameValid, usernameValid, updateProfile]);

  const inputStyle = (key: string) => [
    styles.input,
    focused === key && styles.inputFocused,
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.8}>
            <MaterialIcons name="close" size={23} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={handleChangePhoto} activeOpacity={0.85} style={styles.avatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <MaterialIcons name="person" size={48} color={Colors.outline} />
                </View>
              )}
              <View style={styles.cameraBadge}>
                <MaterialIcons name="camera-alt" size={16} color={Colors.onPrimary} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleChangePhoto}>
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
          </View>

          {/* Full Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={inputStyle('name')}
              value={fullName}
              onChangeText={setFullName}
              onFocus={() => setFocused('name')}
              onBlur={() => setFocused(null)}
              placeholder="Your full name"
              placeholderTextColor={Colors.outline}
              autoCapitalize="words"
            />
            {!nameValid && fullName.length > 0 && (
              <Text style={styles.errorText}>Name must be at least 2 characters.</Text>
            )}
          </View>

          {/* Username */}
          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <View style={[styles.usernameRow, focused === 'username' && styles.inputFocused]}>
              <Text style={styles.at}>@</Text>
              <TextInput
                style={styles.usernameInput}
                value={username}
                onChangeText={setUsername}
                onFocus={() => setFocused('username')}
                onBlur={() => setFocused(null)}
                placeholder="username"
                placeholderTextColor={Colors.outline}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {!usernameValid && (
              <Text style={styles.errorText}>3-20 characters: letters, numbers, underscore.</Text>
            )}
          </View>

          {/* Bio */}
          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Bio</Text>
              <Text style={styles.counter}>{bio.length}/{BIO_LIMIT}</Text>
            </View>
            <TextInput
              style={[...inputStyle('bio'), styles.textArea]}
              value={bio}
              onChangeText={(t) => setBio(t.slice(0, BIO_LIMIT))}
              onFocus={() => setFocused('bio')}
              onBlur={() => setFocused(null)}
              placeholder="Tell the community about yourself..."
              placeholderTextColor={Colors.outline}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Location */}
          <View style={styles.field}>
            <LocationField
              label="Location"
              value={location}
              onChange={setLocation}
              placeholder="Dhanmondi, Dhaka"
              hint="Helps traders see how far you are."
            />
          </View>

          {/* Social connections */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trust & Verification</Text>
            <Text style={styles.sectionSub}>Connect accounts to help neighbors know you&apos;re real.</Text>
            {[
              { name: 'Instagram', icon: 'photo-camera', connected: false },
              { name: 'Facebook', icon: 'group', connected: true, connectedName: profile.full_name },
            ].map((s) => (
              <View key={s.name} style={styles.socialRow}>
                <View style={styles.socialIcon}>
                  <MaterialIcons name={s.icon as any} size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.socialLabel}>{s.name}</Text>
                  {s.connected && <Text style={styles.connectedName}>{s.connectedName}</Text>}
                </View>
                {s.connected ? (
                  <View style={styles.connectedBadge}>
                    <MaterialIcons name="check" size={14} color={Colors.onPrimary} />
                    <Text style={styles.connectedText}>Connected</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.connectBtn}
                    onPress={() => showAlert(s.name, 'OAuth connection coming soon.')}
                  >
                    <Text style={styles.connectText}>Connect</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          {/* Danger zone */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.dangerRow}
              onPress={() => showAlert('Delete Account', 'This action is permanent. Contact support to proceed.')}
            >
              <MaterialIcons name="delete-outline" size={20} color={Colors.error} />
              <Text style={styles.dangerText}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.88}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.onPrimary} />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.margin, paddingVertical: Spacing.sm, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: 'rgba(21,66,18,0.05)' },
  backButton: { width: 38, height: 38, borderRadius: BorderRadius.full, backgroundColor: 'rgba(21,66,18,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.headlineSm, color: Colors.primary, fontWeight: '700' },
  headerSpacer: { width: 38 },
  scrollContent: { paddingHorizontal: Spacing.margin, paddingBottom: Spacing.lg },
  avatarSection: { alignItems: 'center', marginTop: Spacing.md, marginBottom: Spacing.lg },
  avatarWrap: { position: 'relative' },
  avatar: { width: 112, height: 112, borderRadius: BorderRadius.full, borderWidth: 4, borderColor: Colors.surfaceContainerHighest },
  avatarPlaceholder: { backgroundColor: Colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  cameraBadge: { position: 'absolute', bottom: 4, right: 4, width: 36, height: 36, borderRadius: BorderRadius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: Colors.background },
  changePhotoText: { ...Typography.labelMd, color: Colors.tertiary, marginTop: Spacing.sm, fontWeight: '700' },
  field: { marginBottom: Spacing.md },
  label: { ...Typography.labelMd, color: Colors.onSurface, marginBottom: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  counter: { ...Typography.labelSm, color: Colors.outline },
  input: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, ...Typography.bodyMd, color: Colors.onSurface, borderWidth: 1.5, borderColor: 'rgba(21,66,18,0.1)' },
  inputFocused: { borderColor: Colors.primary, backgroundColor: Colors.surface },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  errorText: { ...Typography.bodySm, color: Colors.error, marginTop: 4, fontSize: 11 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainerLowest, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, borderWidth: 1.5, borderColor: 'rgba(21,66,18,0.1)' },
  at: { ...Typography.bodyMd, color: Colors.outline, marginRight: 4 },
  usernameInput: { flex: 1, paddingVertical: 12, ...Typography.bodyMd, color: Colors.onSurface },
  section: { marginTop: Spacing.lg },
  sectionTitle: { ...Typography.labelLg, color: Colors.primary, marginBottom: 4 },
  sectionSub: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginBottom: Spacing.sm },
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(21,66,18,0.05)' },
  socialIcon: { width: 40, height: 40, borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  socialLabel: { ...Typography.bodyMd, color: Colors.onSurface, fontWeight: '600' },
  connectedName: { ...Typography.bodySm, color: Colors.onSurfaceVariant, fontSize: 11 },
  connectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.full },
  connectedText: { ...Typography.labelSm, color: Colors.onPrimary },
  connectBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.primary },
  connectText: { ...Typography.labelSm, color: Colors.primary },
  dangerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  dangerText: { ...Typography.bodyMd, color: Colors.error, fontWeight: '600' },
  bottomBar: {
    paddingHorizontal: Spacing.margin,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(21, 66, 18, 0.07)',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: { opacity: 0.45 },
  saveButtonText: { ...Typography.labelLg, color: Colors.onPrimary, fontWeight: '700' },
});