import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';

export const editToolbar = ({ formData, handleInputChange, editing }) => {
  if (!editing) return null;

  const handleInputChangeWrapper = (name, value) => {
    handleInputChange({ target: { name, value } });
  };

  return (
    <View style={styles.editToolbar}>
      <View style={styles.toolbarItem}>
        <Picker
          selectedValue={formData.fontFamily}
          onValueChange={(value) => handleInputChangeWrapper('fontFamily', value)}
          style={styles.toolbarSelect}
        >
          <Picker.Item label="Arial" value="Arial" />
          <Picker.Item label="Times New Roman" value="Times New Roman" />
          <Picker.Item label="Courier New" value="Courier New" />
          <Picker.Item label="Georgia" value="Georgia" />
          <Picker.Item label="Verdana" value="Verdana" />
          <Picker.Item label="Tahoma" value="Tahoma" />
          <Picker.Item label="Trebuchet MS" value="Trebuchet MS" />
        </Picker>
      </View>

      <View style={styles.toolbarItem}>
        <Picker
          selectedValue={formData.profileStyle}
          onValueChange={(value) => handleInputChangeWrapper('profileStyle', value)}
          style={styles.toolbarSelect}
        >
          <Picker.Item label="Classic Card" value="classic" />
          <Picker.Item label="Minimalist" value="minimal" />
          <Picker.Item label="Bold Header" value="bold" />
          <Picker.Item label="Framed" value="framed" />
          <Picker.Item label="Pixel Theme" value="pixel" />
          <Picker.Item label="Constitution Theme" value="constitution" />
        </Picker>
      </View>

      <View style={[styles.toolbarItem, styles.layoutToggle]}>
        <TouchableOpacity
          style={[
            styles.layoutBtn,
            formData.imageLayout === 'grid' && styles.layoutBtnActive
          ]}
          onPress={() => handleInputChangeWrapper('imageLayout', 'grid')}
        >
          <Ionicons
            name="grid-outline"
            size={20}
            color={formData.imageLayout === 'grid' ? '#6B46C1' : '#999'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.layoutBtn,
            formData.imageLayout === 'vertical' && styles.layoutBtnActive
          ]}
          onPress={() => handleInputChangeWrapper('imageLayout', 'vertical')}
        >
          <Ionicons
            name="list-outline"
            size={20}
            color={formData.imageLayout === 'vertical' ? '#6B46C1' : '#999'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  editToolbar: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f6f4fc',
    borderRadius: 8,
  },
  toolbarItem: {
    flex: 1,
  },
  toolbarSelect: {
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  layoutToggle: {
    flexDirection: 'row',
    gap: 8,
    flex: 0,
  },
  layoutBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e6ef',
  },
  layoutBtnActive: {
    borderColor: '#6B46C1',
    backgroundColor: '#f6f4fc',
  },
});
