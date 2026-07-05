import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const ToggleConversationsMatcher = ({
  showDaterMatches,
  setShowDaterMatches,
  accentColor = '#6c5ce7',
}) => (
  <View style={styles.track}>
    <TouchableOpacity
      style={[styles.segment, showDaterMatches && { backgroundColor: accentColor }]}
      onPress={() => setShowDaterMatches(true)}
      activeOpacity={0.85}
    >
      <Text style={[styles.segmentText, showDaterMatches && styles.segmentTextActive]}>
        Pending
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.segment, !showDaterMatches && { backgroundColor: accentColor }]}
      onPress={() => setShowDaterMatches(false)}
      activeOpacity={0.85}
    >
      <Text style={[styles.segmentText, !showDaterMatches && styles.segmentTextActive]}>
        Approved
      </Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: '#ececee',
    borderRadius: 999,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  segmentTextActive: {
    color: '#ffffff',
  },
});

export default ToggleConversationsMatcher;
