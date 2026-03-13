import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const FormField = ({ label, value, editing, input }) => {
  if (!editing && !value) return null;
  
  return (
    <View style={styles.profileField}>
      {editing ? (
        <>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.inputContainer}>{input}</View>
        </>
      ) : (
        <Text style={styles.label}>
          {label}: <Text style={styles.profileValue}>{value}</Text>
        </Text>
      )}
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
  inputContainer: {
    width: '100%',
  },
});

export default FormField;
