import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MatchCard = ({ matchObj, BASE_URL, userInfo, navigation, unmatch, reveal, hide }) => {
  const bothMm = !!matchObj.both_matchmakers_involved;
  const oneMm = !!matchObj.user_1_matchmaker_involved || !!matchObj.user_2_matchmaker_involved;
  const isBlind = matchObj.blind_match === 'Blind';

  const renderMatchmakerIcons = () => {
    if (bothMm) {
      return <Ionicons name="people" size={16} color="#9f7aea" />;
    }
    if (oneMm) {
      return <Ionicons name="person" size={16} color="#5a67d8" />;
    }
    return null;
  };

  return (
    <TouchableOpacity
      style={styles.matchCard}
      onPress={() => navigation.navigate('MatchConvo', { matchId: matchObj.match_id })}
      activeOpacity={0.7}
    >
      <View style={styles.profileSection}>
        {matchObj.match_user.first_image ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: `${BASE_URL}${matchObj.match_user.first_image}` }}
              style={styles.matchImage}
              resizeMode="cover"
            />
            {isBlind && <View style={styles.blurOverlay} />}
          </View>
        ) : (
          <View style={styles.matchPlaceholder}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}

        <View style={styles.matchInfo}>
          <Text style={styles.matchName}>{matchObj.match_user.first_name}</Text>
          {userInfo?.role === 'user' && (
            <View style={styles.matchIcons}>
              {renderMatchmakerIcons()}
            </View>
          )}
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.iconBtn, styles.unmatchBtn]}
            onPress={() => unmatch(matchObj.match_id)}
          >
            <Ionicons name="close-circle" size={20} color="#e53e3e" />
          </TouchableOpacity>

          {userInfo?.role === 'matchmaker' && isBlind && (
            <TouchableOpacity
              style={[styles.iconBtn, styles.revealBtn]}
              onPress={() => reveal(matchObj.match_id)}
            >
              <Ionicons name="eye" size={20} color="#38a169" />
            </TouchableOpacity>
          )}

          {userInfo?.role === 'matchmaker' && !isBlind && (
            <TouchableOpacity
              style={[styles.iconBtn, styles.hideBtn]}
              onPress={() => hide(matchObj.match_id)}
            >
              <Ionicons name="eye-off" size={20} color="#718096" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {matchObj.linked_dater && userInfo?.role === 'matchmaker' && (
        <View style={styles.linkedSection}>
          {matchObj.linked_dater.first_image ? (
            <Image
              source={{ uri: `${BASE_URL}${matchObj.linked_dater.first_image}` }}
              style={styles.linkedImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.matchPlaceholder}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
          <Text style={styles.matchName}>{matchObj.linked_dater.first_name}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  matchCard: {
    flexDirection: 'column',
    alignItems: 'center',
    width: 150,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eaeaea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  profileSection: {
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    width: '100%',
  },
  imageContainer: {
    position: 'relative',
  },
  matchImage: {
    width: 85,
    height: 85,
    borderRadius: 42.5,
    borderWidth: 2,
    borderColor: '#eee',
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 42.5,
  },
  matchPlaceholder: {
    width: 85,
    height: 85,
    backgroundColor: '#f2f2f2',
    borderRadius: 42.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#999',
    fontSize: 13,
  },
  matchInfo: {
    marginTop: 8,
    alignItems: 'center',
  },
  matchName: {
    fontWeight: '600',
    fontSize: 15,
    color: '#333',
    marginBottom: 4,
  },
  matchIcons: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  iconBtn: {
    borderRadius: 8,
    padding: 4,
  },
  unmatchBtn: {
    // Styles handled by icon color
  },
  revealBtn: {
    // Styles handled by icon color
  },
  hideBtn: {
    // Styles handled by icon color
  },
  linkedSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
    alignItems: 'center',
    width: '100%',
  },
  linkedImage: {
    width: 85,
    height: 85,
    borderRadius: 42.5,
    borderWidth: 2,
    borderColor: '#eee',
  },
});

export default MatchCard;
