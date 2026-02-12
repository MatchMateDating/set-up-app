import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const BlindMatchButton = ({ onPress }) => (
  <TouchableOpacity style={styles.button} onPress={onPress}>
    <Ionicons name="person" size={24} color="#6c5ce7" />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
});

export default BlindMatchButton;
