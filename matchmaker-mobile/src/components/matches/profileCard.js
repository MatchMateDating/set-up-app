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
  onSkip,
  onLike,
  onBlindMatch,
  onOpenNote
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

      <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
        <Ionicons name="close-circle" size={32} color="#e53e3e" />
      </TouchableOpacity>

      <Profile
        user={profile}
        framed={true}
        viewerUnit={viewerUnit}
      />

      <TouchableOpacity style={styles.noteButton} onPress={onOpenNote}>
        <Ionicons name="create-outline" size={24} color="#6B46C1" />
      </TouchableOpacity>

      {userInfo?.role === 'matchmaker' && profile.ai_score !== undefined && (
        <View style={styles.aiScoreBox}>
          <CompatibilityScore score={profile.ai_score} />
        </View>
      )}

      {userInfo?.role === 'matchmaker' ? (
        profile.liked_linked_dater ? (
          <TouchableOpacity
            style={styles.likeButton}
            onPress={() => onBlindMatch(profile.id)}
          >
            <Ionicons name="heart" size={32} color="#e53e3e" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.likeButton}
            onPress={() => onLike(profile.id)}
          >
            <Ionicons name="heart" size={32} color="#e53e3e" />
          </TouchableOpacity>
        )
      ) : (
        <TouchableOpacity
          style={styles.likeButton}
          onPress={() => onLike(profile.id)}
        >
          <Ionicons name="heart" size={32} color="#e53e3e" />
        </TouchableOpacity>
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
  skipButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  noteButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    backgroundColor: '#f6f4fc',
    borderRadius: 20,
    padding: 8,
  },
  aiScoreBox: {
    marginTop: 16,
    marginBottom: 16,
  },
  likeButton: {
    alignSelf: 'center',
    marginTop: 16,
    padding: 12,
  },
});

export default ProfileCard;
