import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { useLocation } from '../../context/LocationContext';

interface TopHeaderProps {
  /** Overrides the area shown in the pill; defaults to the active location. */
  districtName?: string;
  avatarUrl?: string;
  unreadNotifications?: number;
  showNotifications?: boolean;
  onPressLocation?: () => void;
  onPressNotifications?: () => void;
  onPressProfile?: () => void;
}

/**
 * Puran Haat app bar.
 *
 * The home mockup keeps the brand centred with the location picker on the
 * left and the signed-in trader's avatar on the right. Discover swaps the
 * avatar for the notification bell, so both arrangements are supported here.
 *
 * The left side is a pill rather than a bare pin: the area you are browsing is
 * the single biggest filter in the app, so it should be readable, and tapping
 * it opens the picker from wherever you are.
 */
export const TopHeader: React.FC<TopHeaderProps> = ({
  districtName,
  avatarUrl,
  unreadNotifications = 0,
  showNotifications = false,
  onPressLocation,
  onPressNotifications,
  onPressProfile,
}) => {
  const { isOffline } = useApp();
  const { location, detecting, hydrated } = useLocation();

  const label = districtName ?? location?.label ?? null;
  // "Dhanmondi, Dhaka" is too long for the app bar; the locality is the useful half.
  const shortLabel = label ? label.split(',')[0] : null;
  const openPicker = onPressLocation ?? (() => router.push('/location' as never));
  const pillLabel = detecting
    ? 'Locating…'
    : shortLabel ?? (hydrated ? 'Set area' : 'Loading…');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.locationPill, !shortLabel && styles.locationPillEmpty]}
          onPress={openPicker}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={
            shortLabel
              ? `Change location, currently ${label}`
              : 'Set your location area'
          }
          accessibilityState={{ busy: detecting }}
        >
          <MaterialIcons
            name={location?.source === 'gps' ? 'my-location' : 'location-on'}
            size={17}
            color={shortLabel ? Colors.primary : Colors.onSurfaceVariant}
          />
          <Text
            style={[styles.locationText, !shortLabel && styles.locationTextEmpty]}
            numberOfLines={1}
          >
            {pillLabel}
          </Text>
          <MaterialIcons name="expand-more" size={15} color={Colors.onSurfaceVariant} />
        </TouchableOpacity>

        <Text style={styles.brandTitle} numberOfLines={1}>
          Puran Haat
        </Text>

        <View style={styles.rightSlot}>
          {showNotifications ? (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onPressNotifications}
              activeOpacity={0.7}
              accessibilityLabel="Open notifications"
            >
              <MaterialIcons name="notifications-none" size={23} color={Colors.primary} />
              {unreadNotifications > 0 && <View style={styles.notificationDot} />}
            </TouchableOpacity>
          ) : onPressProfile ? (
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={onPressProfile}
              activeOpacity={0.7}
              accessibilityLabel="Open profile"
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={styles.avatarFallback}>
                  <MaterialIcons name="person" size={21} color={Colors.primary} />
                </View>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {isOffline && (
        <View
          style={styles.offlineBar}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <MaterialIcons name="cloud-off" size={15} color={Colors.onSecondaryContainer} />
          <Text style={styles.offlineText}>
            You&apos;re offline — showing saved listings
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.margin,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    maxWidth: 132,
    paddingLeft: 8,
    paddingRight: 4,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.secondaryContainer,
  },
  locationPillEmpty: {
    backgroundColor: Colors.surfaceContainer,
  },
  locationText: {
    ...Typography.labelMd,
    color: Colors.primary,
    flexShrink: 1,
  },
  locationTextEmpty: {
    color: Colors.onSurfaceVariant,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  brandTitle: {
    flex: 1,
    textAlign: 'center',
    ...Typography.headlineSm,
    color: Colors.primary,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  rightSlot: {
    width: 40,
    height: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.tertiary,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.secondaryContainer,
  },
  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.margin,
    paddingVertical: 6,
    backgroundColor: Colors.secondaryContainer,
  },
  offlineText: {
    ...Typography.labelMd,
    color: Colors.onSecondaryContainer,
  },
});
