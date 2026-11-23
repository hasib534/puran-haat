import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing } from '../../constants/theme';
import { coordsForAreaLabel, type Coords } from '../../lib/geo';
import { useCaptureLocation } from '../../hooks/useCaptureLocation';

export interface LocationValue {
  /** Free-text area shown in the input. */
  label: string;
  /** Coordinates for the label, or null when it cannot be resolved. */
  coords: Coords | null;
}

interface LocationFieldProps {
  /** Heading above the field. */
  label: string;
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  placeholder?: string;
  /** Optional helper under the field. */
  hint?: string;
}

/**
 * Area input plus a one-tap GPS button.
 *
 * Typing an area still works exactly as before — the catalogue resolves common
 * localities to real coordinates — while the GPS button fills both the label and
 * an exact pin. Any edit to the text re-resolves the coordinates so we never
 * keep a pin that disagrees with the name next to it.
 */
export const LocationField: React.FC<LocationFieldProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Dhanmondi, Mirpur, TSC...',
  hint,
}) => {
  const { capture, capturing } = useCaptureLocation();
  const [gpsPin, setGpsPin] = useState(false);

  const handleText = (text: string) => {
    if (gpsPin) setGpsPin(false);
    onChange({ label: text, coords: coordsForAreaLabel(text) ?? null });
  };

  const handleCapture = async () => {
    const place = await capture();
    if (!place) return;
    onChange({ label: place.label, coords: place.coords });
    setGpsPin(true);
  };

  const hasPin = !capturing && value.coords != null;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {gpsPin ? (
          <View style={styles.badge}>
            <MaterialIcons name="gps-fixed" size={12} color={Colors.primary} />
            <Text style={styles.badgeText}>GPS pin</Text>
          </View>
        ) : hasPin ? (
          <View style={styles.badge}>
            <MaterialIcons name="place" size={12} color={Colors.primary} />
            <Text style={styles.badgeText}>Pinned</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.row}>
        <MaterialIcons name="location-on" size={19} color={Colors.primary} />
        <TextInput
          style={styles.input}
          value={value.label}
          onChangeText={handleText}
          placeholder={placeholder}
          placeholderTextColor="rgba(66, 73, 62, 0.55)"
          accessibilityLabel={label}
        />
        {value.label.length > 0 && (
          <TouchableOpacity
            onPress={() => handleText('')}
            hitSlop={8}
            accessibilityLabel={`Clear ${label.toLowerCase()}`}
          >
            <MaterialIcons name="cancel" size={17} color={Colors.outline} />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[styles.gpsButton, capturing && styles.gpsButtonBusy]}
        onPress={handleCapture}
        disabled={capturing}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Use my current location"
        accessibilityState={{ busy: capturing }}
      >
        {capturing ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <MaterialIcons name="my-location" size={16} color={Colors.primary} />
        )}
        <Text style={styles.gpsText}>
          {capturing ? 'Finding your area...' : 'Use my current location'}
        </Text>
      </TouchableOpacity>

      {(hint || hasPin) && (
        <Text style={styles.hint} numberOfLines={2}>
          {hint || 'Exact pin saved — buyers can open it in Maps.'}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.md },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: { ...Typography.labelLg, color: Colors.onSurface },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.secondaryContainer,
  },
  badgeText: { ...Typography.labelSm, color: Colors.primary, fontSize: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.1)',
  },
  input: { flex: 1, paddingVertical: 12, ...Typography.bodyMd, color: Colors.onSurface },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.secondaryContainer,
  },
  gpsButtonBusy: { opacity: 0.75 },
  gpsText: { ...Typography.labelMd, color: Colors.primary },
  hint: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 6 },
});
