import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { Colors } from '../../constants/colors';
import { BorderRadius, Shadows } from '../../constants/theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const SLOT_COUNT = 5;
const BAR_HEIGHT = 66;
/** How far the bar travels when it tucks away for the Trade flow / keyboard. */
const HIDDEN_OFFSET = 140;

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

interface TabMeta {
  icon: IconName;
  label: string;
  a11y: string;
}

const TAB_META: Record<string, TabMeta> = {
  index: { icon: 'home', label: 'Home', a11y: 'Home' },
  search: { icon: 'search', label: 'Search', a11y: 'Search' },
  post: { icon: 'add', label: 'Trade', a11y: 'Create a listing' },
  messages: { icon: 'forum', label: 'Chat', a11y: 'Chat' },
  profile: { icon: 'person', label: 'Profile', a11y: 'Profile' },
};

interface AnimatedTabBarProps extends BottomTabBarProps {
  /** Total unread messages, surfaced as a badge on the Chat tab. */
  unreadCount?: number;
}

/**
 * Floating, pill-shaped tab bar with a sliding active highlight.
 *
 * Replaces the stock bar so navigation can feel alive: the highlight glides
 * between tabs, icons spring on focus, taps give a small squish, and the centre
 * action bounces. Everything respects the OS reduce-motion setting, and the bar
 * slides out of the way for the full-screen Trade flow and the keyboard.
 */
export function AnimatedTabBar({
  state,
  descriptors,
  navigation,
  insets,
  unreadCount = 0,
}: AnimatedTabBarProps) {
  const reducedMotion = useReducedMotion();
  const [barWidth, setBarWidth] = useState(0);
  const slotWidth = barWidth / SLOT_COUNT;

  const focusedName = state.routes[state.index]?.name ?? 'index';

  // The keyboard hides the bar so it never sits on top of the inputs.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // The Trade screen is a full-screen flow with its own header, so tuck the bar.
  const hidden = focusedName === 'post' || keyboardOpen;

  const [hideProgress] = useState(() => new Animated.Value(hidden ? 1 : 0));
  useEffect(() => {
    if (reducedMotion) {
      hideProgress.setValue(hidden ? 1 : 0);
      return;
    }
    Animated.timing(hideProgress, {
      toValue: hidden ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [hidden, hideProgress, reducedMotion]);

  const translateY = hideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, HIDDEN_OFFSET],
  });
  const opacity = hideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  // A single highlight travels between the four regular tabs.
  const [pillIndex] = useState(() => new Animated.Value(state.index));
  useEffect(() => {
    if (reducedMotion) {
      pillIndex.setValue(state.index);
      return;
    }
    Animated.spring(pillIndex, {
      toValue: state.index,
      speed: 16,
      bounciness: 9,
      useNativeDriver: true,
    }).start();
  }, [state.index, pillIndex, reducedMotion]);

  const pillTranslateX = useMemo(
    () => Animated.multiply(pillIndex, slotWidth || 1),
    [pillIndex, slotWidth],
  );

  return (
    <Animated.View
      style={[
        styles.bar,
        { bottom: insets.bottom + 8, transform: [{ translateY }], opacity },
      ]}
      pointerEvents={hidden ? 'none' : 'box-none'}
    >
      <View
        style={styles.barInner}
        onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
      >
        {slotWidth > 0 && (
          <Animated.View
            style={[
              styles.pill,
              {
                width: Math.max(slotWidth - 12, 0),
                transform: [{ translateX: pillTranslateX }],
              },
            ]}
          />
        )}

        {state.routes.map((route, index) => {
          const meta = TAB_META[route.name] ?? {
            icon: 'circle' as IconName,
            label: route.name,
            a11y: route.name,
          };
          const options = descriptors[route.key]?.options;
          const label = typeof options?.title === 'string' ? options.title : meta.label;
          const focused = state.index === index;

          const handlePress = () => {
            if (focused) return;
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };
          const handleLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          if (route.name === 'post') {
            return (
              <CenterAction
                key={route.key}
                onPress={handlePress}
                onLongPress={handleLongPress}
                reducedMotion={reducedMotion}
              />
            );
          }

          const badge = route.name === 'messages' ? unreadCount : 0;

          return (
            <TabButton
              key={route.key}
              icon={meta.icon}
              label={label}
              a11yLabel={badge > 0 ? `${label}, ${badge} unread` : meta.a11y}
              badge={badge}
              focused={focused}
              onPress={handlePress}
              onLongPress={handleLongPress}
              reducedMotion={reducedMotion}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

interface TabButtonProps {
  icon: IconName;
  label: string;
  a11yLabel: string;
  badge: number;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  reducedMotion: boolean;
}

function TabButton({
  icon,
  label,
  a11yLabel,
  badge,
  focused,
  onPress,
  onLongPress,
  reducedMotion,
}: TabButtonProps) {
  const [press] = useState(() => new Animated.Value(0));
  const [focus] = useState(() => new Animated.Value(focused ? 1 : 0));
  const [badgeScale] = useState(() => new Animated.Value(badge > 0 ? 1 : 0));

  useEffect(() => {
    if (reducedMotion) {
      focus.setValue(focused ? 1 : 0);
      return;
    }
    Animated.spring(focus, {
      toValue: focused ? 1 : 0,
      speed: 20,
      bounciness: 10,
      useNativeDriver: true,
    }).start();
  }, [focused, focus, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) {
      badgeScale.setValue(badge > 0 ? 1 : 0);
      return;
    }
    Animated.spring(badgeScale, {
      toValue: badge > 0 ? 1 : 0,
      speed: 18,
      bounciness: 12,
      useNativeDriver: true,
    }).start();
  }, [badge, badgeScale, reducedMotion]);

  const iconScale = focus.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const iconLift = focus.interpolate({ inputRange: [0, 1], outputRange: [0, -1] });
  const pressScale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] });

  const handlePressIn = () => {
    if (reducedMotion) return;
    Animated.spring(press, {
      toValue: 1,
      speed: 40,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = () => {
    if (reducedMotion) return;
    Animated.spring(press, {
      toValue: 0,
      speed: 18,
      bounciness: 10,
      useNativeDriver: true,
    }).start();
  };

  const color = focused ? Colors.primary : Colors.onSecondaryContainer;

  return (
    <Pressable
      style={styles.slot}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={a11yLabel}
      hitSlop={4}
    >
      <Animated.View style={[styles.tabContent, { transform: [{ scale: pressScale }] }]}>
        <Animated.View style={{ transform: [{ scale: iconScale }, { translateY: iconLift }] }}>
          <MaterialIcons name={icon} size={22} color={color} />
          {badge > 0 && (
            <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
              <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
            </Animated.View>
          )}
        </Animated.View>
        <Text
          style={[styles.tabLabel, { color }, focused && styles.tabLabelActive]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

interface CenterActionProps {
  onPress: () => void;
  onLongPress: () => void;
  reducedMotion: boolean;
}

function CenterAction({ onPress, onLongPress, reducedMotion }: CenterActionProps) {
  const [press] = useState(() => new Animated.Value(0));
  const [breathe] = useState(() => new Animated.Value(0));
  const [halo] = useState(() => new Animated.Value(0));
  const [spin] = useState(() => new Animated.Value(0));

  // Idle life for the primary action: a slow breath so it feels awake, and a
  // ring that pings outward like a sonar blip to invite a tap.
  useEffect(() => {
    if (reducedMotion) return;

    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const haloLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, {
          toValue: 0.18,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(halo, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(halo, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(200),
      ]),
    );

    breatheLoop.start();
    haloLoop.start();
    return () => {
      breatheLoop.stop();
      haloLoop.stop();
    };
  }, [breathe, halo, reducedMotion]);

  const pressScale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] });
  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const scale = Animated.multiply(pressScale, breatheScale);

  // A full turn returns the exchange arrows to where they started, so the spin
  // reads as a satisfying "swap" and resets invisibly.
  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const haloScale = halo.interpolate({
    inputRange: [0, 0.18, 1],
    outputRange: [1, 1.12, 1.8],
  });
  const haloOpacity = halo.interpolate({
    inputRange: [0, 0.18, 1],
    outputRange: [0, 0.4, 0],
  });

  const handlePressIn = () => {
    if (reducedMotion) return;
    Animated.spring(press, {
      toValue: 1,
      speed: 40,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
    Animated.timing(spin, {
      toValue: 1,
      duration: 420,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) spin.setValue(0);
    });
  };
  const handlePressOut = () => {
    if (reducedMotion) return;
    Animated.spring(press, {
      toValue: 0,
      speed: 16,
      bounciness: 14,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.slot} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel="Trade — create a listing"
        style={styles.fabHit}
      >
        <View style={styles.fabAnchor}>
          {!reducedMotion && (
            <Animated.View
              pointerEvents="none"
              style={[styles.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]}
            />
          )}
          <Animated.View
            style={[styles.fab, { transform: [{ scale }, { rotate: spinDeg }] }]}
          >
            <MaterialIcons name="swap-horiz" size={27} color={Colors.onTertiary} />
          </Animated.View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
  },
  barInner: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.08)',
    ...Shadows.elevated,
  },
  pill: {
    position: 'absolute',
    top: 6,
    left: 0,
    marginLeft: 6,
    height: BAR_HEIGHT - 12,
    borderRadius: 18,
    backgroundColor: Colors.secondaryContainer,
  },
  slot: {
    flex: 1,
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -11,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: Colors.onTertiary,
    fontSize: 9,
    fontWeight: '700',
  },
  fabAnchor: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.tertiary,
  },
  fabHit: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.tertiary,
    borderWidth: 4,
    borderColor: Colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.elevated,
  },
});