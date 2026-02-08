import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Profile from '../profile/profile';
import CompatibilityScore from './compatibilityScore';
import { Ionicons } from '@expo/vector-icons';
import { useContext } from 'react';
import { UserContext } from '../../context/UserContext';

const ProfileCard = ({
  profile,
  userInfo,
  onSkip
}) => {
  const { user } = useContext(UserContext);
  const viewerUnit = user?.unit;

  return (
    <View style={styles.profileBox}>
      {profile.note && (
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>
            {profile.matched_by_matcher ? 'Matchmaker Note: ' : 'Note: '}
          </Text>
          <Text style={styles.noteText}>{profile.note}</Text>
        </View>
      )}

      <Profile
        user={profile}
        framed={true}
        viewerUnit={viewerUnit}
      />

      {userInfo?.role === 'matchmaker' && profile.ai_score !== undefined && (
        <View style={styles.aiScoreBox}>
          <CompatibilityScore score={profile.ai_score} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  profileBox: {
    position: 'relative',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  noteBox: {
    backgroundColor: '#f6f4fc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#6B46C1',
  },
  noteLabel: {
    fontWeight: '700',
    color: '#222',
    marginBottom: 4,
  },
  noteText: {
    color: '#666',
    fontSize: 14,
  },
  aiScoreBox: {
    marginTop: 16,
    marginBottom: 16,
  },
});

export default ProfileCard;
