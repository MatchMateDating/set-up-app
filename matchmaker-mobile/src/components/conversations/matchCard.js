import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../env';
import { useNavigation } from '@react-navigation/native';
import { getImageUrl } from '../profile/utils/profileUtils';

const MatchCard = ({ matchObj, userInfo, unmatch, reveal, hide }) => {
  const navigation = useNavigation();
  const bothMm = !!matchObj.both_matchmakers_involved;
  const oneMm = !!matchObj.user_1_matchmaker_involved || !!matchObj.user_2_matchmaker_involved;
  const isBlind = matchObj.blind_match === 'Blind';
  const isPendingApproval = matchObj.status === 'pending_approval' || matchObj.message_count !== undefined;

  const renderMatchmakerIcons = () => {
    if (bothMm) {
      return <Ionicons name="people" size={16} color="#9f7aea" />;
    }
    if (oneMm) {
      return <Ionicons name="person" size={16} color="#5a67d8" />;
    }
    return null;
  };

  const renderOverlappedImages = () => {
    if (!matchObj.linked_dater) return null;

    return (
      <View style={styles.vennContainer}>
        {/* Linked dater (right, behind) */}
        {matchObj.linked_dater.first_image ? (
          <Image
            source={{ uri: getImageUrl(matchObj.linked_dater.first_image, API_BASE_URL) }}
            style={[styles.vennImage, styles.vennRight]}
          />
        ) : (
          <View style={[styles.matchPlaceholder, styles.vennRight]} />
        )}

        {/* Match user (left, on top) */}
        {matchObj.match_user.first_image ? (
          <Image
            source={{ uri: getImageUrl(matchObj.match_user.first_image, API_BASE_URL) }}
            style={[styles.vennImage, styles.vennLeft]}
          />
        ) : (
          <View style={[styles.matchPlaceholder, styles.vennLeft]} />
        )}
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={styles.matchCard}
      onPress={() => navigation.navigate('MatchConvo', { matchId: matchObj.match_id, isBlind: isBlind })}
      activeOpacity={0.7}
    >
      <View style={styles.profileSection}>
        {userInfo?.role === 'matchmaker' && matchObj.linked_dater
          ? renderOverlappedImages()
          : (
            <>
              {matchObj.match_user.first_image ? (
                <View style={styles.imageContainer}>
                  {isBlind ? (
                    <Image
                      source={{ uri: getImageUrl(matchObj.match_user.first_image, API_BASE_URL) }}
                      style={styles.matchImage}
                      resizeMode="cover"
                      blurRadius={isBlind ? 40 : 0}
                    />
                  ):(
                    <Image
                      source={{ uri: getImageUrl(matchObj.match_user.first_image, API_BASE_URL) }}
                      style={styles.matchImage}
                      resizeMode="cover"
                    />)}
                </View>
              ) : (
                <View style={styles.matchPlaceholder}>
                  <Text style={styles.placeholderText}>No Image</Text>
                </View>
              )}
            </>
          )
        }

        {/* Purple matchmaker banner for pending approval matches between 2 matchmakers */}
        {isPendingApproval && matchObj.both_matchmakers_involved && (
          <View style={styles.matchmakerBanner}>
            <Text style={styles.matchmakerBannerText}>matchmaker</Text>
          </View>
        )}

        <View style={styles.matchInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.matchName}>{matchObj.match_user.first_name}</Text>
            {isPendingApproval && (
              matchObj.waiting_for_other_approval ? (
                <Ionicons name="hourglass-outline" size={18} color="#6B46C1" style={styles.clockIcon} />
              ) : (
                <Ionicons name="time-outline" size={18} color="#f59e0b" style={styles.clockIcon} />
              )
            )}
          </View>
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
  vennContainer: {
    width: 110,
    height: 85,
    position: 'relative',
    marginBottom: 6,
  },
  vennImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: '#fff',
    position: 'absolute',
  },
  vennLeft: {
    left: 0,
    zIndex: 2,
  },
  vennRight: {
    right: 0,
    zIndex: 1,
    opacity: 0.95,
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  matchName: {
    fontWeight: '600',
    fontSize: 15,
    color: '#333',
    marginBottom: 4,
  },
  clockIcon: {
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
  matchmakerBanner: {
    backgroundColor: '#6B46C1',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchmakerBannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'lowercase',
  },
});

export default MatchCard;
