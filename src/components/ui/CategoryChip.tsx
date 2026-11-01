import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '../../constants/colors';
import { Typography, BorderRadius } from '../../constants/theme';
import { Category } from '../../types';

interface CategoryChipProps {
  category: Category;
  isSelected: boolean;
  onSelect: () => void;
}

export const CategoryChip: React.FC<CategoryChipProps> = ({
  category,
  isSelected,
  onSelect,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onSelect}
      style={[
        styles.chip,
        isSelected ? styles.chipSelected : styles.chipDefault,
      ]}
    >
      <MaterialIcons
        name={category.icon as any}
        size={16}
        color={isSelected ? Colors.onPrimaryContainer : Colors.onSecondaryContainer}
      />
      <Text
        style={[
          styles.text,
          isSelected ? styles.textSelected : styles.textDefault,
        ]}
      >
        {category.name}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
    marginRight: 8,
  },
  chipDefault: {
    backgroundColor: Colors.secondaryContainer,
  },
  chipSelected: {
    backgroundColor: Colors.primaryContainer,
  },
  text: {
    ...Typography.labelMd,
  },
  textDefault: {
    color: Colors.onSecondaryContainer,
  },
  textSelected: {
    color: Colors.onPrimaryContainer,
  },
});
