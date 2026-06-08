import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../env';
import MatchCard from './matchCard';
import ToggleConversationsDater from './toggleConversationsDater';
import ToggleConversationsMatcher from './toggleConversationsMatcher';
import { useMatches } from './hooks/useMatches';
import { useUserInfo } from './hooks/useUserInfo';
import { getRoleAccentColor, getRoleBackgroundTint } from '../layout/components/RoleHeaderBanner';
import { UserContext } from '../../context/UserContext';
import { useNotifications } from '../../context/NotificationContext';

const CONTENT_HORIZONTAL_PADDING = 16;

/** True if the viewing dater removed their own side's matchmaker (`dater_on_user_id_1_side` from GET /match/matches). */
function currentDaterRemovedOwnMatchmaker(match, currentUserId) {
  if (!match || !currentUserId) return false;
  if (typeof match.dater_on_user_id_1_side !== 'boolean') return false;
  return match.dater_on_user_id_1_side
    ? !!match.dater_removed_matcher_1
    : !!match.dater_removed_matcher_2;
}

/** True when the viewing dater's side of the match still has a matchmaker involved. */
function currentDaterHasMatchmakerOnSide(match) {
  if (!match || typeof match.dater_on_user_id_1_side !== 'boolean') return false;
  return match.dater_on_user_id_1_side
    ? !!match.user_1_matchmaker_involved
    : !!match.user_2_matchmaker_involved;
}

/**
 * For a dater, a row belongs on the "Matchmaker Matches" tab only while their side is still matchmaker-mediated.
 * After they remove their matchmaker, the same match is listed under "Dater Matches" instead.
 */
function isMediatedMatchmakerTabForDater(match, currentUserId) {
  const mediated =
    !!match.both_matchmakers_involved ||
    match.linked_dater !== null ||
    currentDaterHasMatchmakerOnSide(match);
  if (!mediated) return false;
  return !currentDaterRemovedOwnMatchmaker(match, currentUserId);
}

/** Route a dater-visible match row to Dater Matches vs Matchmaker Matches. */
function isDaterMatchesTabForDater(match, currentUserId, showDaterMatches) {
  const inMmTab = isMediatedMatchmakerTabForDater(match, currentUserId);
  return showDaterMatches ? !inMmTab : inMmTab;
}

/** True when the counterparty's side had a matchmaker, for list filtering (prefers API field). */
function isOtherPersonMatchmakerInvolved(match) {
  if (typeof match?.other_matchmaker_involved === 'boolean') {
    return match.other_matchmaker_involved;
  }
  const bothMm = !!(
    match?.both_matchmakers_involved ||
    (match?.user_1_matchmaker_involved && match?.user_2_matchmaker_involved)
  );
  const oneMm =
    !!match?.user_1_matchmaker_involved || !!match?.user_2_matchmaker_involved;
  if (bothMm) return true;
  return oneMm && !match?.linked_dater;
}

const Conversations = () => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const listInnerWidth = windowWidth - CONTENT_HORIZONTAL_PADDING * 2;
  const matchCardWidth = listInnerWidth;

  const { user: contextUser } = useContext(UserContext);
  const [showDaterMatches, setShowDaterMatches] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [roleHint, setRoleHint] = useState(null);
  const { userInfo, setUserInfo, referrerInfo, setReferrerInfo, loading: userLoading } = useUserInfo(API_BASE_URL);
  const { matches, setMatches, loading: matchesLoading, fetchMatches } = useMatches(API_BASE_URL);
  const {
    lastNotificationEvent,
    notificationsEnabled,
    expoPushToken,
    notificationPreferences,
    isMatchMessageMuted,
  } = useNotifications();
  const matchedList = Array.isArray(matches) ? matches : (matches?.matched || []);
  const pendingApprovalList = Array.isArray(matches) ? [] : (matches?.pending_approval || []);
  const navigation = useNavigation();
  const [referrer, setReferrer] = useState(null);
  const [showConversationFilter, setShowConversationFilter] = useState(false);
  const [conversationFilters, setConversationFilters] = useState({
    requireOtherMatchmaker: false,
    blindOnly: false,
    notificationsOnOnly: false,
  });
  const [conversationFilterDraft, setConversationFilterDraft] = useState({
    requireOtherMatchmaker: false,
    blindOnly: false,
    notificationsOnOnly: false,
  });
  const selectedDaterId = userInfo?.referrer_id || userInfo?.referred_by_id || null;

  const showNotificationsOnFilterOption =
    notificationsEnabled && notificationPreferences.newMessageNotification;

  useEffect(() => {
    if (notificationPreferences.newMessageNotification) return;
    setConversationFilters((f) =>
      f.notificationsOnOnly ? { ...f, notificationsOnOnly: false } : f
    );
    setConversationFilterDraft((d) =>
      d.notificationsOnOnly ? { ...d, notificationsOnOnly: false } : d
    );
  }, [notificationPreferences.newMessageNotification]);

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

  // Option B: refresh conversations when a push arrives (no polling for list updates).
  useEffect(() => {
    const data = lastNotificationEvent?.data;
    if (!data) return;
    if (data.type === 'unmatch' && data.matchId != null) {
      const mid = parseInt(String(data.matchId), 10);
      if (!Number.isFinite(mid)) return;
      setMatches((prev) => {
        if (Array.isArray(prev)) {
          return prev.filter((m) => m.match_id !== mid);
        }
        return {
          matched: (prev?.matched || []).filter((m) => m.match_id !== mid),
          pending_approval: (prev?.pending_approval || []).filter((m) => m.match_id !== mid),
        };
      });
      return;
    }
    if (
      data.type !== 'message' &&
      data.type !== 'match' &&
      data.type !== 'blind_match' &&
      data.type !== 'match_approval' &&
      data.type !== 'dater_removed_matchmaker'
    ) {
      return;
    }
    fetchMatches();
  }, [lastNotificationEvent?.receivedAt, fetchMatches]);

  // Fallback: if push can't be relied on (notifications disabled or no token),
  // refresh while focused with a light interval so unread counts still update.
  useFocusEffect(
    React.useCallback(() => {
      const canUsePushRefresh = Boolean(notificationsEnabled && expoPushToken);
      if (canUsePushRefresh) {
        return () => {};
      }
      fetchMatches();
      const id = setInterval(() => {
        fetchMatches();
      }, 25000);
      return () => clearInterval(id);
    }, [notificationsEnabled, expoPushToken, fetchMatches])
  );

  // Unread badges use `unread_count` from GET /match/matches (no per-conversation polling).
  const sortMatchesByRecentActivity = (list) => {
    if (!Array.isArray(list) || list.length === 0) return list;
    return [...list].sort((a, b) => {
      const ub = Number(b.unread_count) || 0;
      const ua = Number(a.unread_count) || 0;
      if (ub !== ua) return ub - ua;
      const idb = Number(b.match_id) || 0;
      const ida = Number(a.match_id) || 0;
      return idb - ida;
    });
  };

  const applyConversationAttributeFilters = (list) => {
    if (!Array.isArray(list) || list.length === 0) return list;
    return list.filter((match) => {
      if (conversationFilters.requireOtherMatchmaker && !isOtherPersonMatchmakerInvolved(match)) {
        return false;
      }
      if (conversationFilters.blindOnly && match.blind_match !== 'Blind') {
        return false;
      }
      if (
        conversationFilters.notificationsOnOnly &&
        isMatchMessageMuted(match.match_id)
      ) {
        return false;
      }
      return true;
    });
  };

  const getFilteredMatches = () => {
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

    const filteredMatched = matchedList.filter((match) =>
      isDaterMatchesTabForDater(match, userInfo.id, showDaterMatches)
    );

    const filteredPendingApprovals = pendingApprovalList.filter((match) =>
      isDaterMatchesTabForDater(match, userInfo.id, showDaterMatches)
    );
    const combined = [...filteredMatched, ...filteredPendingApprovals];

    return {
      matched: sortMatchesByRecentActivity(applyConversationAttributeFilters(combined)),
      pending_approval: [],
    };
  };

  const dismissConversationFilter = () => {
    setConversationFilterDraft({ ...conversationFilters });
    setShowConversationFilter(false);
  };

  const saveConversationFilters = () => {
    setConversationFilters({ ...conversationFilterDraft });
    setShowConversationFilter(false);
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
  const activeConversationFilterCount =
    (conversationFilters.requireOtherMatchmaker ? 1 : 0) +
    (conversationFilters.blindOnly ? 1 : 0) +
    (conversationFilters.notificationsOnOnly &&
    showNotificationsOnFilterOption
      ? 1
      : 0);
  const accentColor = getRoleAccentColor(userInfo?.role || 'matchmaker');
  const backgroundTint = getRoleBackgroundTint(userInfo?.role || 'matchmaker');
  const overlayTopPadding = userInfo?.role === 'matchmaker' ? 140 : 56;
  const filterButtonTop =
    userInfo?.role === 'matchmaker' ? insets.top + 6 : overlayTopPadding + 8;
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
      <TouchableOpacity
        style={[styles.filterButton, { top: filterButtonTop }]}
        onPress={() => {
          setConversationFilterDraft({ ...conversationFilters });
          setShowConversationFilter(true);
        }}
        accessibilityLabel="Open conversation filters"
      >
        <Ionicons name="options-outline" size={24} color="#1f2937" />
        {activeConversationFilterCount > 0 ? (
          <View style={[styles.filterBadge, { backgroundColor: accentColor }]}>
            <Text style={styles.filterBadgeText}>{activeConversationFilterCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
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
                    daterConversationsTheme={userInfo?.role === 'user'}
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
                    daterConversationsTheme={userInfo?.role === 'user'}
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
                    daterConversationsTheme={userInfo?.role === 'user'}
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

      <Modal
        visible={showConversationFilter}
        transparent
        animationType="none"
        onRequestClose={dismissConversationFilter}
      >
        <View style={styles.filterModalRoot}>
          <Pressable
            style={styles.filterBackdrop}
            onPress={dismissConversationFilter}
            accessibilityLabel="Close conversation filters"
          />
          <View style={styles.filterDrawer}>
            <View style={styles.filterDrawerHeader}>
              <Text style={styles.filterDrawerTitle}>Filters</Text>
              <TouchableOpacity onPress={dismissConversationFilter} hitSlop={12}>
                <Ionicons name="close" size={26} color="#374151" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.filterScroll}
              contentContainerStyle={styles.filterScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.filterSectionLabel}>Conversation type</Text>

              <TouchableOpacity
                style={styles.filterCheckboxRow}
                onPress={() =>
                  setConversationFilterDraft((d) => ({
                    ...d,
                    requireOtherMatchmaker: !d.requireOtherMatchmaker,
                  }))
                }
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.filterCheckbox,
                    conversationFilterDraft.requireOtherMatchmaker && {
                      backgroundColor: accentColor,
                      borderColor: accentColor,
                    },
                  ]}
                >
                  {conversationFilterDraft.requireOtherMatchmaker ? (
                    <Ionicons name="checkmark" size={16} color="#ffffff" />
                  ) : null}
                </View>
                <Text style={styles.filterCheckboxLabel}>
                  Other Matchmaker Involved
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterCheckboxRow, { marginTop: 16 }]}
                onPress={() =>
                  setConversationFilterDraft((d) => ({
                    ...d,
                    blindOnly: !d.blindOnly,
                  }))
                }
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.filterCheckbox,
                    conversationFilterDraft.blindOnly && {
                      backgroundColor: accentColor,
                      borderColor: accentColor,
                    },
                  ]}
                >
                  {conversationFilterDraft.blindOnly ? (
                    <Ionicons name="checkmark" size={16} color="#ffffff" />
                  ) : null}
                </View>
                <Text style={styles.filterCheckboxLabel}>Blind match only</Text>
              </TouchableOpacity>

              {showNotificationsOnFilterOption ? (
                <TouchableOpacity
                  style={[styles.filterCheckboxRow, { marginTop: 16 }]}
                  onPress={() =>
                    setConversationFilterDraft((d) => ({
                      ...d,
                      notificationsOnOnly: !d.notificationsOnOnly,
                    }))
                  }
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.filterCheckbox,
                      conversationFilterDraft.notificationsOnOnly && {
                        backgroundColor: accentColor,
                        borderColor: accentColor,
                      },
                    ]}
                  >
                    {conversationFilterDraft.notificationsOnOnly ? (
                      <Ionicons name="checkmark" size={16} color="#ffffff" />
                    ) : null}
                  </View>
                  <Text style={styles.filterCheckboxLabel}>
                    Conversations with Notifications
                  </Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
            <View
              style={[
                styles.filterDrawerFooter,
                { paddingBottom: 28 + insets.bottom },
              ]}
            >
              <TouchableOpacity
                style={[styles.filterSaveButton, { backgroundColor: accentColor }]}
                onPress={saveConversationFilters}
              >
                <Text style={styles.filterSaveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingTop: 50,
  },
  filterButton: {
    position: 'absolute',
    left: 16,
    zIndex: 50,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  filterModalRoot: {
    flex: 1,
  },
  filterBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  filterDrawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '86%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 16,
  },
  filterDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  filterDrawerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  filterScroll: {
    flex: 1,
  },
  filterScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  filterSectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
  },
  filterSectionSub: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 18,
  },
  filterCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  filterCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  filterCheckboxLabel: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  filterDrawerFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  filterSaveButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  filterSaveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
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
    flexDirection: 'column',
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
