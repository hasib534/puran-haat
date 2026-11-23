import React from 'react';
import { Tabs } from 'expo-router/js-tabs';

import { AnimatedTabBar } from '../../components/navigation/AnimatedTabBar';
import { useApp } from '../../context/AppContext';

export default function TabLayout() {
  const { conversations } = useApp();
  const unreadCount = conversations.reduce((sum, c) => sum + (c.unread || 0), 0);

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      // A single shared bar renders every tab so the active highlight can slide
      // between them and the Trade action can sit raised in the middle.
      tabBar={(props) => <AnimatedTabBar {...props} unreadCount={unreadCount} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="post" options={{ title: 'Trade' }} />
      <Tabs.Screen name="messages" options={{ title: 'Chat' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}