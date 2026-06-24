import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const GENDER_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'nonbinary', label: 'Non-Binary' },
];

const SelectGender = ({ selected, onChange, accentColor = '#6c5ce7', surfaceColor }) => {
  const handleSelect = (value) => {
    onChange(selected === value ? '' : value);
  };

  return (
    <View style={styles.container}>
      {GENDER_OPTIONS.map((option) => {
        const isSelected = selected === option.value;

        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => handleSelect(option.value)}
            style={[
              styles.option,
              !isSelected && surfaceColor ? { backgroundColor: surfaceColor } : null,
              isSelected && [styles.optionSelected, { backgroundColor: accentColor, borderColor: accentColor }],
            ]}
          >
            <Text
              style={[
                styles.optionText,
                isSelected && styles.optionTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
  },
  option: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  optionSelected: {},
  optionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
});

export default SelectGender;
