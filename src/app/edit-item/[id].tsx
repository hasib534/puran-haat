import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';

import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { AuthGate } from '../../components/auth/AuthGate';
import { showAlert } from '../../lib/alert';
import { MOCK_CATEGORIES } from '../../data/mock-items';
import type { ConditionType, Item, TradeModeType } from '../../types';

const CATEGORY_OPTIONS = MOCK_CATEGORIES.filter((category) => category.id !== 'all');
const MAX_PHOTOS = 5;

const CONDITION_OPTIONS: { value: ConditionType; label: string }[] = [
  { value: 'brand_new', label: 'Brand new' },
  { value: 'like_new', label: 'Like new' },
  { value: 'gently_used', label: 'Gently used' },
  { value: 'fair', label: 'Fair' },
];

const TRADE_MODE_OPTIONS: { value: TradeModeType; label: string; icon: string }[] = [
  { value: 'trade', label: 'Barter swap', icon: 'swap-horiz' },
  { value: 'free', label: 'Free gift', icon: 'volunteer-activism' },
  { value: 'auction', label: 'Auction', icon: 'gavel' },
];

export default function EditListingScreen() {
  return (
    <AuthGate
      requireVerified
      title="Sign in to edit your listing"
      description="Verify your email, then update the details of your item."
    >
      <EditListingGate />
    </AuthGate>
  );
}

function EditListingGate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, itemsLoading } = useApp();
  const { user } = useAuth();
  const item = items.find((entry) => entry.id === id);

  if (itemsLoading && !item) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.stateScreen}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.stateText}>Loading listing…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.stateScreen}>
          <MaterialIcons name="inventory-2" size={52} color={Colors.outline} />
          <Text style={styles.stateTitle}>Listing not available</Text>
          <Text style={styles.stateText}>This item may have been removed already.</Text>
          <TouchableOpacity style={styles.stateButton} onPress={() => router.back()}>
            <Text style={styles.stateButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (user && item.user_id !== user.uid) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.stateScreen}>
          <MaterialIcons name="lock-outline" size={52} color={Colors.outline} />
          <Text style={styles.stateTitle}>Not your listing</Text>
          <Text style={styles.stateText}>You can only edit items that you posted.</Text>
          <TouchableOpacity style={styles.stateButton} onPress={() => router.back()}>
            <Text style={styles.stateButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return <EditListingForm item={item} />;
}

function EditListingForm({ item }: { item: Item }) {
  const { updateItem, canUploadPhotos, uploadListingImages } = useApp();
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description || '');
  const [categoryId, setCategoryId] = useState(item.category_id);
  const [condition, setCondition] = useState<ConditionType>(item.condition);
  const [tradeMode, setTradeMode] = useState<TradeModeType>(item.trade_mode);
  const [locationName, setLocationName] = useState(item.location_name);
  const [photos, setPhotos] = useState<string[]>(item.images || []);
  const [saving, setSaving] = useState(false);

  const remainingSlots = Math.max(0, MAX_PHOTOS - photos.length);

  const pickPhotos = async (fromCamera = false) => {
    if (remainingSlots <= 0) {
      showAlert('Photo limit reached', `You can keep up to ${MAX_PHOTOS} photos.`);
      return;
    }
    try {
      if (fromCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          showAlert('Camera permission needed', 'Allow camera access to take a photo.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
        if (!result.canceled && result.assets?.[0]) {
          setPhotos((prev) => [...prev, result.assets[0].uri].slice(0, MAX_PHOTOS));
        }
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert('Photo permission needed', 'Allow photo access to add pictures.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length) {
        const picked = result.assets.map((asset) => asset.uri);
        setPhotos((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
      }
    } catch {
      showAlert('Could not add photo', 'Something went wrong while picking an image.');
    }
  };

  const handleAddPhoto = () => {
    showAlert('Add Photo', 'Choose a source', [
      { text: 'Camera', onPress: () => pickPhotos(true) },
      { text: 'Photo Library', onPress: () => pickPhotos(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter((entry) => entry !== uri));
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showAlert('Missing title', 'Give your listing a short title before saving.');
      return;
    }
    if (trimmedTitle.length > 120) {
      showAlert('Title too long', 'Keep the title under 120 characters.');
      return;
    }
    if (photos.length === 0) {
      showAlert('Add a photo', 'Keep at least one photo on your listing.');
      return;
    }

    setSaving(true);
    try {
      const uploadedPhotos = await uploadListingImages(photos);
      await updateItem(item.id, {
        title: trimmedTitle,
        description: description.trim(),
        category_id: categoryId,
        condition,
        trade_mode: tradeMode,
        location_name: locationName.trim() || 'Dhaka',
        images: uploadedPhotos,
      });
      showAlert('Listing updated', 'Your changes are live on the Haat.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      showAlert('Could not update listing', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Listing</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.photoCard, Shadows.card]}>
            <View style={styles.galleryHeader}>
              <View style={styles.galleryHeaderBody}>
                <Text style={styles.photoTitle}>Listing photos</Text>
                <Text style={styles.photoHint}>
                  {photos.length} of {MAX_PHOTOS} · first photo is the main one
                </Text>
              </View>
              <TouchableOpacity
                style={styles.addPhotoButton}
                onPress={handleAddPhoto}
                accessibilityRole="button"
                accessibilityLabel="Add photo"
              >
                <MaterialIcons name="add-a-photo" size={16} color={Colors.onPrimary} />
                <Text style={styles.addPhotoText}>Add</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.galleryGrid}>
              {photos.map((uri, index) => (
                <View key={`photo-${uri}`} style={styles.galleryItem}>
                  <Image source={{ uri }} style={styles.galleryImage} contentFit="cover" />
                  {index === 0 && (
                    <View style={styles.mainBadge}>
                      <Text style={styles.mainBadgeText}>Main</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.galleryRemove}
                    onPress={() => removePhoto(uri)}
                    accessibilityLabel={`Remove photo ${index + 1}`}
                    hitSlop={8}
                  >
                    <MaterialIcons name="close" size={14} color={Colors.onSurface} />
                  </TouchableOpacity>
                </View>
              ))}

              {remainingSlots > 0 && (
                <TouchableOpacity
                  style={styles.galleryAddSlot}
                  onPress={handleAddPhoto}
                  accessibilityLabel="Add another photo"
                >
                  <MaterialIcons name="add" size={24} color={Colors.outline} />
                </TouchableOpacity>
              )}
            </View>

            {!canUploadPhotos && (
              <View style={styles.configWarning}>
                <MaterialIcons name="cloud-off" size={16} color={Colors.tertiary} />
                <Text style={styles.configWarningText}>
                  Photo uploads need Cloudinary. Add EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and
                  EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET to .env.local, then restart Expo.
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            placeholder="What are you trading?"
            placeholderTextColor="rgba(66, 73, 62, 0.6)"
            accessibilityLabel="Listing title"
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            maxLength={2000}
            multiline
            textAlignVertical="top"
            placeholder="Condition details, dimensions, what you hope to trade for…"
            placeholderTextColor="rgba(66, 73, 62, 0.6)"
            accessibilityLabel="Listing description"
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.chipWrap}>
            {CATEGORY_OPTIONS.map((category) => {
              const active = category.id === categoryId;
              return (
                <TouchableOpacity
                  key={category.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setCategoryId(category.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <MaterialIcons
                    name={category.icon as never}
                    size={15}
                    color={active ? Colors.onPrimary : Colors.primary}
                  />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Condition</Text>
          <View style={styles.chipWrap}>
            {CONDITION_OPTIONS.map((option) => {
              const active = option.value === condition;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setCondition(option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Trade mode</Text>
          <View style={styles.chipWrap}>
            {TRADE_MODE_OPTIONS.map((option) => {
              const active = option.value === tradeMode;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setTradeMode(option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <MaterialIcons
                    name={option.icon as never}
                    size={15}
                    color={active ? Colors.onPrimary : Colors.primary}
                  />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            value={locationName}
            onChangeText={setLocationName}
            maxLength={120}
            placeholder="Area, city"
            placeholderTextColor="rgba(66, 73, 62, 0.6)"
            accessibilityLabel="Listing location"
          />

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
          >
            {saving ? (
              <ActivityIndicator color={Colors.onPrimary} />
            ) : (
              <>
                <MaterialIcons name="save" size={20} color={Colors.onPrimary} />
                <Text style={styles.saveButtonText}>Save changes</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.margin,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(21,66,18,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...Typography.headlineSm, color: Colors.primary, fontWeight: '700' },
  headerSpacer: { width: 38 },
  scrollContent: {
    paddingHorizontal: Spacing.margin,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  photoCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(21,66,18,0.05)',
  },
  galleryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: Spacing.xs,
  },
  galleryHeaderBody: { flex: 1 },
  photoTitle: { ...Typography.labelLg, color: Colors.onSurface },
  photoHint: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 2 },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addPhotoText: { ...Typography.labelSm, color: Colors.onPrimary, fontWeight: '700' },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.xs },
  galleryItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceContainer,
  },
  galleryImage: { width: '100%', height: '100%' },
  mainBadge: {
    position: 'absolute',
    left: 5,
    bottom: 5,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  mainBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.onPrimary },
  galleryRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(253, 250, 231, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryAddSlot: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(21, 66, 18, 0.2)',
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  configWarning: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(106, 33, 13, 0.08)',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  configWarningText: {
    ...Typography.bodySm,
    color: Colors.tertiary,
    flex: 1,
    lineHeight: 18,
    fontSize: 11,
  },
  label: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    marginTop: Spacing.md,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(21,66,18,0.12)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    ...Typography.bodyMd,
    color: Colors.onSurface,
  },
  textArea: { minHeight: 110, paddingTop: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.secondaryContainer,
  },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { ...Typography.labelSm, color: Colors.onSecondaryContainer },
  chipTextActive: { color: Colors.onPrimary },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.lg,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { ...Typography.labelLg, color: Colors.onPrimary, fontWeight: '700' },
  stateScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    gap: 8,
  },
  stateTitle: { ...Typography.headlineSm, color: Colors.onSurface },
  stateText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 21,
  },
  stateButton: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  stateButtonText: { ...Typography.labelLg, color: Colors.onPrimary, fontWeight: '700' },
});
