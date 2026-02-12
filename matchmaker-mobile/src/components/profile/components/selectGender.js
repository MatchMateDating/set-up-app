import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const GENDER_OPTIONS = ["female", "male", "nonbinary"];

const SelectGender = ({ selected, onChange }) => {
  const handleSelect = (value) => {
    // Optional: allow deselect by tapping again
    onChange(selected === value ? "" : value);
  };

  return (
    <View style={styles.container}>
      {GENDER_OPTIONS.map((option) => {
        const isSelected = selected === option;

        return (
          <TouchableOpacity
            key={option}
            onPress={() => handleSelect(option)}
            style={[
              styles.option,
              isSelected && styles.optionSelected
            ]}
          >
            <Text
              style={[
                styles.optionText,
                isSelected && styles.optionTextSelected
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 8,
  },
  option: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: "#ccc",
    borderRadius: 20,
  },
  optionSelected: {
    backgroundColor: "#6c5ce7",
    borderColor: "#6c5ce7",
  },
  optionText: {
    fontSize: 14,
    color: "#555",
  },
  optionTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
});

export default SelectGender;
