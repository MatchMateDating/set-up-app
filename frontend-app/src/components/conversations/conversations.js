import React, { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal, Check } from 'lucide-react';
import './conversations.css';
import AppShell from '../layout/AppShell';
import FilterBottomSheet from '../layout/FilterBottomSheet';
import '../layout/filterBottomSheet.css';
import { useNavigate } from 'react-router-dom';
import MatchCard from './matchCard';
import ToggleConversations from './toggleConversations';
import { useMatches } from './hooks/useMatches';
import { useUserInfo } from './hooks/useUserInfo';
import { useMatchMessageMutes } from './hooks/useMatchMessageMutes';
import { getRoleAccentColor } from '../../theme/roleTheme';

/** Pending-approval row for matchmaker lists. */
function isMatchmakerPendingItem(match) {
  return match?.status === 'pending_approval' || match?.message_count !== undefined;
}

/**
 * Matchmaker unified list order: needs approval first, then awaiting other,
 * then fully matched — each group sorted by recent activity.
 */
function getMatchmakerItemSortRank(match) {
  if (isMatchmakerPendingItem(match)) {
    return match?.waiting_for_other_approval ? 1 : 0;
  }
  return 2;
}

/** True when the counterparty's side had a matchmaker, for list filtering. */
function isOtherPersonMatchmakerInvolved(match) {
  if (typeof match?.other_matchmaker_involved === 'boolean') {
    return match.other_matchmaker_involved;
  }
  if (typeof match?.dater_on_user_id_1_side === 'boolean') {
    return match.dater_on_user_id_1_side
      ? !!match.user_2_matchmaker_involved
      : !!match.user_1_matchmaker_involved;
  }
  return !!(
    match?.both_matchmakers_involved ||
    match?.linked_dater ||
    match?.other_person_matchmaker_involved
  );
}

const DEFAULT_CONVERSATION_FILTERS = {
  requireOtherMatchmaker: false,
  blindOnly: false,
  statusPending: true,
  statusApproved: true,
};

const Conversations = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [showDaterMatches, setShowDaterMatches] = useState(true);
  const [showConversationFilter, setShowConversationFilter] = useState(false);
  const [conversationFilters, setConversationFilters] = useState({
    ...DEFAULT_CONVERSATION_FILTERS,
  });
  const [conversationFilterDraft, setConversationFilterDraft] = useState({
    ...DEFAULT_CONVERSATION_FILTERS,
  });
  const { userInfo, setUserInfo } = useUserInfo(API_BASE_URL);
  const { matches, fetchMatches } = useMatches(API_BASE_URL);
  const { isMatchMessageMuted, toggleMatchMessageMuted } = useMatchMessageMutes(
    userInfo?.id
  );
  const matchedList = Array.isArray(matches) ? matches : (matches?.matched || []);
  const pendingApprovalList = Array.isArray(matches) ? [] : (matches?.pending_approval || []);
  const navigate = useNavigate();

  const isMatchmaker = userInfo?.role === 'matchmaker';
  const isDater = userInfo?.role === 'user';
  const accentColor = getRoleAccentColor(userInfo?.role);

  const fetchProfile = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/profile/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          localStorage.removeItem('token');
          window.location.href = '/';
          return;
        }
      }
      const data = await res.json();
      setUserInfo(data.user);
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchMatches();
  }, []);

  const getLastMessageTimestamp = (match) => {
    const t = match?.last_message_time;
    if (!t) return 0;
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? ms : 0;
  };

  const sortMatchesByRecentActivity = (list) => {
    if (!Array.isArray(list) || list.length === 0) return list;
    return [...list].sort((a, b) => {
      const tb = getLastMessageTimestamp(b);
      const ta = getLastMessageTimestamp(a);
      if (tb !== ta) return tb - ta;
      const idb = Number(b.match_id) || 0;
      const ida = Number(a.match_id) || 0;
      return idb - ida;
    });
  };

  const sortMatchmakerConversations = (list) => {
    if (!Array.isArray(list) || list.length === 0) return list;
    return [...list].sort((a, b) => {
      const rankDiff = getMatchmakerItemSortRank(a) - getMatchmakerItemSortRank(b);
      if (rankDiff !== 0) return rankDiff;
      const tb = getLastMessageTimestamp(b);
      const ta = getLastMessageTimestamp(a);
      if (tb !== ta) return tb - ta;
      const idb = Number(b.match_id) || 0;
      const ida = Number(a.match_id) || 0;
      return idb - ida;
    });
  };

  const applyConversationAttributeFilters = (list) => {
    if (!Array.isArray(list) || list.length === 0) return list;
    return list.filter((match) => {
      if (
        conversationFilters.requireOtherMatchmaker &&
        !isOtherPersonMatchmakerInvolved(match)
      ) {
        return false;
      }
      if (conversationFilters.blindOnly && match.blind_match !== 'Blind') {
        return false;
      }
      return true;
    });
  };

  const getFilteredMatches = () => {
    if (userInfo?.role === 'matchmaker') {
      let combined = [];
      if (conversationFilters.statusPending) {
        combined = [...combined, ...pendingApprovalList];
      }
      if (conversationFilters.statusApproved) {
        combined = [...combined, ...matchedList];
      }
      return {
        matched: sortMatchmakerConversations(
          applyConversationAttributeFilters(combined)
        ),
        pending_approval: [],
      };
    }

    if (!userInfo || userInfo.role !== 'user') {
      return {
        matched: sortMatchesByRecentActivity(
          applyConversationAttributeFilters(matchedList)
        ),
        pending_approval: sortMatchesByRecentActivity(
          applyConversationAttributeFilters(pendingApprovalList)
        ),
      };
    }

    const isMediatedForDater = (match) => {
      const onUser1 = match.dater_on_user_id_1_side;
      const userSideHasMm =
        typeof onUser1 === 'boolean'
          ? (onUser1 ? match.user_1_matchmaker_involved : match.user_2_matchmaker_involved)
          : false;
      const removedOwnMm =
        typeof onUser1 === 'boolean'
          ? (onUser1 ? match.dater_removed_matcher_1 : match.dater_removed_matcher_2)
          : false;
      const mediated =
        match.both_matchmakers_involved || match.linked_dater !== null || userSideHasMm;
      return mediated && !removedOwnMm;
    };

    const onSelectedTab = (match) => {
      const inMmTab = isMediatedForDater(match);
      return showDaterMatches ? !inMmTab : inMmTab;
    };

    const filteredMatched = matchedList.filter(onSelectedTab);
    const filteredPending = pendingApprovalList.filter(onSelectedTab);
    const combined = [...filteredMatched, ...filteredPending];

    return {
      matched: sortMatchesByRecentActivity(
        applyConversationAttributeFilters(combined)
      ),
      pending_approval: [],
    };
  };

  const filteredMatches = useMemo(
    () => getFilteredMatches(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      userInfo,
      matchedList,
      pendingApprovalList,
      showDaterMatches,
      conversationFilters,
    ]
  );

  const isMatchmakerEmpty =
    isMatchmaker && filteredMatches.matched.length === 0;
  const isDaterEmpty = isDater && filteredMatches.matched.length === 0;

  const activeConversationFilterCount =
    (conversationFilters.requireOtherMatchmaker ? 1 : 0) +
    (conversationFilters.blindOnly ? 1 : 0) +
    (isMatchmaker &&
    (!conversationFilters.statusPending || !conversationFilters.statusApproved)
      ? 1
      : 0);

  const dismissConversationFilter = () => {
    setConversationFilterDraft({ ...conversationFilters });
    setShowConversationFilter(false);
  };

  const saveConversationFilters = () => {
    setConversationFilters({ ...conversationFilterDraft });
    setShowConversationFilter(false);
  };

  const filterHeaderTrailing = (
    <button
      type="button"
      className={`app-shell-filter-btn${isDater ? ' app-shell-filter-btn-dater' : ''}`}
      onClick={() => {
        setConversationFilterDraft({ ...conversationFilters });
        setShowConversationFilter(true);
      }}
      aria-label="Open conversation filters"
    >
      <SlidersHorizontal size={22} color="#374151" />
      {activeConversationFilterCount > 0 ? (
        <span
          className="app-shell-filter-badge"
          style={{ backgroundColor: accentColor }}
        >
          {activeConversationFilterCount}
        </span>
      ) : null}
    </button>
  );

  return (
    <AppShell
      headerCenter={isDater ? 'Conversations' : null}
      headerTrailing={filterHeaderTrailing}
      onSelectedDaterChange={() => {
        fetchProfile();
        fetchMatches();
      }}
    >
      <div
        className={`conversations-body${
          isMatchmaker ? ' conversations-body-matchmaker' : ''
        }${isDater ? ' conversations-body-dater' : ''}${
          isMatchmakerEmpty || isDaterEmpty ? ' conversations-body-empty' : ''
        }`}
      >
        {isDater && (
          <div className="conversations-toggle-section">
            <ToggleConversations
              showDaterMatches={showDaterMatches}
              setShowDaterMatches={setShowDaterMatches}
              accentColor="#ef4d73"
            />
          </div>
        )}

        {isMatchmaker ? (
          <div
            className={`match-list match-list-modern${
              isMatchmakerEmpty ? ' match-list-empty' : ''
            }`}
          >
            {filteredMatches.matched.length > 0 ? (
              filteredMatches.matched.map((matchObj) => (
                <MatchCard
                  key={`chat-${matchObj.match_id}`}
                  matchObj={matchObj}
                  API_BASE_URL={API_BASE_URL}
                  userInfo={userInfo}
                  navigate={navigate}
                  matchmakerConversationsTheme
                  unreadCount={matchObj.unread_count || 0}
                  isMatchMessageMuted={isMatchMessageMuted}
                  toggleMatchMessageMuted={toggleMatchMessageMuted}
                />
              ))
            ) : (
              <p className="conversations-empty">No conversations yet!</p>
            )}
          </div>
        ) : isDater ? (
          <div
            className={`match-list match-list-modern${
              isDaterEmpty ? ' match-list-empty' : ''
            }`}
          >
            {filteredMatches.matched.length > 0 ? (
              filteredMatches.matched.map((matchObj) => (
                <MatchCard
                  key={`matched-${matchObj.match_id}`}
                  matchObj={matchObj}
                  API_BASE_URL={API_BASE_URL}
                  userInfo={userInfo}
                  navigate={navigate}
                  daterConversationsTheme
                  unreadCount={matchObj.unread_count || 0}
                  isMatchMessageMuted={isMatchMessageMuted}
                  toggleMatchMessageMuted={toggleMatchMessageMuted}
                />
              ))
            ) : (
              <p className="conversations-empty">No matches yet!</p>
            )}
          </div>
        ) : null}
      </div>

      <FilterBottomSheet
        open={showConversationFilter}
        accentColor={accentColor}
        onClose={dismissConversationFilter}
        onSave={saveConversationFilters}
      >
        {isMatchmaker ? (
          <>
            <span className="filter-section-label">STATUS</span>
            <button
              type="button"
              className="filter-checkbox-row"
              onClick={() =>
                setConversationFilterDraft((d) => ({
                  ...d,
                  statusPending: !d.statusPending,
                }))
              }
            >
              <span
                className="filter-checkbox"
                style={{ borderColor: accentColor }}
              >
                {conversationFilterDraft.statusPending ? (
                  <Check size={16} color={accentColor} strokeWidth={3} />
                ) : null}
              </span>
              <span className="filter-checkbox-label">Pending</span>
            </button>
            <button
              type="button"
              className="filter-checkbox-row"
              onClick={() =>
                setConversationFilterDraft((d) => ({
                  ...d,
                  statusApproved: !d.statusApproved,
                }))
              }
            >
              <span
                className="filter-checkbox"
                style={{ borderColor: accentColor }}
              >
                {conversationFilterDraft.statusApproved ? (
                  <Check size={16} color={accentColor} strokeWidth={3} />
                ) : null}
              </span>
              <span className="filter-checkbox-label">Approved</span>
            </button>
            <span className="filter-section-label filter-section-label-spaced">
              CONVERSATION TYPE
            </span>
          </>
        ) : (
          <span className="filter-section-label">CONVERSATION TYPE</span>
        )}

        <button
          type="button"
          className="filter-checkbox-row"
          onClick={() =>
            setConversationFilterDraft((d) => ({
              ...d,
              requireOtherMatchmaker: !d.requireOtherMatchmaker,
            }))
          }
        >
          <span className="filter-checkbox" style={{ borderColor: accentColor }}>
            {conversationFilterDraft.requireOtherMatchmaker ? (
              <Check size={16} color={accentColor} strokeWidth={3} />
            ) : null}
          </span>
          <span className="filter-checkbox-label">Other Matchmaker Involved</span>
        </button>

        <button
          type="button"
          className="filter-checkbox-row"
          onClick={() =>
            setConversationFilterDraft((d) => ({
              ...d,
              blindOnly: !d.blindOnly,
            }))
          }
        >
          <span className="filter-checkbox" style={{ borderColor: accentColor }}>
            {conversationFilterDraft.blindOnly ? (
              <Check size={16} color={accentColor} strokeWidth={3} />
            ) : null}
          </span>
          <span className="filter-checkbox-label">Blind match only</span>
        </button>
      </FilterBottomSheet>
    </AppShell>
  );
};

export default Conversations;
