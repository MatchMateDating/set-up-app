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
  Dimensions,
  DeviceEventEmitter,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../env';
import MatchCard from './matchCard';
import ToggleConversationsDater from './toggleConversationsDater';
import { useMatches } from './hooks/useMatches';
import { useUserInfo } from './hooks/useUserInfo';
import { getRoleAccentColor, getRoleBackgroundTint } from '../layout/components/RoleHeaderBanner';
import { UserContext } from '../../context/UserContext';
import { useNotifications } from '../../context/NotificationContext';
import { shouldSuppressAuthErrors } from '../../utils/authSession';
import {
  MATCH_PREVIEW_UPDATED_EVENT,
  cacheMatchPreview,
  applyCachedPreviewsToMatches,
  hydrateMissingMatchPreviews,
} from './utils/matchMessagePreview';

const CONTENT_HORIZONTAL_PADDING = 16;
const FILTER_SHEET_BG = '#f3f4f6';
const MATCHMAKER_SCREEN_BG = '#f3f4f6';

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

/** Pending-approval row for matchmaker lists (API puts these in pending_approval). */
function isMatchmakerPendingItem(match) {
  return match?.status === 'pending_approval' || match?.message_count !== undefined;
}

/**
 * Matchmaker unified list order: needs approval first, then approved-by-you-but-waiting,
 * then fully matched — each group sorted by recent activity.
 */
function getMatchmakerItemSortRank(match) {
  if (isMatchmakerPendingItem(match)) {
    return match?.waiting_for_other_approval ? 1 : 0;
  }
  return 2;
}

const DEFAULT_CONVERSATION_FILTERS = {
  requireOtherMatchmaker: false,
  blindOnly: false,
  notificationsOnOnly: false,
  statusPending: true,
  statusApproved: true,
};

const Conversations = () => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const listInnerWidth = windowWidth - CONTENT_HORIZONTAL_PADDING * 2;
  const matchCardWidth = listInnerWidth;

  const { user: contextUser, setUser: setContextUser } = useContext(UserContext);
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
    ...DEFAULT_CONVERSATION_FILTERS,
  });
  const [conversationFilterDraft, setConversationFilterDraft] = useState({
    ...DEFAULT_CONVERSATION_FILTERS,
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
        return;
      }

      const res = await fetch(`${API_BASE_URL}/profile/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          await AsyncStorage.removeItem('token');
          navigation.navigate('Login');
          return;
        }
        if (await shouldSuppressAuthErrors()) return;
        return;
      }

      if (!res.ok) {
        if (await shouldSuppressAuthErrors()) return;
        throw new Error('Failed to fetch profile');
      }

      const data = await res.json();
      setUserInfo(data.user);
      setReferrer(data.referrer || null);
    } catch (err) {
      console.error('Error loading profile:', err);
      if (await shouldSuppressAuthErrors()) return;
      Alert.alert('Error', 'Failed to load profile');
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchMatches();
  }, []);

  // Fetch last-message text for rows the matches API did not fully populate yet.
  useEffect(() => {
    if (loading || !userInfo?.id) return undefined;

    let cancelled = false;
    hydrateMissingMatchPreviews(matches, userInfo, API_BASE_URL).then((didUpdate) => {
      if (cancelled || !didUpdate) return;
      setMatches((prev) => applyCachedPreviewsToMatches(prev));
    });

    return () => {
      cancelled = true;
    };
  }, [matches, userInfo?.id, loading, setMatches]);

  useEffect(() => {
    const patchMatchPreview = ({ matchId, ...fields }) => {
      const id = Number(matchId);
      if (!Number.isFinite(id)) return;

      cacheMatchPreview(id, fields);
      const cached = fields;
      const patchList = (list) =>
        (list || []).map((match) =>
          match.match_id === id ? { ...match, ...cached } : match
        );

      setMatches((prev) => {
        const patched = Array.isArray(prev)
          ? patchList(prev)
          : {
              matched: patchList(prev?.matched),
              pending_approval: patchList(prev?.pending_approval),
            };
        return applyCachedPreviewsToMatches(patched);
      });
    };

    const subscription = DeviceEventEmitter.addListener(
      MATCH_PREVIEW_UPDATED_EVENT,
      patchMatchPreview
    );
    return () => subscription.remove();
  }, [setMatches]);

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
            setMatches((prev) => applyCachedPreviewsToMatches(prev));
            setRefreshing(false);
          });
      }, 100);
      return () => clearTimeout(timer);
    }, [fetchMatches])
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
        matched: sortMatchmakerConversations(applyConversationAttributeFilters(combined)),
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
    } catch (err) {
      console.error('Error hiding match:', err);
      Alert.alert('Error', 'Something went wrong hiding the match');
    }
  };

  if (loading) {
    const loadingRole = userInfo?.role || roleHint || 'user';
    const loadingColor = getRoleAccentColor(loadingRole);
    const loadingBackgroundTint =
      loadingRole === 'matchmaker' ? MATCHMAKER_SCREEN_BG : getRoleBackgroundTint(loadingRole);
    return (
      <View style={[styles.loadingContainer, { backgroundColor: loadingBackgroundTint }]}>
        <ActivityIndicator size="large" color={loadingColor} />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  const filteredMatches = getFilteredMatches();
  const isMatchmaker = userInfo?.role === 'matchmaker';
  const isDater = userInfo?.role === 'user';
  const activeConversationFilterCount =
    (conversationFilters.requireOtherMatchmaker ? 1 : 0) +
    (conversationFilters.blindOnly ? 1 : 0) +
    (conversationFilters.notificationsOnOnly &&
    showNotificationsOnFilterOption
      ? 1
      : 0) +
    (isMatchmaker &&
    (!conversationFilters.statusPending || !conversationFilters.statusApproved)
      ? 1
      : 0);
  const accentColor = getRoleAccentColor(userInfo?.role || 'matchmaker');
  const backgroundTint = isMatchmaker
    ? MATCHMAKER_SCREEN_BG
    : getRoleBackgroundTint(userInfo?.role || 'matchmaker');
  const headerTopPadding = insets.top + (isMatchmaker ? 4 : 12);
  const isMatchmakerEmptyState =
    isMatchmaker && filteredMatches.matched.length === 0;
  const isDaterEmptyState =
    userInfo?.role === 'user' && filteredMatches.matched.length === 0;
  
  // Update unmatch to handle new structure
  const handleUnmatch = async (matchId) => {
    await unmatch(matchId);
    fetchMatches();
  };

  const openConversationFilter = () => {
    setConversationFilterDraft({ ...conversationFilters });
    setShowConversationFilter(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: backgroundTint }]}>
      <View style={styles.topArea}>
        <View
          style={[
            styles.screenHeader,
            isMatchmaker && styles.screenHeaderMatchmaker,
            { paddingTop: headerTopPadding },
          ]}
        >
          <Image
            source={require('../../../assets/matchmate_logo.png')}
            style={styles.headerLogo}
            accessibilityLabel="Matchmate logo"
          />
          {!isMatchmaker ? <Text style={styles.screenTitle}>Conversations</Text> : null}
          <TouchableOpacity
            style={[
              styles.filterButton,
              styles.filterButtonTop,
              isMatchmaker && styles.filterButtonMatchmaker,
            ]}
            onPress={openConversationFilter}
            accessibilityLabel="Open conversation filters"
          >
            <Ionicons name="options-outline" size={22} color="#374151" />
            {activeConversationFilterCount > 0 ? (
              <View style={[styles.filterBadge, { backgroundColor: accentColor }]}>
                <Text style={styles.filterBadgeText}>{activeConversationFilterCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {isMatchmaker ? <View style={styles.choosingSection} /> : null}

        {userInfo && isDater ? (
          <View style={styles.toggleSection}>
            <ToggleConversationsDater
              showDaterMatches={showDaterMatches}
              setShowDaterMatches={setShowDaterMatches}
              accentColor={accentColor}
            />
          </View>
        ) : null}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          isMatchmaker && styles.contentMatchmaker,
          (isMatchmakerEmptyState || isDaterEmptyState) && styles.contentGrow,
        ]}
      >
        {isMatchmaker ? (
          <View
            style={[
              styles.sectionContainer,
              isMatchmakerEmptyState && styles.sectionContainerFill,
            ]}
          >
            <View
              style={[
                styles.matchList,
                styles.matchListModern,
                isMatchmakerEmptyState && styles.matchListFill,
              ]}
            >
              {filteredMatches.matched.length > 0 ? (
                filteredMatches.matched.map((matchObj) => (
                  <MatchCard
                    key={`chat-${matchObj.match_id}`}
                    matchObj={matchObj}
                    userInfo={userInfo}
                    unreadCount={matchObj.unread_count || 0}
                    cardWidth={matchCardWidth}
                    matchmakerConversationsTheme
                  />
                ))
              ) : (
                <View style={[styles.loadingContainerInline, styles.matchListFullWidth]}>
                  <Text style={styles.loadingText}>No conversations yet!</Text>
                </View>
              )}
            </View>
          </View>
        ) : null}

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
        animationType="slide"
        onRequestClose={dismissConversationFilter}
      >
        <View style={styles.filterModalRoot}>
          <Pressable
            style={styles.filterBackdrop}
            onPress={dismissConversationFilter}
            accessibilityLabel="Close conversation filters"
          />
          <View
            style={[
              styles.filterBottomSheet,
              { maxHeight: Dimensions.get('window').height * 0.72 },
            ]}
          >
            <View style={styles.filterSheetHeader}>
              <Text style={styles.filterSheetTitle}>Filter</Text>
              <TouchableOpacity
                style={styles.filterSheetClose}
                onPress={dismissConversationFilter}
                hitSlop={12}
                accessibilityLabel="Close filter"
              >
                <Ionicons name="close" size={22} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.filterScroll}
              contentContainerStyle={styles.filterScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {isMatchmaker ? (
                <>
                  <Text style={styles.filterSectionLabel}>STATUS</Text>

                  <TouchableOpacity
                    style={styles.filterCheckboxRow}
                    onPress={() =>
                      setConversationFilterDraft((d) => ({
                        ...d,
                        statusPending: !d.statusPending,
                      }))
                    }
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.filterCheckbox,
                        { borderColor: accentColor },
                        conversationFilterDraft.statusPending && styles.filterCheckboxChecked,
                      ]}
                    >
                      {conversationFilterDraft.statusPending ? (
                        <Ionicons name="checkmark" size={16} color={accentColor} />
                      ) : null}
                    </View>
                    <Text style={styles.filterCheckboxLabel}>Pending</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.filterCheckboxRow}
                    onPress={() =>
                      setConversationFilterDraft((d) => ({
                        ...d,
                        statusApproved: !d.statusApproved,
                      }))
                    }
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.filterCheckbox,
                        { borderColor: accentColor },
                        conversationFilterDraft.statusApproved && styles.filterCheckboxChecked,
                      ]}
                    >
                      {conversationFilterDraft.statusApproved ? (
                        <Ionicons name="checkmark" size={16} color={accentColor} />
                      ) : null}
                    </View>
                    <Text style={styles.filterCheckboxLabel}>Approved</Text>
                  </TouchableOpacity>

                  <Text style={[styles.filterSectionLabel, styles.filterSectionLabelSpaced]}>
                    CONVERSATION TYPE
                  </Text>
                </>
              ) : (
                <Text style={styles.filterSectionLabel}>CONVERSATION TYPE</Text>
              )}

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
                    { borderColor: accentColor },
                    conversationFilterDraft.requireOtherMatchmaker &&
                      styles.filterCheckboxChecked,
                  ]}
                >
                  {conversationFilterDraft.requireOtherMatchmaker ? (
                    <Ionicons name="checkmark" size={16} color={accentColor} />
                  ) : null}
                </View>
                <Text style={styles.filterCheckboxLabel}>
                  Other Matchmaker Involved
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterCheckboxRow}
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
                    { borderColor: accentColor },
                    conversationFilterDraft.blindOnly && styles.filterCheckboxChecked,
                  ]}
                >
                  {conversationFilterDraft.blindOnly ? (
                    <Ionicons name="checkmark" size={16} color={accentColor} />
                  ) : null}
                </View>
                <Text style={styles.filterCheckboxLabel}>Blind match only</Text>
              </TouchableOpacity>

              {showNotificationsOnFilterOption ? (
                <TouchableOpacity
                  style={styles.filterCheckboxRow}
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
                      { borderColor: accentColor },
                      conversationFilterDraft.notificationsOnOnly &&
                        styles.filterCheckboxChecked,
                    ]}
                  >
                    {conversationFilterDraft.notificationsOnOnly ? (
                      <Ionicons name="checkmark" size={16} color={accentColor} />
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
                styles.filterSheetFooter,
                { paddingBottom: 20 + insets.bottom },
              ]}
            >
              <TouchableOpacity
                style={[styles.filterSaveButton, { backgroundColor: accentColor }]}
                onPress={saveConversationFilters}
                accessibilityLabel="Save filters"
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
  },
  topArea: {
    backgroundColor: 'transparent',
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  screenHeaderMatchmaker: {
    backgroundColor: 'transparent',
    paddingBottom: 0,
  },
  headerLogo: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  screenTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    letterSpacing: -0.2,
  },
  toggleSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  toggleSectionMatchmaker: {
    paddingTop: 8,
  },
  choosingSection: {
    paddingHorizontal: 20,
    paddingBottom: 4,
    // Label + picker row for AppNavigator dater dropdown overlay (see daterDropdownTop).
    minHeight: 84,
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  filterButtonTop: {
    borderRadius: 12,
  },
  filterButtonMatchmaker: {
    borderRadius: 12,
    borderWidth: 0,
    shadowOpacity: 0.06,
    shadowRadius: 8,
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
    justifyContent: 'flex-end',
  },
  filterBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  filterBottomSheet: {
    backgroundColor: FILTER_SHEET_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  filterSheetHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  filterSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 0.2,
  },
  filterSheetClose: {
    position: 'absolute',
    right: 20,
    top: 18,
    padding: 4,
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  filterSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  filterSectionLabelSpaced: {
    marginTop: 20,
  },
  filterCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  filterCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  filterCheckboxChecked: {
    backgroundColor: '#ffffff',
  },
  filterCheckboxLabel: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  filterSheetFooter: {
    paddingHorizontal: 24,
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
    paddingTop: 4,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  contentMatchmaker: {
    paddingTop: 8,
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
  matchListModern: {
    rowGap: 12,
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
