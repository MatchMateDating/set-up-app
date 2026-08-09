import React from 'react';
import { Bell, BellOff } from 'lucide-react';
import './matchCard.css';
import { getImageUrl } from '../../utils/imageUtils';
import { getRoleAccentColor, getRoleContainerColor } from '../../theme/roleTheme';
import { useMatchMessageMutes } from './hooks/useMatchMessageMutes';

/** Dark rose for pill copy; pairs with dater accent / #ffe6ee surfaces. */
const DATER_CONVERSATIONS_PILL_TEXT = '#be123c';
const GENERIC_PREVIEW = 'Sent a message';

function formatLastMessageTime(isoString, conversational = false) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) {
    return conversational ? `${diffMins} min ago` : `${diffMins}m ago`;
  }
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return conversational ? `${diffHours} hr ago` : `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return conversational ? `${diffDays} days ago` : `${diffDays}d ago`;
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function readEnabledPreference(user, snakeKey) {
  if (!user?.notifications_enabled) return false;
  const raw = user[snakeKey];
  return raw == null ? true : Boolean(raw);
}

function getMatchCardMessagePreview(matchObj, userInfo) {
  const preview = (matchObj?.last_message || '').trim();
  const sentCount =
    typeof matchObj?.message_count === 'number' ? matchObj.message_count : 0;
  const hasMessages =
    !!preview ||
    !!matchObj?.last_message_time ||
    (userInfo?.role === 'matchmaker' && sentCount > 0);

  if (!hasMessages) {
    return { body: '', showYouPrefix: false };
  }

  const fromSelf =
    !!matchObj?.last_message_from_self ||
    (userInfo?.role === 'matchmaker' && sentCount > 0);

  return {
    body: preview || GENERIC_PREVIEW,
    showYouPrefix: fromSelf && !!preview,
  };
}

const MatchCard = ({
  matchObj,
  API_BASE_URL,
  userInfo,
  navigate,
  unreadCount = 0,
  daterConversationsTheme = false,
  matchmakerConversationsTheme = false,
  isMatchMessageMuted: isMatchMessageMutedProp,
  toggleMatchMessageMuted: toggleMatchMessageMutedProp,
}) => {
  const muteFromHook = useMatchMessageMutes(
    isMatchMessageMutedProp && toggleMatchMessageMutedProp ? null : userInfo?.id
  );
  const isMatchMessageMuted =
    isMatchMessageMutedProp || muteFromHook.isMatchMessageMuted;
  const toggleMatchMessageMuted =
    toggleMatchMessageMutedProp || muteFromHook.toggleMatchMessageMuted;

  const isDater = userInfo?.role === 'user';
  const useModernConversationsLayout =
    (daterConversationsTheme && isDater) || matchmakerConversationsTheme;
  const useDaterConversationsPalette = daterConversationsTheme && isDater;

  const bothMm = !!(
    matchObj.both_matchmakers_involved ||
    (matchObj.user_1_matchmaker_involved && matchObj.user_2_matchmaker_involved)
  );
  const oneMm =
    !!matchObj.user_1_matchmaker_involved || !!matchObj.user_2_matchmaker_involved;
  const isBlind = matchObj.blind_match === 'Blind';
  const isPendingApproval =
    matchObj.status === 'pending_approval' || matchObj.message_count !== undefined;
  const isWaitingForOtherApproval = !!matchObj.waiting_for_other_approval;
  const hasUnreadMessages = unreadCount > 0;

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
  const unreadBadgeColor = useDaterConversationsPalette
    ? getRoleAccentColor('user')
    : isDater
      ? '#ec4899'
      : '#6c5ce7';

  const { body: messagePreviewBody, showYouPrefix: viewerSentMessage } =
    getMatchCardMessagePreview(matchObj, userInfo);
  const showYouPrefix = useModernConversationsLayout && viewerSentMessage;
  const lastMessageTimeLabel = matchObj.last_message_time
    ? formatLastMessageTime(
        matchObj.last_message_time,
        useModernConversationsLayout
      )
    : '';
  const showMessagePreview =
    useModernConversationsLayout &&
    !!(messagePreviewBody || lastMessageTimeLabel);
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

  const notificationsEnabled = Boolean(
    userInfo?.notifications_enabled ?? false
  );
  const newMessageNotification = readEnabledPreference(
    userInfo,
    'new_message_notifications'
  );
  const approvedMatchMessageNotification = readEnabledPreference(
    userInfo,
    'approved_match_message_notifications'
  );
  const isApprovedMatchRow = matchObj.status === 'matched';
  const showPerMatchMessageBell =
    notificationsEnabled &&
    newMessageNotification &&
    (userInfo?.role !== 'matchmaker' ||
      !isApprovedMatchRow ||
      approvedMatchMessageNotification);
  const messageMutedForMatch = isMatchMessageMuted(matchObj.match_id);
  const bellIconColor = messageMutedForMatch
    ? '#94a3b8'
    : useDaterConversationsPalette
      ? DATER_CONVERSATIONS_PILL_TEXT
      : '#64748b';

  const openConversation = () => {
    navigate(`/conversation/${matchObj.match_id}`);
  };

  const renderOverlappedImages = () => {
    if (!matchObj.linked_dater) return null;

    return (
      <div className="mc-venn">
        {matchObj.linked_dater.first_image ? (
          <img
            src={getImageUrl(matchObj.linked_dater.first_image, API_BASE_URL)}
            alt=""
            className="mc-venn-image mc-venn-right"
          />
        ) : (
          <div className="mc-venn-placeholder mc-venn-right" />
        )}
        {matchObj.match_user.first_image ? (
          <img
            src={getImageUrl(matchObj.match_user.first_image, API_BASE_URL)}
            alt=""
            className={`mc-venn-image mc-venn-left${isBlind ? ' blurred' : ''}`}
          />
        ) : (
          <div className="mc-venn-placeholder mc-venn-left" />
        )}
      </div>
    );
  };

  const cardClassName = [
    'match-card',
    useModernConversationsLayout ? 'match-card-modern' : '',
    useDaterConversationsPalette ? 'match-card-modern-dater' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      role="button"
      tabIndex={0}
      className={cardClassName}
      onClick={openConversation}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openConversation();
        }
      }}
    >
      {!useModernConversationsLayout && hasUnreadMessages ? (
        <span
          className="mc-unread-badge"
          style={{ backgroundColor: unreadBadgeColor }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}

      <div
        className={`mc-profile-row${
          useModernConversationsLayout ? ' mc-profile-row-modern' : ''
        }`}
      >
        <div className="mc-thumbnail">
          {userInfo?.role === 'matchmaker' && matchObj.linked_dater ? (
            renderOverlappedImages()
          ) : matchObj.match_user.first_image ? (
            <img
              src={getImageUrl(matchObj.match_user.first_image, API_BASE_URL)}
              alt=""
              className={`mc-avatar${isBlind ? ' blurred' : ''}${
                useDaterConversationsPalette ? ' mc-avatar-dater' : ''
              }`}
            />
          ) : (
            <div
              className={`mc-avatar-placeholder${
                useDaterConversationsPalette ? ' mc-avatar-placeholder-dater' : ''
              }`}
            >
              No Image
            </div>
          )}
        </div>

        <div className="mc-text">
          <div className="mc-name-row">
            <span
              className={`mc-name${
                useModernConversationsLayout ? ' mc-name-modern' : ''
              }`}
            >
              {matchObj.match_user.first_name}
            </span>
            {!useModernConversationsLayout && matchObj.last_message_time ? (
              <span className="mc-last-time">
                {formatLastMessageTime(matchObj.last_message_time)}
              </span>
            ) : null}
          </div>

          {showMessagePreview ? (
            <div className="mc-preview-row">
              <span className="mc-preview-text">
                {showYouPrefix ? (
                  <span className="mc-preview-you">You: </span>
                ) : null}
                {messagePreviewBody}
              </span>
              {lastMessageTimeLabel ? (
                <span className="mc-preview-time">{lastMessageTimeLabel}</span>
              ) : null}
            </div>
          ) : null}

          {isPendingApproval ? (
            <div
              className={`mc-pending-banner${
                useModernConversationsLayout ? ' mc-pending-banner-modern' : ''
              }`}
              style={{ backgroundColor: roleBadgeBackground, color: roleBadgeText }}
            >
              {getPendingBannerText()}
            </div>
          ) : null}

          {(isBlind || userInfo?.role === 'user' || showBothMmsPill) && (
            <div
              className={`mc-pills${
                useModernConversationsLayout ? ' mc-pills-modern' : ''
              }`}
            >
              {isBlind ? (
                <span
                  className="mc-pill"
                  style={{
                    backgroundColor: roleBadgeBackground,
                    color: roleBadgeText,
                  }}
                >
                  Blind match
                </span>
              ) : null}
              {showBothMmsPill ? (
                <span
                  className="mc-pill"
                  style={{
                    backgroundColor: roleBadgeBackground,
                    color: roleBadgeText,
                  }}
                >
                  Both MMs
                </span>
              ) : null}
              {userInfo?.role === 'user' && showMmLikedYouPill ? (
                <span
                  className="mc-pill"
                  style={{
                    backgroundColor: roleBadgeBackground,
                    color: roleBadgeText,
                  }}
                >
                  MM liked you
                </span>
              ) : null}
            </div>
          )}
        </div>

        <div className="mc-right">
          {showPerMatchMessageBell ? (
            <button
              type="button"
              className="mc-bell-btn"
              onClick={(e) => {
                e.stopPropagation();
                toggleMatchMessageMuted(matchObj.match_id);
              }}
              aria-label={
                messageMutedForMatch
                  ? 'Turn on message notifications for this match'
                  : 'Mute message notifications for this match'
              }
            >
              {messageMutedForMatch ? (
                <BellOff size={22} color={bellIconColor} />
              ) : (
                <Bell size={22} color={bellIconColor} />
              )}
            </button>
          ) : null}
          {useModernConversationsLayout && hasUnreadMessages ? (
            <span
              className="mc-unread-dot"
              style={{ backgroundColor: unreadBadgeColor }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default MatchCard;
