import React from 'react';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';

const StepIndicator = ({ step }) => {
  const steps = [
    { number: 1, label: 'Setup' },
    { number: 2, label: 'Preview' },
    { number: 3, label: 'Preferences' },
  ];

  return (
    <View style={styles.container}>
      {steps.map((s) => {
        const isActive = step === s.number;

        return (
          <View key={s.number} style={styles.stepItem}>
            <View
              style={[
                styles.stepNumber,
                isActive && styles.stepNumberActive,
              ]}
            >
              <Text
                style={[
                  styles.stepNumberText,
                  isActive && styles.stepNumberTextActive,
                ]}
              >
                {s.number}
              </Text>
            </View>

            <Text
              style={[
                styles.stepLabel,
                isActive && styles.stepLabelActive,
              ]}
            >
              {s.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

export default StepIndicator;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24, // RN now supports gap on iOS+Android
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 12,
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: '#ebe7fb',
    opacity: 0.95,
  },
  stepItem: {
    alignItems: 'center',
    opacity: 0.4,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberActive: {
    borderColor: '#6c5ce7',
  },
  stepNumberText: {
    fontSize: 14,
    color: '#444',
  },
  stepNumberTextActive: {
    fontWeight: '700',
    color: '#6c5ce7',
  },
  stepLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#444',
  },
  stepLabelActive: {
    opacity: 1,
    fontWeight: '600',
    color: '#6c5ce7',
  },
});
