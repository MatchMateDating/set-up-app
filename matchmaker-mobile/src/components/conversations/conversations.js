import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { API_BASE_URL } from '../../env';
import MatchCard from './matchCard';
import ToggleConversationsDater from './toggleConversationsDater';
import ToggleConversationsMatcher from './toggleConversationsMatcher';
import { useMatches } from './hooks/useMatches';
import { useUserInfo } from './hooks/useUserInfo';
import { useNotificationPolling } from './hooks/useNotificationPolling';
import { getRoleAccentColor, getRoleBackgroundTint } from '../layout/components/RoleHeaderBanner';
import { UserContext } from '../../context/UserContext';

const MATCH_CARD_COLUMNS = 3;
const CONTENT_HORIZONTAL_PADDING = 16;
const MATCH_CARD_COLUMN_GAP = 10;

/** Latest activity = max Message.timestamp in the thread (aligns with messageDB.timestamp). */
function getLatestMessageActivityMs(messages) {
  let max = 0;
  for (const message of messages) {
    const t = new Date(message?.timestamp).getTime();
    if (Number.isFinite(t) && t > max) max = t;
  }
  return max;
}

const Conversations = () => {
  const { width: windowWidth } = useWindowDimensions();
  const listInnerWidth = windowWidth - CONTENT_HORIZONTAL_PADDING * 2;
  const matchCardWidth = Math.floor(
    (listInnerWidth - MATCH_CARD_COLUMN_GAP * (MATCH_CARD_COLUMNS - 1)) / MATCH_CARD_COLUMNS
  );

  const READ_STATE_STORAGE_PREFIX = 'conversationLastRead';
  const ACTIVE_CONVERSATION_STORAGE_KEY = 'activeConversationMatchId';
  const { user: contextUser } = useContext(UserContext);
  const [showDaterMatches, setShowDaterMatches] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [roleHint, setRoleHint] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [lastActivityMsByMatchId, setLastActivityMsByMatchId] = useState({});
  const { userInfo, setUserInfo, referrerInfo, setReferrerInfo, loading: userLoading } = useUserInfo(API_BASE_URL);
  const { matches, setMatches, loading: matchesLoading, fetchMatches } = useMatches(API_BASE_URL);
  const matchedList = Array.isArray(matches) ? matches : (matches?.matched || []);
  const pendingApprovalList = Array.isArray(matches) ? [] : (matches?.pending_approval || []);
  const navigation = useNavigation();
  const [referrer, setReferrer] = useState(null);
  const selectedDaterId = userInfo?.referrer_id || userInfo?.referred_by_id || null;
  const currentConversationUserId = userInfo?.referred_by_id ?? userInfo?.id ?? null;
  const getConversationReadStateKey = (matchId) =>
    `${READ_STATE_STORAGE_PREFIX}:${userInfo?.id || 'unknown'}:${matchId}`;
  
  // Initialize notification polling
  useNotificationPolling();

  useEffect(() => {
    const loadRoleHint = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (!storedUser) return;
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser?.role) {
          setRoleHint(parsedUser.role);
        }
      } catch (err) {
        console.error('Error loading role hint:', err);
      }
    };
    loadRoleHint();
  }, []);

  useEffect(() => {
    if (userInfo?.role) {
      setRoleHint(userInfo.role);
    }
  }, [userInfo?.role]);

  useEffect(() => {
    if (!contextUser) {
      return;
    }

    setUserInfo((prevUserInfo) => {
      if (!prevUserInfo) {
        return contextUser;
      }

      const sameUser = prevUserInfo.id === contextUser.id;
      const sameSelectedDater =
        prevUserInfo.referrer_id === contextUser.referrer_id &&
        prevUserInfo.referred_by_id === contextUser.referred_by_id;
      const sameLinkedDaters =
        JSON.stringify(prevUserInfo.linked_daters || []) === JSON.stringify(contextUser.linked_daters || []);

      if (sameUser && sameSelectedDater && sameLinkedDaters) {
        return prevUserInfo;
      }

      return { ...prevUserInfo, ...contextUser };
    });
  }, [contextUser, setUserInfo]);

  const loading = userLoading || matchesLoading || refreshing;

  const markConversationAsRead = async (matchId, readAtIso) => {
    if (!matchId) return;
    const key = getConversationReadStateKey(matchId);
    const readMarker = {
      timestamp: readAtIso || new Date().toISOString(),
      messageId: null,
    };
    await AsyncStorage.setItem(key, JSON.stringify(readMarker));
    setUnreadCounts((prev) => ({ ...prev, [matchId]: 0 }));
  };

  const refreshUnreadCounts = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || currentConversationUserId == null) return;

      const allMatches = Array.isArray(matches)
        ? matches
        : [...(matches?.matched || []), ...(matches?.pending_approval || [])];
      if (allMatches.length === 0) {
        setUnreadCounts({});
        setLastActivityMsByMatchId({});
        return;
      }

      const activeConversationMatchId = await AsyncStorage.getItem(ACTIVE_CONVERSATION_STORAGE_KEY);
      const nextUnreadCounts = {};
      const activityUpdates = {};

      for (const match of allMatches) {
        const matchId = match.match_id;
        if (!matchId) continue;

        const conversationRes = await fetch(`${API_BASE_URL}/conversation/${matchId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!conversationRes.ok) {
          nextUnreadCounts[matchId] = unreadCounts[matchId] || 0;
          continue;
        }

        const conversationData = await conversationRes.json();
        const conversationMessages =
          Array.isArray(conversationData) && conversationData.length > 0
            ? (conversationData[0].messages || [])
            : [];
        activityUpdates[matchId] = getLatestMessageActivityMs(conversationMessages);
        const latestMessage = conversationMessages[conversationMessages.length - 1];
        const latestTimestamp = latestMessage?.timestamp || new Date().toISOString();
        const latestMessageId = latestMessage?.id ?? latestMessage?.message_id ?? null;
        const readStateKey = getConversationReadStateKey(matchId);
        const storedReadState = await AsyncStorage.getItem(readStateKey);
        let lastReadIso = null;
        let lastReadMessageId = null;

        if (storedReadState) {
          if (storedReadState.trim().startsWith('{')) {
            try {
              const parsedReadState = JSON.parse(storedReadState);
              lastReadIso = parsedReadState?.timestamp || null;
              lastReadMessageId = parsedReadState?.messageId ?? null;
            } catch (err) {
              lastReadIso = storedReadState;
            }
          } else {
            // Backward compatibility with old plain ISO storage.
            lastReadIso = storedReadState;
          }
        }

        // First run baseline per conversation to avoid historical count spikes.
        if (!lastReadIso) {
          await AsyncStorage.setItem(readStateKey, JSON.stringify({
            timestamp: latestTimestamp,
            messageId: latestMessageId,
          }));
          nextUnreadCounts[matchId] = 0;
          continue;
        }

        // If this conversation is currently open, treat incoming messages as already read.
        if (String(matchId) === String(activeConversationMatchId)) {
          await AsyncStorage.setItem(readStateKey, JSON.stringify({
            timestamp: latestTimestamp,
            messageId: latestMessageId,
          }));
          nextUnreadCounts[matchId] = 0;
          continue;
        }

        let unreadMessages = [];
        if (lastReadMessageId != null) {
          const lastReadIndex = conversationMessages.findIndex(
            (message) =>
              (message?.id ?? message?.message_id ?? null) === lastReadMessageId
          );
          if (lastReadIndex >= 0) {
            unreadMessages = conversationMessages.slice(lastReadIndex + 1);
          }
        }

        if (unreadMessages.length === 0) {
          const lastReadMs = new Date(lastReadIso).getTime();
          unreadMessages = conversationMessages.filter((message) => {
            const messageTs = new Date(message?.timestamp).getTime();
            return Number.isFinite(messageTs) && messageTs > lastReadMs;
          });
        }

        const unreadCount = unreadMessages.reduce((count, message) => {
          const hasReceiver = message?.receiver_id !== undefined && message?.receiver_id !== null;
          if (hasReceiver) {
            return String(message.receiver_id) === String(currentConversationUserId) ? count + 1 : count;
          }

          return String(message?.sender_id) !== String(currentConversationUserId) ? count + 1 : count;
        }, 0);

        nextUnreadCounts[matchId] = unreadCount;
      }

      setUnreadCounts(nextUnreadCounts);
      setLastActivityMsByMatchId((prev) => {
        const matchIds = new Set(
          allMatches.map((m) => m.match_id).filter((id) => id != null)
        );
        const next = {};
        for (const id of matchIds) {
          next[id] = Object.prototype.hasOwnProperty.call(activityUpdates, id)
            ? activityUpdates[id]
            : prev[id] ?? 0;
        }
        return next;
      });
    } catch (err) {
      console.error('Error refreshing unread counts:', err);
    }
  };

  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/profile/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          await AsyncStorage.removeItem('token');
          Alert.alert('Session expired', 'Please log in again.');
          navigation.navigate('Login');
          return;
        }
      }

      if (!res.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await res.json();
      setUserInfo(data.user);
      setReferrer(data.referrer || null);
    } catch (err) {
      console.error('Error loading profile:', err);
      Alert.alert('Error', 'Failed to load profile');
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchMatches();
  }, []);

  useEffect(() => {
    if (!userInfo || userInfo.role !== 'matchmaker') {
      return;
    }

    setRefreshing(true);
    const timer = setTimeout(() => {
      Promise.all([fetchProfile(), fetchMatches()]).finally(() => {
        setRefreshing(false);
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [selectedDaterId]);

  // Refresh profile and matches when page comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // This screen is the thread list, so no single conversation should be marked active.
      AsyncStorage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY).catch((err) => {
        console.error('Error clearing active conversation marker on list focus:', err);
      });

      // Prevent stale account data flash while switching roles/daters.
      setRefreshing(true);
      setUserInfo(null);
      setReferrer(null);
      setMatches({ matched: [], pending_approval: [] });
      const timer = setTimeout(() => {
        Promise.all([fetchProfile(), fetchMatches()])
          .finally(() => {
            setRefreshing(false);
          });
      }, 100);
      return () => clearTimeout(timer);
    }, [])
  );

  useFocusEffect(
    React.useCallback(() => {
      const pollId = setInterval(() => {
        fetchMatches();
      }, 3000);

      return () => clearInterval(pollId);
    }, [])
  );

  useEffect(() => {
    refreshUnreadCounts();
    const unreadPollInterval = setInterval(() => {
      refreshUnreadCounts();
    }, 3000);

    return () => clearInterval(unreadPollInterval);
  }, [matches, currentConversationUserId, selectedDaterId]);

  const sortMatchesByRecentActivity = (list) => {
    if (!Array.isArray(list) || list.length === 0) return list;
    return [...list].sort((a, b) => {
      const tb = lastActivityMsByMatchId[b.match_id] ?? 0;
      const ta = lastActivityMsByMatchId[a.match_id] ?? 0;
      if (tb !== ta) return tb - ta;
      const idb = Number(b.match_id) || 0;
      const ida = Number(a.match_id) || 0;
      return idb - ida;
    });
  };

  const getFilteredMatches = () => {
    if (!userInfo || userInfo.role !== 'user') {
      return {
        matched: sortMatchesByRecentActivity(matchedList),
        pending_approval: sortMatchesByRecentActivity(pendingApprovalList),
      };
    }

    const filteredMatched = matchedList.filter((match) => {
      if (showDaterMatches) {
        return !match.both_matchmakers_involved && match.linked_dater === null;
      }
      return match.both_matchmakers_involved || match.linked_dater !== null;
    });

    const filteredPendingApprovals = showDaterMatches ? pendingApprovalList : [];
    const combined = [...filteredMatched, ...filteredPendingApprovals];

    return {
      matched: sortMatchesByRecentActivity(combined),
      pending_approval: [],
    };
  };

  const unmatch = async (matchId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/match/unmatch/${matchId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          await AsyncStorage.removeItem('token');
          Alert.alert('Session expired', 'Please log in again.');
          navigation.navigate('Login');
          return;
        }
      }

      if (res.ok) {
        // Handle both array and object structures
        if (Array.isArray(matches)) {
          setMatches(matches.filter(match => match.match_id !== matchId));
        } else {
          setMatches({
            matched: (matches?.matched || []).filter(match => match.match_id !== matchId),
            pending_approval: (matches?.pending_approval || []).filter(match => match.match_id !== matchId)
          });
        }
        Alert.alert('Success', 'Unmatched successfully');
      } else {
        const data = await res.json();
        Alert.alert('Error', data.message || 'Failed to unmatch');
      }
    } catch (err) {
      console.error('Error unmatching:', err);
      Alert.alert('Error', 'Failed to unmatch');
    }
  };

  const reveal = async (matchId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/match/reveal/${matchId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          await AsyncStorage.removeItem('token');
          Alert.alert('Session expired', 'Please log in again.');
          navigation.navigate('Login');
          return;
        }
      }

      if (!res.ok) {
        const data = await res.json();
        Alert.alert('Error', data.message || 'Failed to reveal match');
        return;
      }

      setMatches(prevMatches => {
        if (Array.isArray(prevMatches)) {
          return prevMatches.map(m =>
            m.match_id === matchId ? { ...m, blind_match: 'Revealed' } : m
          );
        } else {
          return {
            matched: (prevMatches?.matched || []).map(m =>
              m.match_id === matchId ? { ...m, blind_match: 'Revealed' } : m
            ),
            pending_approval: (prevMatches?.pending_approval || []).map(m =>
              m.match_id === matchId ? { ...m, blind_match: 'Revealed' } : m
            )
          };
        }
      });
      Alert.alert('Success', 'Match revealed');
    } catch (err) {
      console.error('Error revealing match:', err);
      Alert.alert('Error', 'Something went wrong revealing the match');
    }
  };

  const hide = async (matchId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/match/hide/${matchId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          await AsyncStorage.removeItem('token');
          Alert.alert('Session expired', 'Please log in again.');
          navigation.navigate('Login');
          return;
        }
      }

      if (!res.ok) {
        const data = await res.json();
        Alert.alert('Error', data.message || 'Failed to hide match');
        return;
      }

      setMatches(prevMatches => {
        if (Array.isArray(prevMatches)) {
          return prevMatches.map(m =>
            m.match_id === matchId ? { ...m, blind_match: 'Blind' } : m
          );
        } else {
          return {
            matched: (prevMatches?.matched || []).map(m =>
              m.match_id === matchId ? { ...m, blind_match: 'Blind' } : m
            ),
            pending_approval: (prevMatches?.pending_approval || []).map(m =>
              m.match_id === matchId ? { ...m, blind_match: 'Blind' } : m
            )
          };
        }
      });
      Alert.alert('Success', 'Match hidden');
    } catch (err) {
      console.error('Error hiding match:', err);
      Alert.alert('Error', 'Something went wrong hiding the match');
    }
  };

  if (loading) {
    const loadingRole = userInfo?.role || roleHint || 'user';
    const loadingColor = getRoleAccentColor(loadingRole);
    const loadingBackgroundTint = getRoleBackgroundTint(loadingRole);
    return (
      <View style={[styles.loadingContainer, { backgroundColor: loadingBackgroundTint }]}>
        <ActivityIndicator size="large" color={loadingColor} />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  const filteredMatches = getFilteredMatches();
  const accentColor = getRoleAccentColor(userInfo?.role || 'matchmaker');
  const backgroundTint = getRoleBackgroundTint(userInfo?.role || 'matchmaker');
  const overlayTopPadding = userInfo?.role === 'matchmaker' ? 140 : 56;
  const isPendingEmptyState =
    userInfo?.role === 'matchmaker' &&
    showDaterMatches &&
    filteredMatches.pending_approval.length === 0;
  const isDaterEmptyState =
    userInfo?.role === 'user' && filteredMatches.matched.length === 0;
  
  // Update unmatch to handle new structure
  const handleUnmatch = async (matchId) => {
    await unmatch(matchId);
    fetchMatches();
  };

  return (
    <View style={[styles.container, { backgroundColor: backgroundTint, paddingTop: overlayTopPadding }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          (isPendingEmptyState || isDaterEmptyState) && styles.contentGrow,
        ]}
      >
        {userInfo && userInfo.role === 'user' && (matchedList.length > 0 || pendingApprovalList.length > 0) && (
          <ToggleConversationsDater
            showDaterMatches={showDaterMatches}
            setShowDaterMatches={setShowDaterMatches}
            accentColor={accentColor}
          />
        )}

        {userInfo && userInfo.role === 'matchmaker' && (filteredMatches.pending_approval.length > 0 || filteredMatches.matched.length > 0) && (
          <ToggleConversationsMatcher
            showDaterMatches={showDaterMatches}
            setShowDaterMatches={setShowDaterMatches}
            accentColor={accentColor}
          />
        )}
        
        {/* Pending Approval Section - for matchmakers */}
        {userInfo?.role === 'matchmaker' && showDaterMatches && (
          <View style={[styles.sectionContainer, isPendingEmptyState && styles.sectionContainerFill]}>
            <View style={[styles.matchList, isPendingEmptyState && styles.matchListFill]}>
              {filteredMatches.pending_approval.length > 0 ? (
                filteredMatches.pending_approval.map((matchObj) => (
                  <MatchCard
                    key={`pending-${matchObj.match_id}`}
                    matchObj={matchObj}
                    userInfo={userInfo}
                    unreadCount={matchObj.unread_count || 0}
                    cardWidth={matchCardWidth}
                  />
                ))
              ) : (
                <View style={[styles.loadingContainerInline, styles.matchListFullWidth]}>
                  <Text style={styles.loadingText}>No pending matches yet!</Text>
                </View>
              )}
            </View>
          </View>
        )}
        
        {/* Approved/Matched Section - for matchmakers */}
        {userInfo?.role === 'matchmaker' && !showDaterMatches && (
          <View style={styles.sectionContainer}>
            <View style={styles.matchList}>
              {filteredMatches.matched.length > 0 ? (
                filteredMatches.matched.map((matchObj) => (
                  <MatchCard
                    key={`matched-${matchObj.match_id}`}
                    matchObj={matchObj}
                    userInfo={userInfo}
                    unreadCount={matchObj.unread_count || 0}
                    cardWidth={matchCardWidth}
                  />
                ))
              ) : (
                <View style={[styles.emptyContainer, styles.matchListFullWidth]}>
                  <Text style={styles.emptyText}>No matches yet!</Text>
                </View>
              )}
            </View>
          </View>
        )}
        
        {/* Matched Section - for daters */}
        {userInfo?.role === 'user' && (
          <View style={[styles.sectionContainer, isDaterEmptyState && styles.sectionContainerFill]}>
            <View style={[styles.matchList, isDaterEmptyState && styles.matchListFill]}>
              {filteredMatches.matched.length > 0 ? (
                filteredMatches.matched.map((matchObj) => (
                  <MatchCard
                    key={`matched-${matchObj.match_id}`}
                    matchObj={matchObj}
                    userInfo={userInfo}
                    unreadCount={matchObj.unread_count || 0}
                    cardWidth={matchCardWidth}
                  />
                ))
              ) : (
                <View style={[styles.loadingContainerInline, styles.matchListFullWidth]}>
                  <Text style={styles.loadingText}>No matches yet!</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
    paddingTop: 24,
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  contentGrow: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  matchList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: MATCH_CARD_COLUMN_GAP,
    rowGap: 16,
    width: '100%',
  },
  matchListFullWidth: {
    width: '100%',
    flexBasis: '100%',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionContainerFill: {
    flex: 1,
    marginBottom: 0,
  },
  matchListFill: {
    flex: 1,
  },
  loadingContainerInline: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
});

export default Conversations;
