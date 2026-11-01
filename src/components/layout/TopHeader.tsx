import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing } from '../../constants/theme';

interface TopHeaderProps {
  districtName?: string;
  avatarUrl?: string;
  unreadNotifications?: number;
  onPressLocation?: () => void;
  onPressNotifications?: () => void;
  onPressProfile?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  districtName = 'Dhanmondi, Dhaka',
  avatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  unreadNotifications = 0,
  onPressLocation,
  onPressNotifications,
  onPressProfile,
}) => {
  return (
    <View style={styles.header}>
      {/* Location Picker Pill */}
      <TouchableOpacity
        style={styles.locationButton}
        onPress={onPressLocation}
        activeOpacity={0.7}
      >
        <MaterialIcons name="location-on" size={18} color={Colors.primary} />
        <Text style={styles.locationText} numberOfLines={1}>
          {districtName}
        </Text>
        <MaterialIcons name="keyboard-arrow-down" size={16} color={Colors.primary} />
      </TouchableOpacity>

      {/* Brand Title in Center */}
      <View style={styles.brandContainer}>
        <Text style={styles.brandTitle}>Puran Haat</Text>
        <Text style={styles.brandSubtitle}>পুরান হাট</Text>
      </View>

      {/* Right Controls: Notifications & Profile */}
      <View style={styles.rightActions}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onPressNotifications}
          activeOpacity={0.7}
        >
          <MaterialIcons name="notifications-none" size={22} color={Colors.primary} />
          {unreadNotifications > 0 && (
            <View style={styles.notificationDot}>
              <Text style={styles.dotText}>{unreadNotifications}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.avatarButton}
          onPress={onPressProfile}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatar}
            contentFit="cover"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.margin,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(21, 66, 18, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    maxWidth: 130,
  },
  locationText: {
    ...Typography.labelMd,
    color: Colors.primary,
    fontSize: 11,
  },
  brandContainer: {
    alignItems: 'center',
  },
  brandTitle: {
    ...Typography.headlineSm,
    color: Colors.primary,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 10,
    color: Colors.primaryContainer,
    fontWeight: '600',
    marginTop: -2,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(21, 66, 18, 0.06)',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.tertiary,
    borderRadius: BorderRadius.full,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  dotText: {
    color: Colors.onTertiary,
    fontSize: 9,
    fontWeight: '700',
  },
  avatarButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: Colors.primaryFixed,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
});
