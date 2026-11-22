import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
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
        tabBarInactiveTintColor: Colors.onSecondaryContainer,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="home" size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="search" size={26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="post"
        options={{
          title: 'Trade',
          tabBarStyle: { display: 'none' },
          tabBarIcon: () => (
            <View style={styles.tradeTab}>
              <View style={[styles.centerPostButton, Shadows.elevated]}>
                <MaterialIcons name="add" size={24} color={Colors.onTertiary} />
              </View>
              <Text style={styles.tradeLabel}>Trade</Text>
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />

      <Tabs.Screen
        name="messages"
        options={{
          title: 'Chat',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: styles.badge,
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="forum" size={23} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="person" size={24} color={color} />
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
    borderTopWidth: 0,
    height: Platform.OS === 'ios' ? 88 : 68,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    ...Shadows.tabBar,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  centerPostButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tradeTab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginTop: -10,
  },
  tradeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
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
