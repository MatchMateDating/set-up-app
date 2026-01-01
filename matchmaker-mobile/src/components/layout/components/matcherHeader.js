import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MatcherHeader = ({ children }) => {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {children}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    backgroundColor: '#f6f4fc',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,     // small spacing below status bar
    paddingBottom: 8,
    zIndex: 10,
  },
});

export default MatcherHeader;
