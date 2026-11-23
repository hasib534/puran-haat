import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../../constants/theme';
import { useLocation } from '../../context/LocationContext';

export type FeedSort = 'newest' | 'nearest';

interface LocationBarProps {
  /** Current feed ordering, when the screen offers the choice. */
  sort?: FeedSort;
  onSortChange?: (next: FeedSort) => void;
}

/**
 * The location row under the app bar.
 *
 * Doubles as the soft ask: until the user has an area it invites them to pick
 * one, and afterwards it shows exactly which area and radius the feed is using
 * so "2.4 km away" is never a mystery.
 */
export const LocationBar: React.FC<LocationBarProps> = ({ sort, onSortChange }) => {
  const {
    location,
    radiusLabel,
    detecting,
    hydrated,
    promptDismissed,
    dismissPrompt,
  } = useLocation();

  const openPicker = () => router.push('/location' as never);

  if (detecting) {
    return (
      <View style={[styles.bar, styles.barMuted]}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.detectingText}>Finding your area…</Text>
      </View>
    );
  }

  if (!location) {
    if (!hydrated || promptDismissed) return null;
    return (
      <View style={[styles.askCard, Shadows.card]}>
        <View style={styles.askIcon}>
          <MaterialIcons name="near-me" size={20} color={Colors.primary} />
        </View>
        <View style={styles.askBody}>
          <Text style={styles.askTitle}>See what&apos;s nearby</Text>
          <Text style={styles.askHint} numberOfLines={2}>
            Share your area to sort listings by distance and skip the guesswork.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.askButton}
          onPress={openPicker}
          accessibilityRole="button"
          accessibilityLabel="Choose your area"
        >
          <Text style={styles.askButtonText}>Choose</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={dismissPrompt}
          hitSlop={8}
          accessibilityLabel="Dismiss nearby listings prompt"
        >
          <MaterialIcons name="close" size={16} color={Colors.outline} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.bar, Shadows.card]}>
      <TouchableOpacity
        style={styles.chip}
        onPress={openPicker}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`Change area, currently ${location.label}`}
      >
        <MaterialIcons
          name={location.source === 'gps' ? 'my-location' : 'location-on'}
          size={15}
          color={Colors.primary}
        />
        <Text style={styles.chipText} numberOfLines={1}>
          {location.label}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.chip, styles.chipGhost]}
        onPress={openPicker}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`Change distance, currently ${radiusLabel}`}
      >
        <Text style={styles.chipGhostText} numberOfLines={1}>
          {radiusLabel}
        </Text>
        <MaterialIcons name="expand-more" size={14} color={Colors.onSurfaceVariant} />
      </TouchableOpacity>

      {sort && onSortChange && (
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => onSortChange(sort === 'nearest' ? 'newest' : 'nearest')}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={
            sort === 'nearest' ? 'Sorted by nearest; switch to newest' : 'Sorted by newest; switch to nearest'
          }
        >
          <MaterialIcons
            name={sort === 'nearest' ? 'near-me' : 'schedule'}
            size={16}
            color={Colors.primary}
          />
          <Text style={styles.sortText}>{sort === 'nearest' ? 'Nearest' : 'Newest'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: Spacing.margin,
    marginTop: Spacing.xs,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.08)',
  },
  barMuted: {
    backgroundColor: Colors.secondaryContainer,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
  },
  detectingText: { ...Typography.bodySm, color: Colors.onSecondaryContainer },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.secondaryContainer,
    flexShrink: 1,
  },
  chipText: { ...Typography.labelMd, color: Colors.primary, flexShrink: 1 },
  chipGhost: {
    backgroundColor: 'transparent',
    paddingLeft: 8,
    paddingRight: 2,
  },
  chipGhostText: { ...Typography.labelSm, color: Colors.onSurfaceVariant, fontSize: 11 },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(45, 90, 39, 0.08)',
  },
  sortText: { ...Typography.labelSm, color: Colors.primary, fontSize: 11 },
  askCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.margin,
    marginTop: Spacing.xs,
    padding: 10,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.08)',
  },
  askIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(45, 90, 39, 0.1)',
  },
  askBody: { flex: 1 },
  askTitle: { ...Typography.labelLg, color: Colors.onSurface },
  askHint: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 1 },
  askButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  askButtonText: { ...Typography.labelMd, color: Colors.onPrimary },
});
