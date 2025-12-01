import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Picker } from '@react-native-picker/picker';

const HeightSelector = ({ formData, heightUnit, onInputChange, onUnitToggle }) => {
  const handleInputChangeWrapper = (name, value) => {
    onInputChange({ target: { name, value } });
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onUnitToggle} style={styles.switchBtn}>
        <Text style={styles.switchBtnText}>
          {heightUnit === 'ft' ? 'Switch to meters' : 'Switch to feet'}
        </Text>
      </TouchableOpacity>
      <View style={styles.heightInputs}>
        {heightUnit === 'ft' ? (
          <>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.heightFeet}
                onValueChange={(value) => handleInputChangeWrapper('heightFeet', value)}
                style={styles.picker}
              >
                {[...Array(8).keys()].map((num) => (
                  <Picker.Item key={num} label={`${num} ft`} value={num.toString()} />
                ))}
              </Picker>
            </View>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.heightInches}
                onValueChange={(value) => handleInputChangeWrapper('heightInches', value)}
                style={styles.picker}
              >
                {[...Array(12).keys()].map((num) => (
                  <Picker.Item key={num} label={`${num} in`} value={num.toString()} />
                ))}
              </Picker>
            </View>
          </>
        ) : (
          <>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.heightMeters}
                onValueChange={(value) => handleInputChangeWrapper('heightMeters', value)}
                style={styles.picker}
              >
                {[...Array(3).keys()].map((num) => (
                  <Picker.Item key={num} label={`${num} m`} value={num.toString()} />
                ))}
              </Picker>
            </View>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.heightCentimeters}
                onValueChange={(value) => handleInputChangeWrapper('heightCentimeters', value)}
                style={styles.picker}
              >
                {[...Array(100).keys()].map((num) => (
                  <Picker.Item key={num} label={`${num} cm`} value={num.toString()} />
                ))}
              </Picker>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  heightInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  pickerContainer: {
    width: 110,
    borderBottomWidth: 2,
    borderBottomColor: '#e0e6ef',
    minHeight: 160,
    justifyContent: 'center'
  },
  picker: {
    height: 110,
    width: 120
  },
  switchBtn: {
    padding: 6,
  },
  switchBtnText: {
    color: '#6B46C1',
    fontSize: 14,
  },
});

export default HeightSelector;
