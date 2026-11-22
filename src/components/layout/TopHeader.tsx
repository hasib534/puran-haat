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
 */
export const TopHeader: React.FC<TopHeaderProps> = ({
  districtName = 'Dhanmondi, Dhaka',
  avatarUrl,
  unreadNotifications = 0,
  showNotifications = false,
  onPressLocation,
  onPressNotifications,
  onPressProfile,
}) => {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onPressLocation}
        activeOpacity={0.7}
        accessibilityLabel={`Change location, currently ${districtName}`}
      >
        <MaterialIcons name="location-on" size={23} color={Colors.primary} />
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
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.margin,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
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
});
