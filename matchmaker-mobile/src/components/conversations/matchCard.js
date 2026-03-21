import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { API_BASE_URL } from '../../env';
import { useNavigation } from '@react-navigation/native';
import { getImageUrl } from '../profile/utils/profileUtils';
import { getRoleAccentColor, getRoleContainerColor } from '../layout/components/RoleHeaderBanner';

/** Dark rose for pill copy; pairs with getRoleAccentColor('user') / #ffe6ee surfaces. */
const DATER_CONVERSATIONS_PILL_TEXT = '#be123c';

const MatchCard = ({
  matchObj,
  userInfo,
  unreadCount = 0,
  onOpenConversation,
  cardWidth,
  daterConversationsTheme = false,
}) => {
  const navigation = useNavigation();
  const resolvedCardWidth = cardWidth ?? 150;
  const imageSize = Math.min(85, Math.max(48, Math.floor(resolvedCardWidth - 28)));
  const imageRadius = imageSize / 2;
  const vennW = Math.min(110, Math.floor(resolvedCardWidth - 8));
  const vennH = Math.max(56, Math.floor(vennW * (85 / 110)));
  const vennCircle = Math.min(70, Math.floor(imageSize * 0.82));
  const vennCircleRadius = vennCircle / 2;
  const isDater = userInfo?.role === 'user';
  const useDaterConversationsPalette = daterConversationsTheme && isDater;
  const roleBadgeBackground = useDaterConversationsPalette
    ? getRoleContainerColor('user')
    : isDater
      ? '#fde7f3'
      : '#efe8ff';
  const roleBadgeText = useDaterConversationsPalette
    ? DATER_CONVERSATIONS_PILL_TEXT
    : isDater
      ? '#b83280'
      : '#5b3fa3';
  const bothMm = !!(
    matchObj.both_matchmakers_involved ||
    (matchObj.user_1_matchmaker_involved && matchObj.user_2_matchmaker_involved)
  );
  const oneMm = !!matchObj.user_1_matchmaker_involved || !!matchObj.user_2_matchmaker_involved;
  const isBlind = matchObj.blind_match === 'Blind';
  const isPendingApproval = matchObj.status === 'pending_approval' || matchObj.message_count !== undefined;
  const isWaitingForOtherApproval = !!matchObj.waiting_for_other_approval;
  const hasUnreadMessages = unreadCount > 0;
  const unreadBadgeColor = useDaterConversationsPalette
    ? getRoleAccentColor('user')
    : isDater
      ? '#ec4899'
      : '#6c5ce7';
  const unreadBadgeText = unreadCount > 99 ? '99+' : `${unreadCount}`;
  const showBothMmsPill = bothMm;
  const showMmLikedYouPill =
    userInfo?.role === 'user' &&
    !showBothMmsPill &&
    oneMm &&
    !matchObj.linked_dater;

  const getPendingBannerText = () => {
    if (!isPendingApproval) return '';
    if (userInfo?.role === 'matchmaker') {
      return isWaitingForOtherApproval ? 'Awaiting approval' : 'Approval needed';
    }
    return 'Awaiting approval';
  };

  const renderOverlappedImages = () => {
    if (!matchObj.linked_dater) return null;

    return (
      <View style={[styles.vennContainer, { width: vennW, height: vennH }]}>
        {/* Linked dater (right, behind) */}
        {matchObj.linked_dater.first_image ? (
          <Image
            source={{ uri: getImageUrl(matchObj.linked_dater.first_image, API_BASE_URL) }}
            style={[
              styles.vennImage,
              styles.vennRight,
              { width: vennCircle, height: vennCircle, borderRadius: vennCircleRadius },
            ]}
          />
        ) : (
          <View
            style={[
              styles.matchPlaceholder,
              styles.vennRight,
              { width: vennCircle, height: vennCircle, borderRadius: vennCircleRadius },
            ]}
          />
        )}

        {/* Match user (left, on top) */}
        {matchObj.match_user.first_image ? (
          <Image
            source={{ uri: getImageUrl(matchObj.match_user.first_image, API_BASE_URL) }}
            style={[
              styles.vennImage,
              styles.vennLeft,
              { width: vennCircle, height: vennCircle, borderRadius: vennCircleRadius },
            ]}
          />
        ) : (
          <View
            style={[
              styles.matchPlaceholder,
              styles.vennLeft,
              { width: vennCircle, height: vennCircle, borderRadius: vennCircleRadius },
            ]}
          />
        )}
      </View>
    );
  };

  const cardBorderColor = useDaterConversationsPalette ? 'rgba(239, 77, 115, 0.22)' : '#eaeaea';
  const avatarBorderColor = useDaterConversationsPalette ? 'rgba(239, 77, 115, 0.35)' : '#eee';
  const placeholderBg = useDaterConversationsPalette ? 'rgba(239, 77, 115, 0.08)' : '#f2f2f2';

  return (
    <TouchableOpacity
      style={[
        styles.matchCard,
        { width: resolvedCardWidth, borderColor: cardBorderColor },
      ]}
      onPress={() => {
        onOpenConversation?.(matchObj.match_id);
        navigation.navigate('MatchConvo', { matchId: matchObj.match_id, isBlind: isBlind });
      }}
      activeOpacity={0.7}
    >
      {hasUnreadMessages && (
        <View style={[styles.unreadBadge, { backgroundColor: unreadBadgeColor }]}>
          <Text style={styles.unreadBadgeText}>{unreadBadgeText}</Text>
        </View>
      )}
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
                      style={[
                        styles.matchImage,
                        {
                          width: imageSize,
                          height: imageSize,
                          borderRadius: imageRadius,
                          borderColor: avatarBorderColor,
                        },
                      ]}
                      resizeMode="cover"
                      blurRadius={isBlind ? 40 : 0}
                    />
                  ):(
                    <Image
                      source={{ uri: getImageUrl(matchObj.match_user.first_image, API_BASE_URL) }}
                      style={[
                        styles.matchImage,
                        {
                          width: imageSize,
                          height: imageSize,
                          borderRadius: imageRadius,
                          borderColor: avatarBorderColor,
                        },
                      ]}
                      resizeMode="cover"
                    />)}
                </View>
              ) : (
                <View
                  style={[
                    styles.matchPlaceholder,
                    {
                      width: imageSize,
                      height: imageSize,
                      borderRadius: imageRadius,
                      backgroundColor: placeholderBg,
                      borderWidth: useDaterConversationsPalette ? StyleSheet.hairlineWidth : 0,
                      borderColor: useDaterConversationsPalette ? avatarBorderColor : 'transparent',
                    },
                  ]}
                >
                  <Text style={styles.placeholderText}>No Image</Text>
                </View>
              )}
            </>
          )
        }

        {/* Pending-approval banner */}
        {isPendingApproval && (
          <View style={[styles.pendingBanner, { backgroundColor: roleBadgeBackground }]}>
            <Text
              style={[styles.pendingBannerText, { color: roleBadgeText }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {getPendingBannerText()}
            </Text>
          </View>
        )}

        <View style={styles.matchInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.matchName}>{matchObj.match_user.first_name}</Text>
          </View>
          {(isBlind || userInfo?.role === 'user' || showBothMmsPill) && (
            <View style={styles.pillsRow}>
              {isBlind && (
                <View style={[styles.blindMatchPill, { backgroundColor: roleBadgeBackground }]}>
                  <Text style={[styles.blindMatchPillText, { color: roleBadgeText }]}>Blind match</Text>
                </View>
              )}
              {showBothMmsPill && (
                <View style={[styles.bothMmsPill, { backgroundColor: roleBadgeBackground }]}>
                  <Text style={[styles.bothMmsPillText, { color: roleBadgeText }]}>Both MMs</Text>
                </View>
              )}
              {userInfo?.role === 'user' && (
                showMmLikedYouPill ? (
                  <View style={[styles.mmLikedYouPill, { backgroundColor: roleBadgeBackground }]}>
                    <Text style={[styles.mmLikedYouPillText, { color: roleBadgeText }]}>MM liked you</Text>
                  </View>
                ) : null
              )}
            </View>
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
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  vennContainer: {
    position: 'relative',
    marginBottom: 6,
  },
  vennImage: {
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
    borderWidth: 2,
    borderColor: '#eee',
  },
  matchPlaceholder: {
    backgroundColor: '#f2f2f2',
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
    textAlign: 'center',
  },
  pillsRow: {
    marginTop: 2,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  blindMatchPill: {
    backgroundColor: '#f2f2f2',
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  blindMatchPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  mmLikedYouPill: {
    backgroundColor: '#ece8ff',
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  mmLikedYouPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  bothMmsPill: {
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  bothMmsPillText: {
    fontSize: 11,
    fontWeight: '600',
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
  pendingBanner: {
    backgroundColor: '#efe5d3',
    width: '100%',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 0,
    marginTop: 8,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBannerText: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
});

export default MatchCard;
