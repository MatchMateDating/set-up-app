import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../env';
import { useNavigation } from '@react-navigation/native';
import { getImageUrl } from '../profile/utils/profileUtils';
import { getRoleAccentColor, getRoleContainerColor } from '../layout/components/RoleHeaderBanner';
import { useNotifications } from '../../context/NotificationContext';

/** Dark rose for pill copy; pairs with getRoleAccentColor('user') / #ffe6ee surfaces. */
const DATER_CONVERSATIONS_PILL_TEXT = '#be123c';

function formatLastMessageTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const MatchCard = ({
  matchObj,
  userInfo,
  unreadCount = 0,
  onOpenConversation,
  cardWidth,
  daterConversationsTheme = false,
}) => {
  const navigation = useNavigation();
  const {
    notificationsEnabled,
    notificationPreferences,
    toggleMatchMessageMuted,
    isMatchMessageMuted,
  } = useNotifications();
  const resolvedCardWidth = cardWidth ?? 150;
  const imageSize = Math.min(72, Math.max(48, Math.floor(resolvedCardWidth - 28)));
  const imageRadius = imageSize / 2;
  const vennW = Math.min(104, Math.max(72, Math.floor(imageSize * 1.35)));
  const vennH = Math.max(50, Math.floor(vennW * (85 / 110)));
  const vennCircle = Math.min(58, Math.floor(imageSize * 0.88));
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

  const isApprovedMatchRow = matchObj.status === 'matched';
  const showPerMatchMessageBell =
    notificationsEnabled &&
    notificationPreferences.newMessageNotification &&
    (userInfo?.role !== 'matchmaker' ||
      !isApprovedMatchRow ||
      notificationPreferences.approvedMatchMessageNotification);
  const messageMutedForMatch = isMatchMessageMuted(matchObj.match_id);
  const bellIconColor = messageMutedForMatch
    ? '#94a3b8'
    : useDaterConversationsPalette
      ? DATER_CONVERSATIONS_PILL_TEXT
      : '#64748b';

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
        <View style={styles.thumbnailColumn}>
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
                    ) : (
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
                      />
                    )}
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
            )}
        </View>

        <View style={styles.textColumn}>
          <View style={styles.nameRow}>
            <Text style={styles.matchName} numberOfLines={1}>{matchObj.match_user.first_name}</Text>
            {matchObj.last_message_time ? (
              <Text style={styles.lastMessageTime}>
                {formatLastMessageTime(matchObj.last_message_time)}
              </Text>
            ) : null}
          </View>

          {isPendingApproval && (
            <View style={[styles.pendingBanner, { backgroundColor: roleBadgeBackground }]}>
              <Text
                style={[styles.pendingBannerText, { color: roleBadgeText }]}
                numberOfLines={1}
              >
                {getPendingBannerText()}
              </Text>
            </View>
          )}

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

        {showPerMatchMessageBell ? (
          <TouchableOpacity
            style={[
              styles.messageBellButton,
              hasUnreadMessages && styles.messageBellButtonWithUnreadBadge,
            ]}
            onPress={() => toggleMatchMessageMuted(matchObj.match_id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={
              messageMutedForMatch
                ? 'Turn on message notifications for this match'
                : 'Mute message notifications for this match'
            }
          >
            <MaterialCommunityIcons
              name={messageMutedForMatch ? 'bell-off-outline' : 'bell-outline'}
              size={22}
              color={bellIconColor}
            />
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  matchCard: {
    flexDirection: 'column',
    alignItems: 'stretch',
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
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    width: '100%',
  },
  thumbnailColumn: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  messageBellButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    minHeight: 44,
    flexShrink: 0,
    marginLeft: 4,
  },
  messageBellButtonWithUnreadBadge: {
    marginRight: 24,
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  matchName: {
    fontWeight: '600',
    fontSize: 15,
    color: '#333',
    textAlign: 'left',
    flexShrink: 1,
  },
  lastMessageTime: {
    fontSize: 11,
    color: '#999',
    flexShrink: 0,
  },
  pillsRow: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'flex-start',
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
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pendingBannerText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default MatchCard;
