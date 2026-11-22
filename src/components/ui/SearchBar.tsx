import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '../../constants/colors';
import { Typography, BorderRadius, Spacing, Shadows } from '../../constants/theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onPressFilter?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Search items nearby...',
  onPressFilter,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <MaterialIcons name="search" size={21} color={Colors.outline} style={styles.searchIcon} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(66, 73, 62, 0.55)"
          style={styles.input}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Search listings"
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={() => onChangeText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="cancel" size={18} color={Colors.outline} />
          </TouchableOpacity>
        )}
      </View>

      {onPressFilter && (
        <TouchableOpacity style={styles.filterButton} onPress={onPressFilter} activeOpacity={0.7}>
          <MaterialIcons name="tune" size={20} color={Colors.onPrimary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: Spacing.margin,
    marginVertical: Spacing.xs,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(21, 66, 18, 0.08)',
    ...Shadows.card,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    ...Typography.bodyMd,
    color: Colors.onSurface,
    padding: 0,
  },
  filterButton: {
    width: 43,
    height: 43,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
