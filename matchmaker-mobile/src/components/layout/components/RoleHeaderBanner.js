import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const getRoleAccentColor = (role) => (role === 'user' ? '#ef4d73' : '#6c5ce7');
export const getRoleBackgroundTint = (role) =>
  role === 'user' ? 'rgba(239, 77, 115, 0.08)' : 'rgba(108, 92, 231, 0.08)';

const getRoleContainerColor = (role) => (role === 'user' ? '#ffe6ee' : '#efe7ff');

const getRoleLabel = (role) => (role === 'user' ? 'DATER' : 'MATCHMAKER');

const RoleHeaderBanner = ({ role }) => {
  const accentColor = getRoleAccentColor(role);
  const roleLabel = getRoleLabel(role);

  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: accentColor }]}>
        <Ionicons name="sparkles-outline" size={13} color="#fff" />
        <Text style={styles.badgeText}>{roleLabel}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-end',
    marginRight: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});

export default RoleHeaderBanner;
