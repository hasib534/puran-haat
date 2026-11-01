import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '../../constants/colors';
import { BorderRadius, Shadows } from '../../constants/theme';
import { useApp } from '../../context/AppContext';

export default function TabLayout() {
  const { conversations } = useApp();
  const unreadCount = conversations.reduce((sum, c) => sum + (c.unread || 0), 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.secondary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      {/* Tab 1: Home Feed */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="storefront" size={size || 24} color={color} />
          ),
        }}
      />

      {/* Tab 2: Discover / Search */}
      <Tabs.Screen
        name="search"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="search" size={size || 24} color={color} />
          ),
        }}
      />

      {/* Tab 3: Post an Item (Elevated Center Action) */}
      <Tabs.Screen
        name="post"
        options={{
          title: 'Post',
          tabBarIcon: () => (
            <View style={[styles.centerPostButton, Shadows.elevated]}>
              <MaterialIcons name="add" size={28} color={Colors.onPrimary} />
            </View>
          ),
          tabBarLabel: () => null, // Hide text for elevated center button
        }}
      />

      {/* Tab 4: Messages / Inbox */}
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Chats',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: styles.badge,
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="chat-bubble-outline" size={size || 22} color={color} />
          ),
        }}
      />

      {/* Tab 5: Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="eco" size={size || 24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surfaceContainer,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(21, 66, 18, 0.08)',
    height: Platform.OS === 'ios' ? 88 : 68,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 8,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  centerPostButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    top: -14,
  },
  badge: {
    backgroundColor: Colors.tertiary,
    color: Colors.onTertiary,
    fontSize: 10,
    fontWeight: '700',
    minWidth: 16,
    height: 16,
  },
});
