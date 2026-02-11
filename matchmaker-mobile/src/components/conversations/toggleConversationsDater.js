import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const ToggleConversationsDater = ({ showDaterMatches, setShowDaterMatches }) => (
  <View style={styles.container}>
    <TouchableOpacity
      style={[styles.button, showDaterMatches && styles.buttonActive]}
      onPress={() => setShowDaterMatches(true)}
    >
      <Text style={[styles.buttonText, showDaterMatches && styles.buttonTextActive]}>
        Dater Matches
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.button, !showDaterMatches && styles.buttonActive]}
      onPress={() => setShowDaterMatches(false)}
    >
      <Text style={[styles.buttonText, !showDaterMatches && styles.buttonTextActive]}>
        Matchmaker Matches
      </Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 40,
    gap: 10,
  },
  button: {
    backgroundColor: '#ccc',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  buttonActive: {
    backgroundColor: '#6c5ce7',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonTextActive: {
    color: '#fff',
  },
});

export default ToggleConversationsDater;
