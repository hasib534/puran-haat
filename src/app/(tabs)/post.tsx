import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../../constants/theme';
import { MOCK_CATEGORIES } from '../../data/mock-items';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { AuthGate } from '../../components/auth/AuthGate';
import { ConditionType, Item, TradeModeType } from '../../types';

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
  const { addItem, profile } = useApp();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('furniture');
  const [condition, setCondition] = useState<ConditionType>('like_new');
  const [tradeMode, setTradeMode] = useState<TradeModeType>('trade');
  const [wishlist, setWishlist] = useState('');
  const [locationName, setLocationName] = useState('Dhanmondi, Dhaka');

  const handleSubmitListing = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for your item.');
      return;
    }

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
      images: [
        'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=800&q=80',
      ],
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

    setSubmitting(true);
    try {
      await addItem(newItem);
      Alert.alert(
        'Item Published!',
        `"${title}" is now live on Puran Haat! Nearby traders in ${locationName} will be able to see your listing.`,
        [
          {
            text: 'View in Haat Feed',
            onPress: () => router.push('/(tabs)' as never),
          },
        ],
      );
      setTitle('');
      setDescription('');
      setWishlist('');
    } catch (error) {
      Alert.alert('Could not publish listing', (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Post an Item</Text>
        <Text style={styles.headerSubtitle}>পুরান জিনিস দিন, নতুন গল্প নিন</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Photo Upload Card */}
        <View style={styles.section}>
          <Text style={styles.label}>Photos (ছবি যুক্ত করুন)</Text>
          <TouchableOpacity
            style={styles.photoUploadBox}
            onPress={() => Alert.alert('Add Photos', 'Choose from Camera or Photo Gallery.')}
            activeOpacity={0.8}
          >
            <View style={styles.cameraCircle}>
              <MaterialIcons name="add-a-photo" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.uploadPrompt}>Tap to add up to 5 photos</Text>
            <Text style={styles.uploadSubtext}>JPG, PNG • Good natural lighting recommended</Text>
          </TouchableOpacity>
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.label}>Item Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Vintage Teak Dining Chair, Pottery Set..."
            placeholderTextColor={Colors.outline}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Category Selector */}
        <View style={styles.section}>
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {MOCK_CATEGORIES.filter((c) => c.id !== 'all').map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <MaterialIcons
                    name={cat.icon as any}
                    size={16}
                    color={isSelected ? Colors.onPrimaryContainer : Colors.onSecondaryContainer}
                  />
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Condition Selector */}
        <View style={styles.section}>
          <Text style={styles.label}>Condition (অবস্থা)</Text>
          <View style={styles.pillRow}>
            {(
              [
                { id: 'brand_new', label: 'Brand New' },
                { id: 'like_new', label: 'Like New' },
                { id: 'gently_used', label: 'Gently Used' },
                { id: 'fair', label: 'Fair' },
              ] as const
            ).map((cond) => {
              const isSelected = condition === cond.id;
              return (
                <TouchableOpacity
                  key={cond.id}
                  style={[styles.conditionPill, isSelected && styles.conditionPillActive]}
                  onPress={() => setCondition(cond.id)}
                >
                  <Text style={[styles.conditionText, isSelected && styles.conditionTextActive]}>
                    {cond.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Trade Mode Selector */}
        <View style={styles.section}>
          <Text style={styles.label}>Exchange Mode (বিনিময় ধরণ)</Text>
          <View style={styles.modeContainer}>
            <TouchableOpacity
              style={[styles.modeCard, tradeMode === 'trade' && styles.modeCardActive]}
              onPress={() => setTradeMode('trade')}
            >
              <MaterialIcons name="swap-horiz" size={24} color={tradeMode === 'trade' ? Colors.primary : Colors.secondary} />
              <Text style={[styles.modeCardTitle, tradeMode === 'trade' && styles.modeCardTitleActive]}>
                Direct Barter
              </Text>
              <Text style={styles.modeCardDesc}>Swap for another item or small adjustment</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeCard, tradeMode === 'free' && styles.modeCardActive]}
              onPress={() => setTradeMode('free')}
            >
              <MaterialIcons name="volunteer-activism" size={24} color={tradeMode === 'free' ? Colors.tertiary : Colors.secondary} />
              <Text style={[styles.modeCardTitle, tradeMode === 'free' && styles.modeCardTitleActive]}>
                Free Gift
              </Text>
              <Text style={styles.modeCardDesc}>Give away to community member in need</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Barter Wishlist */}
        {tradeMode === 'trade' && (
          <View style={styles.section}>
            <Text style={styles.label}>What would you like in return? (ঐচ্ছিক চাওয়া)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Books, table lamp, gardening tools..."
              placeholderTextColor={Colors.outline}
              value={wishlist}
              onChangeText={setWishlist}
            />
          </View>
        )}

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.label}>Pickup Location</Text>
          <TextInput
            style={styles.input}
            placeholder="Dhanmondi, Mirpur, TSC..."
            placeholderTextColor={Colors.outline}
            value={locationName}
            onChangeText={setLocationName}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            numberOfLines={4}
            placeholder="Describe history, flaws, or why you are giving it away..."
            placeholderTextColor={Colors.outline}
            value={description}
            onChangeText={setDescription}
          />
        </View>

        {/* Submit Action */}
        <TouchableOpacity
          style={[styles.submitButton, Shadows.elevated, submitting && { opacity: 0.7 }]}
          onPress={handleSubmitListing}
          disabled={submitting}
          activeOpacity={0.88}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.onPrimary} />
          ) : (
            <MaterialIcons name="check" size={22} color={Colors.onPrimary} />
          )}
          <Text style={styles.submitButtonText}>
            {submitting ? 'Publishing…' : 'Publish to Puran Haat'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.margin,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  headerTitle: {
    ...Typography.headlineMd,
    color: Colors.primary,
  },
  headerSubtitle: {
    ...Typography.bodySm,
    color: Colors.primaryContainer,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: Spacing.margin,
    paddingBottom: 100,
  },
  section: {
    marginTop: Spacing.md,
  },
  label: {
    ...Typography.labelMd,
    color: Colors.onSurface,
    marginBottom: 6,
  },
  photoUploadBox: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 2,
    borderColor: 'rgba(21, 66, 18, 0.15)',
    borderStyle: 'dashed',
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraCircle: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  uploadPrompt: {
    ...Typography.labelLg,
    color: Colors.primary,
  },
  uploadSubtext: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    marginTop: 2,
  },
  input: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    ...Typography.bodyMd,
    color: Colors.onSurface,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  chipRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.secondaryContainer,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  chipActive: {
    backgroundColor: Colors.primaryContainer,
  },
  chipText: {
    ...Typography.labelSm,
    color: Colors.onSecondaryContainer,
  },
  chipTextActive: {
    color: Colors.onPrimaryContainer,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conditionPill: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  conditionPillActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(45, 90, 39, 0.1)',
  },
  conditionText: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
  },
  conditionTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  modeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  modeCard: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  modeCardActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(45, 90, 39, 0.06)',
  },
  modeCardTitle: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    marginTop: 6,
    marginBottom: 2,
  },
  modeCardTitleActive: {
    color: Colors.primary,
  },
  modeCardDesc: {
    fontSize: 10,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.xl,
  },
  submitButtonText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
    fontWeight: '700',
  },
});
