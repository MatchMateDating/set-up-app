import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const FormField = ({ label, value, editing, input }) => {
  if (!editing && !value) return null;
  
  return (
    <View style={styles.profileField}>
      <Text style={styles.label}>
        {label}: {editing ? input : <Text style={styles.profileValue}>{value}</Text>}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  profileField: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginBottom: 8,
  },
  profileValue: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '400',
  },
});

export default FormField;
