import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, MoreVertical, Send, Puzzle, X } from 'lucide-react';
import AppShell from '../layout/AppShell';
import { useUserInfo } from './hooks/useUserInfo';
import './matchConvo.css';
import { games } from '../puzzles/puzzlesPage';
import { getImageUrl } from '../../utils/imageUtils';
import { DATER_SCREEN_BG, getRoleAccentColor } from '../../theme/roleTheme';

function formatBubbleTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getDate();
  const month = d.toLocaleDateString([], { month: 'short' }).toUpperCase();
  return `${day} ${month}`;
}

function getDateKey(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toDateString();
}

const MatchConvo = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const token = localStorage.getItem('token');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessageText, setNewMessageText] = useState('');
  const { userInfo } = useUserInfo(API_BASE_URL);
  const [selectedPuzzleType, setSelectedPuzzleType] = useState(games[0].name);
  const [selectedPuzzleLink, setSelectedPuzzleLink] = useState('');
  const [puzzleSheetOpen, setPuzzleSheetOpen] = useState(false);
  const [senderNames, setSenderNames] = useState({});
  const [senderRoles, setSenderRoles] = useState({});
  const [matchUser, setMatchUser] = useState(null);
  const [matchInfo, setMatchInfo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [approvedByMeLocally, setApprovedByMeLocally] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (matchId) {
      localStorage.setItem('activeMatchId', String(matchId));
    }
  }, [matchId]);

  useEffect(() => {
    const fetchConversation = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/conversation/${matchId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          let data = await res.json();
          if (data.length > 0) data = data[0].messages;
          setMessages(data || []);
        }
        if (res.status === 401) {
          const data = await res.json();
          if (data.error_code === 'TOKEN_EXPIRED') {
            localStorage.removeItem('token');
            window.location.href = '/';
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchConversation();
  }, [matchId]);

  useEffect(() => {
    const fetchNames = async () => {
      const uniqueIds = [...new Set(messages.map((m) => m.sender_id))];
      const names = {};
      const roles = {};
      for (const id of uniqueIds) {
        try {
          const res = await fetch(`${API_BASE_URL}/profile/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            names[id] = data.first_name;
            roles[id] = data.role;
          }
        } catch (err) {
          console.error('Error fetching sender name:', err);
        }
      }
      setSenderNames(names);
      setSenderRoles(roles);
    };
    if (messages.length) fetchNames();
  }, [messages, userInfo]);

  useEffect(() => {
    const fetchMatchUser = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/match/matches`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const allMatches = Array.isArray(data)
            ? data
            : [...(data.matched || []), ...(data.pending_approval || [])];
          const found = allMatches.find((m) => m.match_id === Number(matchId));
          if (found) {
            setMatchUser(found.match_user);
            setMatchInfo(found);
          }
        }
      } catch (err) {
        console.error('Error fetching match user:', err);
      }
    };
    fetchMatchUser();
  }, [matchId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const refreshMatchInfo = async () => {
    const matchRes = await fetch(`${API_BASE_URL}/match/matches`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!matchRes.ok) return;
    const matchData = await matchRes.json();
    const allMatches = Array.isArray(matchData)
      ? matchData
      : [...(matchData.matched || []), ...(matchData.pending_approval || [])];
    const updatedMatch = allMatches.find((m) => m.match_id === Number(matchId));
    if (updatedMatch) {
      setMatchInfo(updatedMatch);
      setMatchUser(updatedMatch.match_user);
    }
  };

  const sendMessage = async () => {
    if (!newMessageText.trim() && !selectedPuzzleLink) return;
    try {
      const bodyData = {};
      if (newMessageText.trim()) bodyData.message = newMessageText.trim();
      if (selectedPuzzleLink) {
        bodyData.puzzle_type = selectedPuzzleType;
        const link = selectedPuzzleLink.includes('?')
          ? `${selectedPuzzleLink}&matchId=${matchId}`
          : `${selectedPuzzleLink}?matchId=${matchId}`;
        bodyData.puzzle_link = link;
      }

      const res = await fetch(`${API_BASE_URL}/conversation/${matchId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bodyData),
      });

      if (res.ok || res.status === 201) {
        const data = await res.json();
        setMessages(data.messages || []);
        setNewMessageText('');
        setSelectedPuzzleLink('');
        setSelectedPuzzleType(games[0].name);
        await refreshMatchInfo();
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || 'Failed to send message');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePuzzleClick = (puzzleLink) => {
    localStorage.setItem('activeMatchId', matchId);
    if (!puzzleLink) return;

    try {
      const url = new URL(puzzleLink, window.location.origin);
      if (matchId != null) {
        url.searchParams.set('matchId', String(matchId));
      }
      navigate(`${url.pathname}${url.search}`);
    } catch {
      navigate(puzzleLink);
    }
  };

  const isMine = (msg) => msg.sender_id === userInfo?.id;

  const isMatchmakerMessage = (msg) => {
    const senderRole = senderRoles[msg.sender_id];
    if (senderRole === 'matchmaker') return true;
    if (
      senderRole === undefined &&
      userInfo?.role === 'matchmaker' &&
      !isMine(msg)
    ) {
      return true;
    }
    return false;
  };

  const getSenderLabel = (msg) => {
    if (isMine(msg) || isMatchmakerMessage(msg)) return '';
    const senderRole = senderRoles[msg.sender_id];
    const trimmedSenderName =
      senderNames[msg.sender_id] != null
        ? String(senderNames[msg.sender_id]).trim()
        : '';
    const senderName = trimmedSenderName || 'Loading...';
    if (senderRole === 'user' || senderRole === 'dater') {
      return trimmedSenderName ? `${trimmedSenderName} • Dater` : senderName;
    }
    if (senderRole === 'matchmaker') {
      if (userInfo?.role === 'user') return 'Matchmaker';
      return senderName;
    }
    return senderName;
  };

  const getBubbleHeaderLabel = (msg) => {
    if (isMatchmakerMessage(msg)) return 'Matchmaker';
    return getSenderLabel(msg);
  };

  const performApprove = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/match/approve/${matchId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setApprovedByMeLocally(true);
        if (data.waiting_for_other) {
          alert(
            'Your approval has been recorded. Waiting for the other matchmaker to approve.'
          );
        } else {
          alert('Match approved successfully');
        }
        await refreshMatchInfo();
        // Only leave the thread once the match is fully approved.
        const matchRes = await fetch(`${API_BASE_URL}/match/matches`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (matchRes.ok) {
          const matchData = await matchRes.json();
          const allMatches = Array.isArray(matchData)
            ? matchData
            : [...(matchData.matched || []), ...(matchData.pending_approval || [])];
          const updatedMatch = allMatches.find(
            (m) => m.match_id === Number(matchId)
          );
          if (updatedMatch?.status === 'matched') {
            navigate('/conversations');
          }
        }
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed to approve match');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to approve match');
    }
  };

  const handleApprove = async () => {
    try {
      if (
        matchInfo?.both_matchmakers_involved &&
        !matchInfo?.waiting_for_other_approval
      ) {
        const confirmed = window.confirm(
          "Once you approve this match, you won't be able to send a message until the other matchmaker approves it. Approve now?"
        );
        if (!confirmed) return;
      }
      await performApprove();
    } catch (err) {
      console.error(err);
      alert('Failed to approve match');
    }
  };

  const handleUnmatch = async () => {
    setMenuOpen(false);
    if (!window.confirm('Are you sure you want to unmatch? This cannot be undone.')) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/match/unmatch/${matchId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        navigate('/conversations', { replace: true });
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed to unmatch');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to unmatch');
    }
  };

  const handleReveal = async () => {
    setMenuOpen(false);
    try {
      const res = await fetch(`${API_BASE_URL}/match/reveal/${matchId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed to reveal match');
        return;
      }
      setMatchInfo((prev) => (prev ? { ...prev, blind_match: 'Revealed' } : prev));
    } catch (err) {
      console.error(err);
      alert('Something went wrong revealing the match.');
    }
  };

  const handleHide = async () => {
    setMenuOpen(false);
    try {
      const res = await fetch(`${API_BASE_URL}/match/hide/${matchId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed to hide match');
        return;
      }
      setMatchInfo((prev) => (prev ? { ...prev, blind_match: 'Blind' } : prev));
    } catch (err) {
      console.error(err);
      alert('Something went wrong hiding the match.');
    }
  };

  const handleBlock = async () => {
    setMenuOpen(false);
    if (
      !window.confirm(
        'Are you sure you want to block this user? You will never see each other again.'
      )
    ) {
      return;
    }
    const blockedUserId = matchUser?.id;
    if (!blockedUserId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/match/block/${blockedUserId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        navigate('/conversations', { replace: true });
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed to block user');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to block user');
    }
  };

  const isPendingApproval = matchInfo?.status === 'pending_approval';
  const messageCount = matchInfo?.message_count || 0;
  const canSendMore = messageCount < 10;
  const waitingForOtherApproval =
    matchInfo?.waiting_for_other_approval || approvedByMeLocally;
  const approvedByOtherMatchmaker = matchInfo?.approved_by_other_matchmaker || false;
  const effectiveIsBlind = matchInfo?.blind_match === 'Blind';
  const accentColor = getRoleAccentColor(userInfo?.role || 'matchmaker');
  const daterAccent = getRoleAccentColor('user');
  const isDater = userInfo?.role === 'user';
  const isMatchmaker = userInfo?.role === 'matchmaker';
  const isDaterToDaterChat = isDater && matchInfo?.status === 'matched';

  const mediatedChatAsDater =
    isDater &&
    matchInfo &&
    (matchInfo.status === 'pending_approval' ||
      matchInfo.status === 'matched');
  const canRemoveOwnMatchmaker =
    mediatedChatAsDater &&
    typeof matchInfo.dater_on_user_id_1_side === 'boolean' &&
    ((matchInfo.dater_on_user_id_1_side &&
      matchInfo.user_1_matchmaker_involved &&
      (matchInfo.approved_by_matcher_1 || matchInfo.status === 'matched') &&
      !matchInfo.dater_removed_matcher_1) ||
      (!matchInfo.dater_on_user_id_1_side &&
        matchInfo.user_2_matchmaker_involved &&
        (matchInfo.approved_by_matcher_2 || matchInfo.status === 'matched') &&
        !matchInfo.dater_removed_matcher_2));

  const showSpeakingWithMatchmakerForMatchmaker =
    isPendingApproval &&
    isMatchmaker &&
    matchInfo?.both_matchmakers_involved &&
    !approvedByOtherMatchmaker;
  const showSpeakingWithMatchmakerForDater = isPendingApproval && isDater;
  const showSpeakingWithMatchmaker =
    showSpeakingWithMatchmakerForMatchmaker || showSpeakingWithMatchmakerForDater;
  const showApprovedByOther =
    isPendingApproval && isMatchmaker && approvedByOtherMatchmaker;

  const hasLeftPendingApproval =
    !!matchInfo?.status && matchInfo.status !== 'pending_approval';
  const isApprovedByMatchmaker =
    isMatchmaker &&
    (hasLeftPendingApproval ||
      matchInfo?.status === 'matched' ||
      waitingForOtherApproval ||
      approvedByMeLocally);
  const showHeaderUnmatchAction =
    isMatchmaker && isPendingApproval && !isApprovedByMatchmaker;
  const showHeaderBlindToggle = isMatchmaker && !!matchInfo;

  const canComposerSend =
    Boolean(newMessageText.trim() || selectedPuzzleLink) &&
    !(isMatchmaker && isPendingApproval && (!canSendMore || waitingForOtherApproval));

  const showMatchmakerComposer =
    isMatchmaker && isPendingApproval && canSendMore && !waitingForOtherApproval;
  const showDaterComposer = isDater;

  const handleRemoveMyMatchmaker = async () => {
    setMenuOpen(false);
    if (
      !window.confirm(
        'Your matchmaker will no longer see this chat or send puzzles. Continue?'
      )
    ) {
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE_URL}/conversation/${matchId}/remove-my-matchmaker`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || 'Could not remove matchmaker');
        return;
      }
      setMatchInfo((prev) =>
        prev
          ? {
              ...prev,
              dater_removed_matcher_1:
                data.dater_removed_matcher_1 ?? prev.dater_removed_matcher_1,
              dater_removed_matcher_2:
                data.dater_removed_matcher_2 ?? prev.dater_removed_matcher_2,
            }
          : prev
      );
      alert('Your matchmaker has been removed from this conversation.');
    } catch (err) {
      console.error(err);
      alert('Something went wrong');
    }
  };

  const openProfile = () => {
    if (!matchUser?.id) return;
    if (effectiveIsBlind && !isMatchmaker) return;
    navigate(`/profile/${matchUser.id}`);
  };

  if (loading) {
    return (
      <AppShell
        showTabs={false}
        showHeader={false}
        shellBackgroundColor="#fafafa"
      >
        <div className="match-convo-container match-convo-loading-wrap">
          <p className="convo-loading">Loading conversation...</p>
        </div>
      </AppShell>
    );
  }

  const renderMessageBubble = (msg, mine, senderLabel) => {
    const bubbleClass = isDaterToDaterChat
      ? `mc-bubble mc-dater-bubble ${mine ? 'mc-dater-mine' : 'mc-dater-theirs'}`
      : `mc-bubble ${mine ? 'mc-mine' : 'mc-theirs'}`;
    const showMatchmakerBubbleChrome = isMatchmaker && !isDaterToDaterChat;
    const showDaterBubbleChrome = isDaterToDaterChat;
    const labelColor = showMatchmakerBubbleChrome
      ? mine
        ? 'rgba(255,255,255,0.9)'
        : accentColor
      : isDaterToDaterChat
        ? senderRoles[msg.sender_id] === 'matchmaker'
          ? '#6c5ce7'
          : daterAccent
        : senderRoles[msg.sender_id] === 'matchmaker'
          ? accentColor
          : '#6b7280';

    return (
      <div
        key={msg.id}
        className={bubbleClass}
        style={
          mine && !isDaterToDaterChat
            ? { backgroundColor: accentColor }
            : undefined
        }
      >
        {senderLabel ? (
          <div className="mc-sender-label" style={{ color: labelColor }}>
            {senderLabel}
          </div>
        ) : null}
        {msg.text && <p className="mc-message-text">{msg.text}</p>}
        {msg.puzzle_type && (
          <button
            type="button"
            className={
              showMatchmakerBubbleChrome
                ? `mc-puzzle-chip mc-puzzle-chip-mm${
                    mine ? ' mc-puzzle-chip-mm-mine' : ' mc-puzzle-chip-mm-theirs'
                  }`
                : showDaterBubbleChrome
                  ? `mc-puzzle-chip mc-puzzle-chip-dater${
                      mine ? ' mc-puzzle-chip-dater-mine' : ' mc-puzzle-chip-dater-theirs'
                    }`
                  : 'mc-puzzle-chip'
            }
            onClick={() => handlePuzzleClick(msg.puzzle_link)}
          >
            {showMatchmakerBubbleChrome || showDaterBubbleChrome ? (
              <>
                <Puzzle
                  size={16}
                  color={showDaterBubbleChrome ? daterAccent : accentColor}
                />
                <span>{`Click here to play "${msg.puzzle_type}"`}</span>
              </>
            ) : (
              `Play ${msg.puzzle_type}`
            )}
          </button>
        )}
        {isDaterToDaterChat && (
          <span className={`mc-timestamp${mine ? ' mc-timestamp-mine' : ''}`}>
            {formatBubbleTime(msg.timestamp)}
          </span>
        )}
      </div>
    );
  };

  const shellBackgroundColor = isDaterToDaterChat
    ? DATER_SCREEN_BG
    : '#fafafa';

  return (
    <AppShell
      showTabs={false}
      showHeader={false}
      shellBackgroundColor={shellBackgroundColor}
    >
      <div
        className={`match-convo-container${
          isDaterToDaterChat ? ' match-convo-dater' : ''
        }`}
      >
        <header className="mc-header">
          <button
            type="button"
            className="mc-back-btn"
            onClick={() => navigate('/conversations')}
            aria-label="Back"
          >
            <ChevronLeft size={24} color="#374151" />
          </button>

          {matchUser ? (
            <button
              type="button"
              className="mc-header-profile"
              onClick={openProfile}
              disabled={effectiveIsBlind && !isMatchmaker}
            >
              {matchUser.first_image ? (
                <img
                  src={getImageUrl(matchUser.first_image, API_BASE_URL)}
                  alt=""
                  className={`mc-header-avatar${
                    effectiveIsBlind && !isMatchmaker ? ' mc-avatar-blurred' : ''
                  }`}
                />
              ) : (
                <div
                  className="mc-header-avatar-placeholder"
                  style={{
                    backgroundColor: isDater ? daterAccent : accentColor,
                  }}
                >
                  {matchUser.first_name?.[0] || '?'}
                </div>
              )}
              <div className="mc-header-text">
                <span className="mc-header-name">
                  {matchUser.first_name || `Match ${matchId}`}
                </span>
                {isDaterToDaterChat ? (
                  <span className="mc-header-role" style={{ color: daterAccent }}>
                    DATER
                  </span>
                ) : showSpeakingWithMatchmaker ? (
                  <span
                    className="mc-header-subtitle"
                    style={{ color: isDater ? daterAccent : accentColor }}
                  >
                    (speaking with matchmaker)
                  </span>
                ) : showApprovedByOther ? (
                  <span className="mc-header-subtitle" style={{ color: accentColor }}>
                    (approved by other matchmaker)
                  </span>
                ) : null}
              </div>
            </button>
          ) : (
            <div className="mc-header-profile" />
          )}

          <div className="mc-header-actions">
            {isMatchmaker && isPendingApproval && !waitingForOtherApproval && (
              <button
                type="button"
                className="mc-approve-btn"
                style={{ backgroundColor: accentColor }}
                onClick={handleApprove}
              >
                Approve
              </button>
            )}
            <div className="mc-menu-wrap">
              <button
                type="button"
                className={`mc-menu-btn${isDater ? ' mc-menu-btn-dater' : ''}`}
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Conversation options"
                aria-expanded={menuOpen}
              >
                <MoreVertical size={18} color="#374151" />
              </button>
              {menuOpen && (
                <>
                  <button
                    type="button"
                    className="mc-menu-backdrop"
                    aria-label="Close menu"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="mc-menu-dropdown" role="menu">
                    {showHeaderBlindToggle && (
                      <button
                        type="button"
                        className="mc-menu-item"
                        onClick={effectiveIsBlind ? handleReveal : handleHide}
                      >
                        {effectiveIsBlind ? 'Reveal Match' : 'Blind Match'}
                      </button>
                    )}
                    {showHeaderUnmatchAction && (
                      <button
                        type="button"
                        className="mc-menu-item mc-menu-item-danger"
                        onClick={handleUnmatch}
                      >
                        Unmatch
                      </button>
                    )}
                    {isDater && canRemoveOwnMatchmaker && (
                      <button
                        type="button"
                        className="mc-menu-item"
                        onClick={handleRemoveMyMatchmaker}
                      >
                        Remove Matchmaker
                      </button>
                    )}
                    {isDater && (
                      <button
                        type="button"
                        className="mc-menu-item mc-menu-item-danger"
                        onClick={handleUnmatch}
                      >
                        Unmatch
                      </button>
                    )}
                    {isDater && (
                      <button
                        type="button"
                        className="mc-menu-item mc-menu-item-danger"
                        onClick={handleBlock}
                      >
                        Block
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {isMatchmaker && isPendingApproval && (
          <div className="mc-pending-banner">
            <p className="mc-pending-banner-text">
              {waitingForOtherApproval
                ? 'Waiting for approval'
                : canSendMore
                  ? `${10 - messageCount} messages left to break the ice`
                  : 'Message limit reached. Please approve to continue'}
            </p>
          </div>
        )}

        <div
          className={`mc-messages${isDaterToDaterChat ? ' mc-messages-dater' : ''}`}
        >
          {messages.length === 0 ? (
            <p className={`mc-empty${isDaterToDaterChat ? ' mc-empty-dater' : ''}`}>
              No messages yet. Say hi!
            </p>
          ) : isDaterToDaterChat ? (
            messages.map((msg, index) => {
              const mine = isMine(msg);
              const senderLabel = getSenderLabel(msg);
              const dateKey = getDateKey(msg.timestamp);
              const prevDateKey =
                index > 0 ? getDateKey(messages[index - 1].timestamp) : null;
              const showDateSep = dateKey && dateKey !== prevDateKey;
              return (
                <React.Fragment key={msg.id || index}>
                  {showDateSep ? (
                    <div className="mc-date-sep">{formatDateSeparator(msg.timestamp)}</div>
                  ) : null}
                  {renderMessageBubble(msg, mine, senderLabel)}
                </React.Fragment>
              );
            })
          ) : (
            messages.map((msg) =>
              renderMessageBubble(
                msg,
                isMine(msg),
                isMatchmaker ? getBubbleHeaderLabel(msg) : getSenderLabel(msg)
              )
            )
          )}
          <div ref={messagesEndRef} />
        </div>

        {selectedPuzzleLink ? (
          <div
            className={`mc-selected-puzzle${
              isDaterToDaterChat ? ' mc-selected-puzzle-dater' : ''
            }`}
          >
            <Puzzle
              size={20}
              color={isDaterToDaterChat ? daterAccent : accentColor}
            />
            <span
              className="mc-selected-puzzle-text"
              style={{ color: isDaterToDaterChat ? daterAccent : accentColor }}
            >
              {selectedPuzzleType}
            </span>
            <button
              type="button"
              className="mc-selected-puzzle-clear"
              aria-label="Clear puzzle"
              onClick={() => {
                setSelectedPuzzleLink('');
                setSelectedPuzzleType(games[0].name);
              }}
            >
              <X size={20} color="#666" />
            </button>
          </div>
        ) : null}

        {isDaterToDaterChat ? (
          <div className="mc-dater-composer">
            <div className="mc-dater-pill">
              <textarea
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                rows={1}
                className="mc-dater-input"
                placeholder="Message..."
              />
              <button
                type="button"
                className="mc-dater-send"
                style={{ backgroundColor: daterAccent }}
                onClick={sendMessage}
                disabled={!canComposerSend}
                aria-label="Send"
              >
                <Send size={16} color="#fff" />
              </button>
            </div>
            <button
              type="button"
              className="mc-dater-puzzle-btn"
              onClick={() => setPuzzleSheetOpen(true)}
            >
              <Puzzle size={16} color={daterAccent} />
              <span style={{ color: daterAccent }}>Puzzle</span>
            </button>
          </div>
        ) : (
          <div className="mc-composer-default">
            {(showDaterComposer || showMatchmakerComposer) && (
              <textarea
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                rows={1}
                className="mc-message-input"
                placeholder="Type a message..."
              />
            )}
            <div className="mc-send-actions">
              <button
                type="button"
                className="mc-send-btn"
                style={{ backgroundColor: accentColor }}
                onClick={sendMessage}
                disabled={!canComposerSend}
              >
                Send
              </button>
              <button
                type="button"
                className={`mc-puzzle-outline-btn${
                  isMatchmaker ? ' mc-puzzle-outline-btn-mm' : ''
                }`}
                style={{ borderColor: accentColor, color: accentColor }}
                onClick={() => setPuzzleSheetOpen(true)}
                disabled={
                  isMatchmaker &&
                  isPendingApproval &&
                  (!canSendMore || waitingForOtherApproval)
                }
              >
                <Puzzle size={18} color={accentColor} />
                Puzzle
              </button>
            </div>
          </div>
        )}
      </div>

      {puzzleSheetOpen && (
        <div className="mc-puzzle-sheet-root" role="dialog" aria-modal="true">
          <button
            type="button"
            className="mc-puzzle-sheet-backdrop"
            aria-label="Close puzzle picker"
            onClick={() => setPuzzleSheetOpen(false)}
          />
          <div className="mc-puzzle-sheet">
            <div className="mc-puzzle-sheet-header">
              <h3 className="mc-puzzle-sheet-title">Choose a Puzzle</h3>
              <button
                type="button"
                className="mc-puzzle-sheet-close"
                aria-label="Close"
                onClick={() => setPuzzleSheetOpen(false)}
              >
                <X size={22} color="#374151" />
              </button>
            </div>
            <div className="mc-puzzle-sheet-list">
              {games.map((game) => (
                <button
                  key={game.path}
                  type="button"
                  className="mc-puzzle-option"
                  onClick={() => {
                    setSelectedPuzzleType(game.name);
                    setSelectedPuzzleLink(game.path);
                    setPuzzleSheetOpen(false);
                    window.setTimeout(() => {
                      messagesEndRef.current?.scrollIntoView({
                        behavior: 'smooth',
                      });
                    }, 20);
                  }}
                >
                  <span
                    className="mc-puzzle-option-icon"
                    style={{ backgroundColor: game.iconBg || '#f3f4f6' }}
                  >
                    {game.icon}
                  </span>
                  <span className="mc-puzzle-option-text">
                    <span className="mc-puzzle-option-title">{game.name}</span>
                    <span className="mc-puzzle-option-desc">{game.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default MatchConvo;
