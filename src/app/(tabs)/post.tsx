import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../../constants/theme';
import { MOCK_CATEGORIES } from '../../data/mock-items';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { AuthGate } from '../../components/auth/AuthGate';
import type { ConditionType, Item, TradeModeType } from '../../types';

const STEPS = ['Photos', 'Item Details', 'Exchange'] as const;
const CATEGORY_OPTIONS = MOCK_CATEGORIES.filter((category) => category.id !== 'all');
const MAX_PHOTOS = 5;

const CONDITION_OPTIONS: { value: ConditionType; label: string }[] = [
  { value: 'brand_new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'gently_used', label: 'Good' },
  { value: 'fair', label: 'Fair' },
];

export default function PostItemTab() {
  return (
    <AuthGate
      requireVerified
      title="Sign in to post an item"
      description="Create a free listing and trade with your local community."
    >
      <PostItemForm />
    </AuthGate>
  );
}

function PostItemForm() {
  const { addItem, profile, canUploadPhotos, uploadListingImages } = useApp();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  /** Set after a successful publish so the success screen can show its actions. */
  const [published, setPublished] = useState<Item | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('furniture');
  const [condition, setCondition] = useState<ConditionType>('like_new');
  const [tradeMode, setTradeMode] = useState<TradeModeType>('trade');
  const [wishlistInput, setWishlistInput] = useState('');
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [interestCategories, setInterestCategories] = useState<string[]>([]);
  const [openToOffers, setOpenToOffers] = useState(true);
  const [locationName, setLocationName] = useState('Dhanmondi, Dhaka');

  const categoryName = useMemo(
    () => CATEGORY_OPTIONS.find((category) => category.id === selectedCategory)?.name || '',
    [selectedCategory],
  );

  const goBack = () => {
    if (step > 0) {
      setStep((value) => value - 1);
      return;
    }
    router.push('/(tabs)' as never);
  };

  const addWishlistItem = () => {
    const value = wishlistInput.trim();
    if (!value) return;
    if (wishlist.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
      setWishlistInput('');
      return;
    }
    setWishlist((prev) => [...prev, value]);
    setWishlistInput('');
  };

  const toggleInterest = (categoryId: string) => {
    setInterestCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((entry) => entry !== categoryId)
        : [...prev, categoryId],
    );
  };

  const remainingSlots = MAX_PHOTOS - photos.length;

  const pickPhotos = async (fromCamera = false) => {
    if (remainingSlots <= 0) {
      showAlert('Photo limit reached', `You can add up to ${MAX_PHOTOS} photos.`);
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

  const handleNext = () => {
    if (step === 0) {
      if (photos.length === 0) {
        showAlert('Add a photo', 'Add at least one clear photo so neighbors can see your item.');
        return;
      }
      if (!canUploadPhotos) {
        showAlert(
          'Photo uploads not set up',
          'Photo uploads need Cloudinary. Add EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET to .env.local, then restart Expo.',
        );
        return;
      }
    }
    if (step === 1) {
      if (!title.trim()) {
        showAlert('Missing Title', 'Please enter a title for your item.');
        return;
      }
      if (title.trim().length > 120) {
        showAlert('Title too long', 'Keep the title under 120 characters.');
        return;
      }
    }
    setStep((value) => Math.min(value + 1, STEPS.length - 1));
  };

  const handleSubmitListing = async () => {
    if (!title.trim()) {
      showAlert('Missing Title', 'Please enter a title for your item.');
      setStep(1);
      return;
    }
    if (photos.length === 0) {
      showAlert('Add a photo', 'Add at least one photo before publishing.');
      setStep(0);
      return;
    }

    setSubmitting(true);
    try {
      const uploadedPhotos = await uploadListingImages(photos);

      const newItem: Item = {
        id: Date.now().toString(),
        user_id: user?.uid || 'me',
        title: title.trim(),
        description: description.trim() || 'No description provided.',
        category_id: selectedCategory,
        condition,
        trade_mode: tradeMode,
        eco_impact_rating: 'Med',
        co2_saved_kg: 3.0,
        images: uploadedPhotos,
        location_name: locationName.trim() || 'Dhaka',
        distance_km: 0.5,
        is_favorite: false,
        user: {
          ...profile,
          id: user?.uid || 'me',
          is_verified: user?.emailVerified ?? profile.is_verified,
        },
        created_at: new Date().toISOString(),
      };

      await addItem(newItem);
      setPublished(newItem);
      setPhotos([]);
      setTitle('');
      setDescription('');
      setWishlist([]);
      setWishlistInput('');
      setInterestCategories([]);
      setStep(0);
    } catch (error) {
      showAlert('Could not publish listing', (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const goHome = () => {
    setPublished(null);
    router.push('/(tabs)' as never);
  };

  const sharePublished = () => {
    if (!published) return;
    Share.share({
      message: `"${published.title}" is now on Puran Haat — trade, don't toss.`,
    }).catch(() => {
      // Dismissing the share sheet is not an error worth interrupting the user.
    });
  };

  if (published) {
    return (
      <SafeAreaView style={styles.successSafeArea} edges={['top', 'bottom']}>
        <View style={styles.successBody}>
          <View style={styles.successIconWrap}>
            <MaterialIcons name="eco" size={56} color={Colors.primary} />
          </View>

          <Text style={styles.successTitle}>Item Published!</Text>
          <Text style={styles.successSubtitle}>
            Your listing is now live in the Puran Haat community. Thank you for contributing to a
            sustainable neighborhood.
          </Text>

          <Text style={styles.successItemTitle} numberOfLines={2}>
            {published.title}
          </Text>

          <View style={styles.successActions}>
            <TouchableOpacity
              style={styles.successPrimary}
              activeOpacity={0.88}
              onPress={() => {
                const id = published.id;
                setPublished(null);
                router.push({ pathname: '/item/[id]', params: { id } } as never);
              }}
            >
              <MaterialIcons name="visibility" size={19} color={Colors.onPrimary} />
              <Text style={styles.successPrimaryText}>View Listing</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.successSecondary}
              activeOpacity={0.88}
              onPress={sharePublished}
            >
              <MaterialIcons name="share" size={19} color={Colors.primary} />
              <Text style={styles.successSecondaryText}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={goHome} activeOpacity={0.7}>
              <Text style={styles.successLink}>Go to Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={goBack}
          accessibilityLabel={step > 0 ? 'Previous step' : 'Back to home'}
        >
          <MaterialIcons name="arrow-back" size={23} color={Colors.primary} />
        </TouchableOpacity>

        <Text style={styles.brandTitle}>Puran Haat</Text>

        <TouchableOpacity
          onPress={() => router.push('/(tabs)' as never)}
          accessibilityRole="button"
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Progress */}
      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          {STEPS.map((label, index) => (
            <View
              key={label}
              style={[styles.progressSegment, index <= step && styles.progressSegmentActive]}
            />
          ))}
        </View>
        <Text style={styles.progressLabel}>
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </Text>
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
          {step === 0 && (
            <>
              <Text style={styles.pageTitle}>Add Photos</Text>
              <Text style={styles.pageSubtitle}>
                Great photos help your item find a new home faster. Start with a clear main
                image.
              </Text>

              {photos[0] ? (
                <View style={[styles.heroPhotoWrap, Shadows.card]}>
                  <Image source={{ uri: photos[0] }} style={styles.heroPhotoImage} contentFit="cover" />
                  <View style={styles.heroBadge}>
                    <MaterialIcons name="star" size={13} color={Colors.onPrimary} />
                    <Text style={styles.heroBadgeText}>Main Photo</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removePhoto(photos[0])}
                    accessibilityLabel="Remove main photo"
                    hitSlop={8}
                  >
                    <MaterialIcons name="close" size={16} color={Colors.onSurface} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.heroPhoto, Shadows.card]}
                  onPress={handleAddPhoto}
                  activeOpacity={0.85}
                  accessibilityLabel="Add main photo"
                >
                  <View style={styles.cameraCircle}>
                    <MaterialIcons name="add-a-photo" size={30} color={Colors.primary} />
                  </View>
                  <Text style={styles.heroPrompt}>Add Main Photo</Text>
                  <Text style={styles.heroHint}>Tap to take or choose a photo</Text>
                </TouchableOpacity>
              )}

              <View style={styles.photoGrid}>
                {Array.from({ length: MAX_PHOTOS - 1 }).map((_, index) => {
                  const uri = photos[index + 1];
                  return uri ? (
                    <View key={`photo-${uri}`} style={styles.photoSlotFilled}>
                      <Image source={{ uri }} style={styles.photoSlotImage} contentFit="cover" />
                      <TouchableOpacity
                        style={styles.removeButtonSmall}
                        onPress={() => removePhoto(uri)}
                        accessibilityLabel={`Remove photo ${index + 2}`}
                        hitSlop={8}
                      >
                        <MaterialIcons name="close" size={14} color={Colors.onSurface} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      key={`slot-${index}`}
                      style={styles.photoSlot}
                      onPress={handleAddPhoto}
                      activeOpacity={0.8}
                      accessibilityLabel={`Add photo ${index + 2}`}
                    >
                      <MaterialIcons name="add" size={26} color={Colors.outline} />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.photoCount}>
                {photos.length} of {MAX_PHOTOS} photos added
              </Text>

              <View style={styles.tipsCard}>
                <View style={styles.tipsHeader}>
                  <MaterialIcons name="lightbulb" size={20} color={Colors.primary} />
                  <Text style={styles.tipsTitle}>Photo Tips</Text>
                </View>
                {[
                  {
                    icon: 'wb-sunny',
                    title: 'Use natural light.',
                    body: ' Place your item near a window. Avoid harsh flash.',
                  },
                  {
                    icon: '360',
                    title: 'Show multiple angles.',
                    body: ' Capture the front, back, and any important details or wear.',
                  },
                  {
                    icon: 'layers-clear',
                    title: 'Keep it clean.',
                    body: ' A clutter-free background makes your item stand out.',
                  },
                ].map((tip) => (
                  <View key={tip.icon} style={styles.tipRow}>
                    <MaterialIcons name={tip.icon as never} size={17} color={Colors.primary} />
                    <Text style={styles.tipText}>
                      <Text style={styles.tipStrong}>{tip.title}</Text>
                      {tip.body}
                    </Text>
                  </View>
                ))}
              </View>

              {canUploadPhotos ? (
                <Text style={styles.photoNote}>
                  Photos upload securely to Cloudinary when you publish.
                </Text>
              ) : (
                <View style={styles.configWarning}>
                  <MaterialIcons name="cloud-off" size={17} color={Colors.tertiary} />
                  <Text style={styles.configWarningText}>
                    Photo uploads need Cloudinary. Add EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and
                    EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET to .env.local, then restart Expo.
                  </Text>
                </View>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <Text style={styles.pageTitle}>What are you trading?</Text>
              <Text style={styles.pageSubtitle}>
                Tell neighbors what it is and how it has been loved.
              </Text>

              <View style={[styles.formCard, Shadows.card]}>
                <Text style={styles.label}>Item Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Vintage Coffee Grinder"
                  placeholderTextColor="rgba(66, 73, 62, 0.55)"
                  value={title}
                  onChangeText={setTitle}
                  maxLength={120}
                  accessibilityLabel="Item title"
                />
                <Text style={styles.counter}>{title.length}/120</Text>

                <Text style={styles.label}>Category</Text>
                <View style={styles.chipWrap}>
                  {CATEGORY_OPTIONS.map((category) => {
                    const active = selectedCategory === category.id;
                    return (
                      <TouchableOpacity
                        key={category.id}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setSelectedCategory(category.id)}
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
                <View style={styles.conditionGrid}>
                  {CONDITION_OPTIONS.map((option) => {
                    const active = condition === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.conditionCard, active && styles.conditionCardActive]}
                        onPress={() => setCondition(option.value)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                      >
                        <View style={[styles.radio, active && styles.radioActive]}>
                          {active && <View style={styles.radioDot} />}
                        </View>
                        <Text
                          style={[
                            styles.conditionText,
                            active && styles.conditionTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  multiline
                  textAlignVertical="top"
                  maxLength={2000}
                  placeholder="Describe the item, its history, or why you're trading it..."
                  placeholderTextColor="rgba(66, 73, 62, 0.55)"
                  value={description}
                  onChangeText={setDescription}
                  accessibilityLabel="Item description"
                />

                <Text style={styles.label}>Pickup Location</Text>
                <View style={styles.locationRow}>
                  <MaterialIcons name="location-on" size={18} color={Colors.primary} />
                  <TextInput
                    style={styles.locationInput}
                    placeholder="Dhanmondi, Mirpur, TSC..."
                    placeholderTextColor="rgba(66, 73, 62, 0.55)"
                    value={locationName}
                    onChangeText={setLocationName}
                    accessibilityLabel="Pickup location"
                  />
                </View>
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.pageTitle}>What are you looking for?</Text>
              <Text style={styles.pageSubtitle}>
                Tell neighbors what you&apos;d like in exchange for your item.
              </Text>

              <View style={[styles.formCard, Shadows.card]}>
                <Text style={styles.cardHeading}>Specific Items</Text>
                <Text style={styles.cardHint}>List specific items you&apos;re hoping to trade for.</Text>

                {wishlist.length > 0 && (
                  <View style={styles.wishChipWrap}>
                    {wishlist.map((entry) => (
                      <View key={entry} style={styles.wishChip}>
                        <Text style={styles.wishChipText}>{entry}</Text>
                        <TouchableOpacity
                          onPress={() =>
                            setWishlist((prev) => prev.filter((value) => value !== entry))
                          }
                          accessibilityLabel={`Remove ${entry}`}
                          hitSlop={8}
                        >
                          <MaterialIcons name="close" size={14} color={Colors.primary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.addRow}>
                  <TextInput
                    style={styles.addInput}
                    placeholder="e.g., Cast iron skillet"
                    placeholderTextColor="rgba(66, 73, 62, 0.55)"
                    value={wishlistInput}
                    onChangeText={setWishlistInput}
                    onSubmitEditing={addWishlistItem}
                    returnKeyType="done"
                    accessibilityLabel="Add a specific item you want"
                  />
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={addWishlistItem}
                    accessibilityRole="button"
                  >
                    <MaterialIcons name="add" size={18} color={Colors.onPrimary} />
                    <Text style={styles.addButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.formCard, Shadows.card]}>
                <Text style={styles.cardHeading}>Categories of Interest</Text>
                <Text style={styles.cardHint}>Select broader categories you&apos;re interested in.</Text>

                <View style={styles.chipWrap}>
                  {CATEGORY_OPTIONS.map((category) => {
                    const active = interestCategories.includes(category.id);
                    return (
                      <TouchableOpacity
                        key={category.id}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => toggleInterest(category.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        {active && (
                          <MaterialIcons name="check" size={14} color={Colors.onPrimary} />
                        )}
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {category.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={[styles.formCard, Shadows.card]}>
                <View style={styles.switchRow}>
                  <View style={styles.switchBody}>
                    <Text style={styles.cardHeading}>Open to Offers</Text>
                    <Text style={styles.cardHint}>
                      Allow neighbors to propose other fair trades.
                    </Text>
                  </View>
                  <Switch
                    value={openToOffers}
                    onValueChange={setOpenToOffers}
                    trackColor={{
                      false: Colors.surfaceContainerHighest,
                      true: Colors.primaryFixedDim,
                    }}
                    thumbColor={openToOffers ? Colors.primary : Colors.surfaceContainerLowest}
                    ios_backgroundColor={Colors.surfaceContainerHighest}
                  />
                </View>
              </View>

              <Text style={styles.label}>Exchange Style</Text>
              <View style={styles.modeContainer}>
                <TouchableOpacity
                  style={[styles.modeCard, tradeMode === 'trade' && styles.modeCardActive]}
                  onPress={() => setTradeMode('trade')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: tradeMode === 'trade' }}
                >
                  <MaterialIcons
                    name="swap-horiz"
                    size={24}
                    color={tradeMode === 'trade' ? Colors.primary : Colors.outline}
                  />
                  <Text
                    style={[
                      styles.modeCardTitle,
                      tradeMode === 'trade' && styles.modeCardTitleActive,
                    ]}
                  >
                    Barter Swap
                  </Text>
                  <Text style={styles.modeCardDesc}>Trade for another item</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modeCard, tradeMode === 'free' && styles.modeCardActive]}
                  onPress={() => setTradeMode('free')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: tradeMode === 'free' }}
                >
                  <MaterialIcons
                    name="volunteer-activism"
                    size={24}
                    color={tradeMode === 'free' ? Colors.tertiary : Colors.outline}
                  />
                  <Text
                    style={[
                      styles.modeCardTitle,
                      tradeMode === 'free' && styles.modeCardTitleActiveFree,
                    ]}
                  >
                    Free Gift
                  </Text>
                  <Text style={styles.modeCardDesc}>Give it to someone in need</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.previewCard}>
                {photos[0] ? (
                  <Image source={{ uri: photos[0] }} style={styles.previewThumb} contentFit="cover" />
                ) : (
                  <View style={[styles.previewThumb, styles.previewThumbEmpty]}>
                    <MaterialIcons name="image" size={26} color={Colors.outline} />
                  </View>
                )}
                <View style={styles.previewBody}>
                  <Text style={styles.previewTitle} numberOfLines={1}>
                    {title.trim() || 'Your listing title'}
                  </Text>
                  <Text style={styles.previewMeta}>
                    {categoryName} · {tradeMode === 'free' ? 'Free gift' : 'Barter'} ·{' '}
                    {locationName.trim() || 'Dhaka'}
                  </Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {/* Sticky actions */}
        <View style={styles.bottomBar}>
          {step > 0 && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={goBack}
              accessibilityRole="button"
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
            onPress={step === 2 ? handleSubmitListing : handleNext}
            disabled={submitting}
            activeOpacity={0.88}
          >
            {submitting ? (
              <>
                <ActivityIndicator color={Colors.onPrimary} />
                <Text style={styles.primaryButtonText}>Publishing…</Text>
              </>
            ) : (
              <>
                <Text style={styles.primaryButtonText}>
                  {step === 2 ? 'Publish Listing' : 'Next Step'}
                </Text>
                {step < 2 && (
                  <MaterialIcons name="arrow-forward" size={19} color={Colors.onPrimary} />
                )}
              </>
            )}
          </TouchableOpacity>
        </View>
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
    paddingVertical: Spacing.xs,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: { ...Typography.headlineSm, color: Colors.primary, fontWeight: '700' },
  cancelText: { ...Typography.labelMd, color: Colors.tertiary, fontWeight: '700' },
  progressWrap: { paddingHorizontal: Spacing.margin, marginTop: Spacing.xs },
  progressTrack: { flexDirection: 'row', gap: 6 },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceContainerHighest,
  },
  progressSegmentActive: { backgroundColor: Colors.primary },
  progressLabel: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
    marginTop: 6,
  },
  scrollContent: { paddingHorizontal: Spacing.margin, paddingBottom: Spacing.lg },
  pageTitle: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
    fontWeight: '700',
    marginTop: Spacing.md,
  },
  pageSubtitle: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    marginTop: 4,
    marginBottom: Spacing.md,
    lineHeight: 21,
  },
  heroPhoto: {
    height: 220,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(21, 66, 18, 0.28)',
    backgroundColor: 'rgba(45, 90, 39, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPhotoWrap: {
    height: 220,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceContainer,
  },
  heroPhotoImage: { width: '100%', height: '100%' },
  heroBadge: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeText: { ...Typography.labelSm, color: Colors.onPrimary, fontWeight: '700' },
  removeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(253, 250, 231, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonSmall: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(253, 250, 231, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoSlotFilled: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceContainer,
  },
  photoSlotImage: { width: '100%', height: '100%' },
  photoCount: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
    marginTop: Spacing.xs,
    textAlign: 'right',
  },
  cameraCircle: {
    width: 62,
    height: 62,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroPrompt: { ...Typography.labelLg, color: Colors.primary, fontWeight: '700' },
  heroHint: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 2 },
  photoGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Spacing.sm,
  },
  photoSlot: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(21, 66, 18, 0.16)',
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipsCard: {
    backgroundColor: 'rgba(217, 230, 218, 0.5)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  tipsHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  tipsTitle: { ...Typography.labelLg, color: Colors.primary, fontWeight: '700' },
  tipRow: { flexDirection: 'row', gap: 8, marginTop: 5 },
  tipText: { ...Typography.bodySm, color: Colors.onSurfaceVariant, flex: 1, lineHeight: 18 },
  tipStrong: { fontWeight: '700', color: Colors.onSurface },
  photoNote: {
    ...Typography.bodySm,
    color: Colors.outline,
    textAlign: 'center',
    marginTop: Spacing.md,
    fontSize: 11,
  },
  configWarning: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(106, 33, 13, 0.08)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    marginTop: Spacing.md,
  },
  configWarningText: {
    ...Typography.bodySm,
    color: Colors.tertiary,
    flex: 1,
    lineHeight: 18,
    fontSize: 11,
  },
  formCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.labelMd,
    color: Colors.onSurface,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    ...Typography.bodyMd,
    color: Colors.onSurface,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.1)',
  },
  counter: {
    ...Typography.labelSm,
    color: Colors.outline,
    textAlign: 'right',
    marginTop: 3,
  },
  textArea: { minHeight: 104 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.secondaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { ...Typography.labelSm, color: Colors.onSecondaryContainer },
  chipTextActive: { color: Colors.onPrimary, fontWeight: '700' },
  conditionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  conditionCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1.5,
    borderColor: 'rgba(21, 66, 18, 0.1)',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
  },
  conditionCardActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(45, 90, 39, 0.07)',
  },
  radio: {
    width: 17,
    height: 17,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: Colors.primary },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  conditionText: { ...Typography.labelSm, color: Colors.onSurfaceVariant },
  conditionTextActive: { color: Colors.primary, fontWeight: '700' },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.1)',
  },
  locationInput: { flex: 1, paddingVertical: 12, ...Typography.bodyMd, color: Colors.onSurface },
  cardHeading: { ...Typography.labelLg, color: Colors.primary, fontWeight: '700' },
  cardHint: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 2 },
  wishChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: Spacing.sm },
  wishChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.secondaryContainer,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  wishChipText: { ...Typography.labelSm, color: Colors.onPrimaryContainer },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.sm },
  addInput: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    ...Typography.bodyMd,
    color: Colors.onSurface,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.1)',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  addButtonText: { ...Typography.labelMd, color: Colors.onPrimary, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchBody: { flex: 1 },
  modeContainer: { flexDirection: 'row', gap: 10, marginBottom: Spacing.md },
  modeCard: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(21, 66, 18, 0.1)',
    alignItems: 'center',
  },
  modeCardActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(45, 90, 39, 0.06)',
  },
  modeCardTitle: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    fontWeight: '700',
    marginTop: 6,
  },
  modeCardTitleActive: { color: Colors.primary },
  modeCardTitleActiveFree: { color: Colors.tertiary },
  modeCardDesc: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(217, 230, 218, 0.45)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
  },
  previewThumb: {
    width: 46,
    height: 46,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewThumbEmpty: { borderWidth: 1, borderColor: 'rgba(21, 66, 18, 0.1)' },
  previewBody: { flex: 1 },
  previewTitle: { ...Typography.labelMd, color: Colors.onSurface, fontWeight: '700' },
  previewMeta: { ...Typography.bodySm, color: Colors.onSurfaceVariant, fontSize: 11, marginTop: 2 },
  bottomBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: Spacing.margin,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(21, 66, 18, 0.07)',
  },
  backButton: {
    paddingHorizontal: 22,
    paddingVertical: 15,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: { ...Typography.labelLg, color: Colors.primary, fontWeight: '700' },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: 15,
  },
  primaryButtonDisabled: { opacity: 0.65 },
  primaryButtonText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
    fontWeight: '700',
  },
  successSafeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  successBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  successIconWrap: {
    width: 128,
    height: 128,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  successTitle: {
    ...Typography.displayLg,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  successSubtitle: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: Spacing.xs,
    maxWidth: 320,
  },
  successItemTitle: {
    ...Typography.labelLg,
    color: Colors.primary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  successActions: {
    alignSelf: 'stretch',
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  successPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: 16,
  },
  successPrimaryText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
    fontWeight: '700',
  },
  successSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingVertical: 15,
  },
  successSecondaryText: {
    ...Typography.labelLg,
    color: Colors.primary,
    fontWeight: '700',
  },
  successLink: {
    ...Typography.labelLg,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
});
