import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const getRoleAccentColor = (role) => (role === 'user' ? '#ef4d73' : '#6c5ce7');
export const getRoleBackgroundTint = (role) =>
  role === 'user' ? 'rgba(239, 77, 115, 0.08)' : 'rgba(108, 92, 231, 0.08)';

/** Light pill/section background behind dater (rose) vs matchmaker (violet) accents. */
export const getRoleContainerColor = (role) => (role === 'user' ? '#ffe6ee' : '#efe7ff');

const getRoleLabel = (role) => (role === 'user' ? 'DATER' : 'MATCHMAKER');

const RoleHeaderBanner = ({ role }) => {
  const accentColor = getRoleAccentColor(role);
  const roleLabel = getRoleLabel(role);
  const isDater = role === 'user';

  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: accentColor }]}>
        {isDater ? (
          <Ionicons name="heart" size={16} color="#fff" style={styles.daterIcon} />
        ) : (
          <Image
            source={require('../../../../assets/matchmaker_pill_logo.png')}
            style={styles.badgeLogo}
          />
        )}
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
  badgeLogo: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  daterIcon: {
    width: 18,
    textAlign: 'center',
  },
});

export default RoleHeaderBanner;
