import React from 'react';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';

const DATER_STEPS = [
  { number: 1, label: 'Setup' },
  { number: 2, label: 'Preview' },
  { number: 3, label: 'Preferences' },
];

const StepIndicator = ({
  step,
  steps = DATER_STEPS,
  accentColor = '#ef4d73',
  headerBackgroundColor = '#ffe6ee',
}) => {
  return (
    <View style={[styles.container, { backgroundColor: headerBackgroundColor }]}>
      {steps.map((s) => {
        const isActive = step === s.number;

        return (
          <View key={s.number} style={[styles.stepItem, isActive && styles.stepItemActive]}>
            <View
              style={[
                styles.stepNumber,
                isActive && { borderColor: accentColor },
              ]}
            >
              <Text
                style={[
                  styles.stepNumberText,
                  isActive && { fontWeight: '700', color: accentColor },
                ]}
              >
                {s.number}
              </Text>
            </View>

            <Text
              style={[
                styles.stepLabel,
                isActive && { opacity: 1, fontWeight: '600', color: accentColor },
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
    gap: 24,
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 12,
    paddingBottom: 12,
    paddingHorizontal: 20,
    opacity: 0.95,
  },
  stepItem: {
    alignItems: 'center',
    opacity: 0.4,
  },
  stepItemActive: {
    opacity: 1,
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
  stepNumberText: {
    fontSize: 14,
    color: '#444',
  },
  stepLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#444',
  },
});
