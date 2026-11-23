import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { Colors } from '../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { markOnboardingSeen } from '../lib/onboarding';

interface OnboardingStep {
  key: 'trade' | 'points' | 'impact' | 'trust';
  eyebrow?: string;
  title: string;
  subtitle?: string;
  body: string;
}

const STEPS: OnboardingStep[] = [
  {
    key: 'trade',
    title: 'Trade Your Unused Items',
    subtitle: "Give your items a second life. Trade, don't toss.",
    body: 'Join a community where your household goods find new life. Exchange what you no longer need and keep useful things in circulation.',
  },
  {
    key: 'points',
    title: 'Earn Eco-Points',
    subtitle: 'Every trade adds up.',
    body: 'Each completed trade earns you 50 Eco-Points, so your good decisions add up. Your points are a simple record of the impact you make in your community.',
  },
  {
    key: 'impact',
    eyebrow: 'Your sustainability journey',
    title: 'Track Your Impact',
    body: 'Every listing shows the CO₂ it keeps out of the air and how it rates for eco impact, so you can see the difference your swaps make.',
  },
  {
    key: 'trust',
    title: 'Trusted Community',
    body: 'Verify your email to unlock trading and build trust with your neighbours. Safety comes first — every trade happens between real, verified people.',
  },
];

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const listRef = useRef<FlatList<OnboardingStep>>(null);
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const isLast = index === STEPS.length - 1;

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(STEPS.length - 1, next));
      setIndex(clamped);
      listRef.current?.scrollToOffset({ offset: clamped * width, animated: true });
    },
    [width],
  );

  const onScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      setIndex(Math.max(0, Math.min(STEPS.length - 1, next)));
    },
    [width],
  );

  const finish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    await markOnboardingSeen();
    // New visitors go straight to sign in / sign up; an already signed-in user
    // (e.g. replaying the intro) just continues to the app.
    router.replace((user ? '/' : '/auth') as never);
  }, [finishing, user]);

  const primaryLabel = isLast ? 'Get Started' : 'Next';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        {index > 0 ? (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => goTo(index - 1)}
            accessibilityLabel="Go back"
          >
            <MaterialIcons name="arrow-back" size={22} color={Colors.onSurfaceVariant} />
          </TouchableOpacity>
        ) : (
          <View style={styles.brand}>
            <MaterialIcons name="eco" size={24} color={Colors.primary} />
            <Text style={styles.brandText}>Puran Haat</Text>
          </View>
        )}

        {!isLast ? (
          <TouchableOpacity
            onPress={finish}
            disabled={finishing}
            accessibilityRole="button"
            accessibilityLabel="Skip intro"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <FlatList
        ref={listRef}
        data={STEPS}
        keyExtractor={(step) => step.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View style={{ width }}>
            <ScrollView
              contentContainerStyle={styles.page}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.visualArea}>
                {item.key === 'trade' && <TradeVisual />}
                {item.key === 'points' && <PointsVisual />}
                {item.key === 'impact' && <ImpactVisual />}
                {item.key === 'trust' && <TrustVisual />}
              </View>

              <View style={styles.copyArea}>
                {item.eyebrow ? <Text style={styles.eyebrow}>{item.eyebrow}</Text> : null}
                <Text style={styles.title}>{item.title}</Text>
                {item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null}
                <Text style={styles.body}>{item.body}</Text>
              </View>
            </ScrollView>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots} accessibilityLabel={`Step ${index + 1} of ${STEPS.length}`}>
          {STEPS.map((step, i) => (
            <View key={step.key} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, finishing && styles.primaryButtonBusy]}
          onPress={isLast ? finish : () => goTo(index + 1)}
          disabled={finishing}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
        >
          <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
          {isLast && (
            <MaterialIcons name="arrow-forward" size={20} color={Colors.onPrimary} />
          )}
        </TouchableOpacity>

        {!isLast && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={finish}
            disabled={finishing}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>
              {index === 0 ? 'Skip intro' : 'Skip'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function TradeVisual() {
  return (
    <View style={[styles.heroCard, Shadows.card]}>
      <View style={[styles.floatChip, styles.chipTopLeft]}>
        <MaterialIcons name="chair" size={20} color={Colors.primary} />
      </View>
      <View style={[styles.floatChip, styles.chipBottomRight]}>
        <MaterialIcons name="devices" size={20} color={Colors.tertiary} />
      </View>
      <View style={styles.heroCenter}>
        <MaterialIcons name="handshake" size={54} color={Colors.primary} />
      </View>
    </View>
  );
}

function PointsVisual() {
  return (
    <View style={styles.ringWrap}>
      <View style={styles.dashedRing} />
      <View style={[styles.ringCenter, Shadows.card]}>
        <MaterialIcons name="savings" size={58} color={Colors.primary} />
      </View>
      <View style={[styles.floatChip, styles.chipTopRight]}>
        <MaterialIcons name="stars" size={22} color={Colors.primary} />
      </View>
      <View style={[styles.floatChip, styles.chipBottomLeft]}>
        <MaterialIcons name="recycling" size={20} color={Colors.tertiary} />
      </View>
      <View style={[styles.floatChip, styles.chipMidLeft]}>
        <MaterialIcons name="eco" size={20} color={Colors.primary} />
      </View>
    </View>
  );
}

function ImpactVisual() {
  const cards = [
    { icon: 'eco' as const, label: 'CO₂ saved', hint: 'Shown on every listing', tint: Colors.primary },
    { icon: 'recycling' as const, label: 'Items traded', hint: 'Counted after each swap', tint: Colors.secondary },
    { icon: 'energy-savings-leaf' as const, label: 'Eco impact', hint: 'Rated low to high', tint: Colors.tertiary },
  ];

  return (
    <View style={styles.impactWrap}>
      {cards.map((card) => (
        <View key={card.label} style={[styles.impactCard, Shadows.card]}>
          <View style={[styles.impactIcon, { backgroundColor: withAlpha(card.tint, 0.1) }]}>
            <MaterialIcons name={card.icon} size={20} color={card.tint} />
          </View>
          <View style={styles.impactText}>
            <Text style={styles.impactLabel}>{card.label}</Text>
            <Text style={styles.impactHint}>{card.hint}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function TrustVisual() {
  return (
    <View style={styles.trustWrap}>
      <View style={styles.trustHalo} />
      <View style={[styles.trustCircle, Shadows.elevated]}>
        <MaterialIcons name="verified-user" size={86} color={Colors.primary} />
      </View>
    </View>
  );
}

/** Converts a #rrggbb token into an rgba() string with the given opacity. */
function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.margin,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandText: { ...Typography.headlineSm, color: Colors.primary, fontWeight: '700' },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(21,66,18,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: { ...Typography.labelLg, color: Colors.primary, fontWeight: '700' },
  headerSpacer: { width: 38 },

  page: {
    flexGrow: 1,
    paddingHorizontal: Spacing.margin,
    paddingBottom: Spacing.xs,
  },
  visualArea: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    minHeight: 300,
  },
  copyArea: { alignItems: 'center', paddingBottom: Spacing.xs },
  eyebrow: {
    ...Typography.labelMd,
    color: Colors.outline,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.displayLg,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.headlineSm,
    color: Colors.primary,
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  body: {
    ...Typography.bodyLg,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 23,
    maxWidth: 340,
  },

  // Step 1 — trade
  heroCard: {
    width: 272,
    height: 272,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(21,66,18,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCenter: {
    width: 132,
    height: 132,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipTopLeft: { top: 20, left: 20 },
  chipBottomRight: { bottom: 20, right: 20 },
  chipTopRight: { top: 14, right: 24 },
  chipBottomLeft: { bottom: 34, left: 10 },
  chipMidLeft: { top: '44%', left: -8 },

  // Step 2 — points
  ringWrap: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedRing: {
    position: 'absolute',
    width: 264,
    height: 264,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.primaryFixedDim,
    opacity: 0.7,
  },
  ringCenter: {
    width: 176,
    height: 176,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(21,66,18,0.06)',
  },
  floatChip: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(21,66,18,0.06)',
  },

  // Step 3 — impact
  impactWrap: { width: '100%', maxWidth: 360, gap: 10 },
  impactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(21,66,18,0.06)',
    padding: Spacing.sm,
  },
  impactIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  impactText: { flex: 1 },
  impactLabel: { ...Typography.labelLg, color: Colors.onSurface, fontWeight: '700' },
  impactHint: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 1 },

  // Step 4 — trust
  trustWrap: { alignItems: 'center', justifyContent: 'center', width: 280, height: 280 },
  trustHalo: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: BorderRadius.full,
    backgroundColor: withAlpha(Colors.primary, 0.06),
  },
  trustCircle: {
    width: 196,
    height: 196,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(21,66,18,0.06)',
  },

  // Footer
  footer: {
    paddingHorizontal: Spacing.margin,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.outlineVariant,
  },
  dotActive: { width: 26, backgroundColor: Colors.primary },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: 15,
  },
  primaryButtonBusy: { opacity: 0.7 },
  primaryButtonText: { ...Typography.headlineSm, color: Colors.onPrimary, fontWeight: '700' },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingVertical: 13,
  },
  secondaryButtonText: { ...Typography.labelLg, color: Colors.primary, fontWeight: '700' },
});