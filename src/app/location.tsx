import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { Colors } from '../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { useLocation } from '../context/LocationContext';
import {
  AREAS,
  AREA_CITIES,
  RADIUS_OPTIONS,
  searchAreas,
  type Area,
} from '../lib/geo';
import { openAppSettings, promptForServices } from '../lib/location';

/**
 * Location picker.
 *
 * Presented as a modal from the root stack. It is the single place where the
 * user's place and search radius are decided: GPS for people who grant
 * permission, and a searchable catalogue of real areas for everyone else.
 */
export default function LocationScreen() {
  const {
    location,
    radiusKm,
    setRadiusKm,
    permission,
    detecting,
    lastError,
    refreshLocation,
    requestLocationPermission,
    setManualArea,
    applySavedLocation,
    recent,
    distanceTo,
  } = useLocation();
  const { items } = useApp();

  const [query, setQuery] = useState('');
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const trimmedQuery = query.trim();
  const searching = trimmedQuery.length > 0;

  const areaGroups = useMemo(() => {
    if (searching) {
      const results = searchAreas(trimmedQuery);
      return results.length ? [{ city: 'Matches', areas: results }] : [];
    }
    return AREA_CITIES.map((city) => ({
      city,
      areas: AREAS.filter((area) => area.city === city),
    }));
  }, [searching, trimmedQuery]);

  const isActiveCoords = useCallback(
    (latitude: number, longitude: number) =>
      !!location &&
      Math.abs(location.latitude - latitude) < 0.005 &&
      Math.abs(location.longitude - longitude) < 0.005,
    [location],
  );

  const isActiveArea = useCallback(
    (area: Area) => isActiveCoords(area.latitude, area.longitude),
    [isActiveCoords],
  );

  /** Live count so the radius slider explains itself. */
  const matchCount = useMemo(() => {
    if (!location) return null;
    return items.filter((item) => {
      const km = distanceTo(item);
      if (km == null) return false;
      return radiusKm == null || km <= radiusKm;
    }).length;
  }, [distanceTo, items, location, radiusKm]);

  /** One sentence under the radius control, in plain language. */
  const radiusSummary = useMemo(() => {
    if (!location || matchCount == null) {
      return 'Set an area to see how many listings are nearby.';
    }
    const label = `${matchCount} ${matchCount === 1 ? 'listing' : 'listings'}`;
    if (radiusKm == null) {
      return matchCount === 0 ? 'No listings yet — be the first to post one.' : `${label} anywhere`;
    }
    if (matchCount === 0) {
      return `No listings within ${radiusKm} km of ${location.label} yet`;
    }
    return `${label} within ${radiusKm} km of ${location.label}`;
  }, [location, matchCount, radiusKm]);

  const handleUseCurrentLocation = useCallback(async () => {
    if (busy || detecting) return;
    setStatusNote(null);
    setBusy(true);
    try {
      let state = permission;
      if (state !== 'granted') {
        state = await requestLocationPermission();
      }
      if (state === 'denied') {
        setStatusNote('Location is blocked for Puran Haat. Open Settings to allow it.');
        return;
      }
      if (state === 'unavailable') {
        setStatusNote('This device cannot report a location. Pick your area below instead.');
        return;
      }
      const code = await refreshLocation();
      if (code === 'services_disabled') {
        const enabled = await promptForServices().catch(() => false);
        if (enabled) {
          await refreshLocation();
        } else {
          setStatusNote('Location services look switched off. Pick your area below instead.');
        }
      } else if (code === 'permission_denied') {
        setStatusNote('Location permission is off. Allow it in Settings, or pick an area.');
      } else if (code) {
        setStatusNote('Could not get a GPS fix. Pick your area below instead.');
      }
    } finally {
      setBusy(false);
    }
  }, [busy, detecting, permission, refreshLocation, requestLocationPermission]);

  const working = busy || detecting;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.grabberWrap}>
        <View style={styles.grabber} />
      </View>

      <View style={styles.topBar}>
        <Text style={styles.title}>Where are you trading?</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
          accessibilityLabel="Close location picker"
          hitSlop={8}
        >
          <MaterialIcons name="close" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>
        We sort listings by how close they are to this area.
      </Text>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* GPS ------------------------------------------------------------ */}
          <TouchableOpacity
            style={[styles.gpsCard, Shadows.card, working && styles.cardBusy]}
            onPress={handleUseCurrentLocation}
            disabled={working}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Use my current location"
            accessibilityState={{ busy: working }}
          >
            <View style={[styles.gpsIcon, location?.source === 'gps' && styles.gpsIconActive]}>
              {working ? (
                <ActivityIndicator size="small" color={Colors.onPrimary} />
              ) : (
                <MaterialIcons
                  name="my-location"
                  size={22}
                  color={location?.source === 'gps' ? Colors.onPrimary : Colors.primary}
                />
              )}
            </View>
            <View style={styles.gpsBody}>
              <Text style={styles.gpsTitle}>
                {working ? 'Finding your area…' : 'Use my current location'}
              </Text>
              <Text style={styles.gpsHint} numberOfLines={2}>
                {location?.source === 'gps'
                  ? `${location.label} • updated ${relativeTime(location.updatedAt)}`
                  : 'Uses GPS once, then remembers the area.'}
              </Text>
            </View>
            {!working && location?.source === 'gps' ? (
              <MaterialIcons name="refresh" size={20} color={Colors.primary} />
            ) : (
              <MaterialIcons name="chevron-right" size={22} color={Colors.outline} />
            )}
          </TouchableOpacity>

          {permission === 'denied' && !working && (
            <TouchableOpacity
              style={styles.inlineNote}
              onPress={() => void openAppSettings()}
              accessibilityRole="button"
            >
              <MaterialIcons name="lock-outline" size={16} color={Colors.tertiary} />
              <Text style={styles.inlineNoteText}>
                Location permission is off. Tap to open Settings.
              </Text>
            </TouchableOpacity>
          )}

          {(statusNote || lastError) && !working && (
            <View style={[styles.inlineNote, styles.inlineNoteQuiet]}>
              <MaterialIcons name="info-outline" size={16} color={Colors.onSurfaceVariant} />
              <Text style={[styles.inlineNoteText, styles.inlineNoteTextQuiet]}>
                {statusNote || lastError?.message}
              </Text>
            </View>
          )}

          {/* Radius --------------------------------------------------------- */}
          <Text style={styles.sectionTitle}>Show listings</Text>
          <RadiusSegments value={radiusKm} onChange={setRadiusKm} />
          <Text style={styles.radiusSummary}>{radiusSummary}</Text>

          {/* Recents -------------------------------------------------------- */}
          {recent.length > 0 && !searching && (
            <>
              <Text style={styles.sectionTitle}>Recent</Text>
              <View style={styles.chipWrap}>
                {recent.map((saved) => {
                  const active = isActiveCoords(saved.latitude, saved.longitude);
                  return (
                    <TouchableOpacity
                      key={`${saved.label}-${saved.updatedAt}`}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => applySavedLocation(saved)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <MaterialIcons
                        name={saved.source === 'gps' ? 'my-location' : 'history'}
                        size={14}
                        color={active ? Colors.onPrimary : Colors.primary}
                      />
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {saved.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Areas ---------------------------------------------------------- */}
          <Text style={styles.sectionTitle}>Choose an area</Text>
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={20} color={Colors.outline} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search Dhanmondi, Mirpur, Sylhet…"
              placeholderTextColor="rgba(66, 73, 62, 0.6)"
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel="Search areas"
            />
            {searching && (
              <TouchableOpacity
                onPress={() => setQuery('')}
                accessibilityLabel="Clear area search"
                hitSlop={8}
              >
                <MaterialIcons name="cancel" size={18} color={Colors.outline} />
              </TouchableOpacity>
            )}
          </View>

          {areaGroups.length === 0 ? (
            <Text style={styles.emptyText}>
              No area matches “{trimmedQuery}”. Try a nearby locality instead.
            </Text>
          ) : (
            areaGroups.map((group) => (
              <View key={group.city} style={styles.areaGroup}>
                <Text style={styles.areaGroupTitle}>{group.city}</Text>
                <View style={styles.chipWrap}>
                  {group.areas.map((area) => {
                    const active = isActiveArea(area);
                    return (
                      <TouchableOpacity
                        key={`${area.city}-${area.name}`}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setManualArea(area)}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Use ${area.name}, ${area.city}`}
                      >
                        {active && (
                          <MaterialIcons name="check" size={14} color={Colors.onPrimary} />
                        )}
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {area.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerInfo}>
            <MaterialIcons
              name={location ? 'location-on' : 'location-off'}
              size={18}
              color={location ? Colors.primary : Colors.outline}
            />
            <Text style={styles.footerText} numberOfLines={1}>
              {location ? location.label : 'No area selected yet'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => router.back()}
            accessibilityRole="button"
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Six-way distance selector with a single indicator that slides between slots —
 * cheap to run (native driver) and readable at a glance.
 */
function RadiusSegments({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const slotCount = RADIUS_OPTIONS.length;
  const slotWidth = trackWidth > 0 ? trackWidth / slotCount : 0;
  const activeIndex = Math.max(
    0,
    RADIUS_OPTIONS.findIndex((option) => option.value === value),
  );
  const translateX = useState(() => new Animated.Value(activeIndex))[0];

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: activeIndex,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, translateX]);

  return (
    <View
      style={styles.segments}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {slotWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.segmentIndicator,
            {
              width: slotWidth,
              transform: [{ translateX: Animated.multiply(translateX, slotWidth) }],
            },
          ]}
        />
      )}
      {RADIUS_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.label}
            style={styles.segment}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={
              option.value == null ? 'Any distance' : `Within ${option.value} kilometres`
            }
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {option.value == null ? 'Any' : `${option.value} km`}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** "just now" / "12 min ago" / "2 h ago" — enough to judge how fresh a fix is. */
function relativeTime(timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  grabberWrap: { alignItems: 'center', paddingTop: Spacing.xs },
  grabber: {
    width: 44,
    height: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.outlineVariant,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.margin,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  title: { ...Typography.headlineMd, color: Colors.primary, flex: 1 },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainer,
  },
  subtitle: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    paddingHorizontal: Spacing.margin,
    marginTop: 2,
  },
  scrollContent: { paddingHorizontal: Spacing.margin, paddingBottom: Spacing.lg },
  gpsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.08)',
  },
  cardBusy: { opacity: 0.9 },
  gpsIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(45, 90, 39, 0.1)',
  },
  gpsIconActive: { backgroundColor: Colors.primary },
  gpsBody: { flex: 1 },
  gpsTitle: { ...Typography.labelLg, color: Colors.onSurface, fontSize: 15 },
  gpsHint: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 2 },
  inlineNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.tertiaryFixed,
  },
  inlineNoteQuiet: { backgroundColor: Colors.surfaceContainer },
  inlineNoteText: { ...Typography.bodySm, color: Colors.tertiary, flex: 1 },
  inlineNoteTextQuiet: { color: Colors.onSurfaceVariant },
  sectionTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  segments: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.full,
    padding: 4,
    position: 'relative',
  },
  segmentIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  segmentText: { ...Typography.labelSm, color: Colors.onSecondaryContainer, fontSize: 11 },
  segmentTextActive: { color: Colors.onPrimary },
  radiusSummary: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    marginTop: Spacing.xs,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.1)',
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Typography.labelMd, color: Colors.onSurface },
  chipTextActive: { color: Colors.onPrimary },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.08)',
  },
  searchInput: { flex: 1, ...Typography.bodyMd, color: Colors.onSurface, paddingVertical: 8 },
  areaGroup: { marginTop: Spacing.md },
  areaGroupTitle: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  emptyText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    marginTop: Spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.margin,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(21, 66, 18, 0.08)',
    backgroundColor: Colors.background,
  },
  footerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText: { ...Typography.labelMd, color: Colors.onSurface, flex: 1 },
  doneButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  doneButtonText: { ...Typography.labelLg, color: Colors.onPrimary },
});
