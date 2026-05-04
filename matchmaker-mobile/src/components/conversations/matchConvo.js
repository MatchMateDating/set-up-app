import React, { useCallback, useContext, useEffect, useLayoutEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  FlatList,
  Keyboard,
  InteractionManager,
  PanResponder,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import {
  CommonActions,
  useFocusEffect,
  useNavigation,
  useRoute,
  useIsFocused,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../env';
import { useUserInfo } from './hooks/useUserInfo';
import { games } from '../puzzles/puzzlesPage';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { getImageUrl } from '../profile/utils/profileUtils';
import { getRoleAccentColor } from '../layout/components/RoleHeaderBanner';
import { runOnJS } from 'react-native-reanimated';
import { setActiveMatchId, useNotifications } from '../../context/NotificationContext';
import { UserContext } from '../../context/UserContext';

function formatMessageTimestamp(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const today = now.toDateString();
  const msgDate = d.toDateString();
  const timeOpt = { hour: '2-digit', minute: '2-digit' };
  if (msgDate === today) {
    return d.toLocaleTimeString([], timeOpt);
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (msgDate === yesterday.toDateString()) {
    return `Yesterday, ${d.toLocaleTimeString([], timeOpt)}`;
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString([], timeOpt);
}

function normalizeMessages(rawMessages) {
  if (!Array.isArray(rawMessages)) return [];

  return rawMessages.map((msg, index) => ({
    ...msg,
    id: msg?.id ?? msg?.message_id ?? `${msg?.sender_id || 'unknown'}-${msg?.timestamp || index}-${index}`,
    text: typeof msg?.text === 'string' ? msg.text : (msg?.message || ''),
  }));
}

/** Poll interval while chat is open — light on the server vs 3s; keeps MM threads in sync. */
const CONVERSATION_POLL_MS = 12000;
/** Two-MM pending: refresh match row so peer approval updates header copy without leaving the thread. */
const MATCH_META_PENDING_POLL_MS = 3500;
/** Poll typing indicators — separate from message poll for snappy UX. */
const TYPING_POLL_MS = 2500;
const TYPING_DEBOUNCE_MS = 350;
/** After this long with no new keystrokes, we report not typing (draft alone does not count). */
const TYPING_IDLE_CLEAR_MS = 3000;
/** If the user is within this many px of the bottom, content-size changes snap them to the new bottom. */
const TYPING_SCROLL_BOTTOM_THRESHOLD_PX = 40;

const MatchConvo = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const containerRef = useRef(null);
  const { matchId, isBlind } = route.params || {};
  const { userInfo, setUserInfo, referrerInfo } = useUserInfo(API_BASE_URL);
  const { user: contextUser } = useContext(UserContext);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessageText, setNewMessageText] = useState('');
  const [selectedPuzzleType, setSelectedPuzzleType] = useState(games[0].name);
  const [selectedPuzzleLink, setSelectedPuzzleLink] = useState('');
  const [senderNames, setSenderNames] = useState({});
  const [senderRoles, setSenderRoles] = useState({});
  const [senderReferrerIds, setSenderReferrerIds] = useState({});
  const [matchUser, setMatchUser] = useState(null);
  const [puzzleSheetOpen, setPuzzleSheetOpen] = useState(false);
  const [matchInfo, setMatchInfo] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [approvedByMeLocally, setApprovedByMeLocally] = useState(false);
  const insets = useSafeAreaInsets();
  const keyboardHeightAnim = useSharedValue(0);
  const { lastNotificationEvent } = useNotifications();

  const scrollViewRef = useRef(null);
  /** Skip the useFocusEffect fetch that immediately follows the initial mount fetch for this matchId. */
  const skipNextFocusRefreshRef = useRef(false);
  /** After 403 (lost access), avoid repeated navigations from the message poll. */
  const conversationAccessLostRef = useRef(false);
  /** Latest match id for this screen — async match-meta fetches must not apply to an older navigation. */
  const currentMatchIdRef = useRef(matchId);
  currentMatchIdRef.current = matchId;
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;
  const [othersTyping, setOthersTyping] = useState([]);
  const typingDebounceRef = useRef(null);
  const typingIdleClearRef = useRef(null);
  const scrollMetricsRef = useRef({ scrollY: 0, contentH: 0, layoutH: 0 });

  const handleScrollViewScroll = useCallback((event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    scrollMetricsRef.current = {
      scrollY: contentOffset.y,
      contentH: contentSize.height,
      layoutH: layoutMeasurement.height,
    };
  }, []);

  const clearTypingIdleClearTimer = useCallback(() => {
    if (typingIdleClearRef.current) {
      clearTimeout(typingIdleClearRef.current);
      typingIdleClearRef.current = null;
    }
  }, []);

  const postTyping = useCallback(
    async (typing) => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token || !matchId) return;
        await fetch(`${API_BASE_URL}/conversation/${matchId}/typing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ typing }),
        });
      } catch (err) {
        console.error('typing indicator:', err);
      }
    },
    [matchId]
  );

  const handleComposerChange = useCallback(
    (text) => {
      setNewMessageText(text);
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current);
        typingDebounceRef.current = null;
      }
      clearTypingIdleClearTimer();

      if (!text.trim()) {
        postTyping(false);
        return;
      }

      typingIdleClearRef.current = setTimeout(() => {
        typingIdleClearRef.current = null;
        postTyping(false);
      }, TYPING_IDLE_CLEAR_MS);

      typingDebounceRef.current = setTimeout(() => {
        typingDebounceRef.current = null;
        postTyping(true);
      }, TYPING_DEBOUNCE_MS);
    },
    [postTyping, clearTypingIdleClearTimer]
  );

  const markConversationAsRead = useCallback(async () => {
    if (!matchId || !isFocusedRef.current) return;
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      await fetch(`${API_BASE_URL}/conversation/${matchId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error('Error marking conversation as read:', err);
    }
  }, [matchId]);

  /** Close chat once (push, 403 poll, or send denied) when the user no longer has access. */
  const exitConversationDueToAccessLoss = useCallback(() => {
    if (conversationAccessLostRef.current) return;
    conversationAccessLostRef.current = true;
    if (Platform.OS === 'ios') {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Main', params: { screen: 'Conversations' } }],
        })
      );
    } else {
      navigation.navigate('Main', { screen: 'Conversations' });
    }
  }, [navigation]);

  const loadConversationMessages = useCallback(
    async ({ showErrors = false } = {}) => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          if (showErrors) navigation.navigate('Login');
          return;
        }

        const res = await fetch(`${API_BASE_URL}/conversation/${matchId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          const data = await res.json();
          if (data.error_code === 'TOKEN_EXPIRED') {
            await AsyncStorage.removeItem('token');
            if (showErrors) {
              Alert.alert('Session expired', 'Please log in again.');
              navigation.navigate('Login');
            }
            return;
          }
        }

        if (res.status === 403) {
          exitConversationDueToAccessLoss();
          return;
        }

        if (res.status === 404) {
          if (Platform.OS === 'ios') {
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Main', params: { screen: 'Conversations' } }],
              })
            );
          } else {
            navigation.navigate('Main', { screen: 'Conversations' });
          }
          return;
        }

        if (res.ok) {
          let data = await res.json();
          if (data.length > 0) data = data[0].messages;
          const normalizedMessages = normalizeMessages(data || []);
          setMessages(normalizedMessages);
          await markConversationAsRead();
        }
      } catch (err) {
        console.error(err);
        if (showErrors) {
          Alert.alert('Error', 'Failed to load conversation');
        }
      } finally {
        if (showErrors) {
          setLoading(false);
        }
      }
    },
    [matchId, navigation, markConversationAsRead, exitConversationDueToAccessLoss]
  );

  /** Load match row + counterparty for the header; daters retry briefly so post-approval opens are not stale. */
  const loadMatchMeta = useCallback(async () => {
    const mid = Number(matchId);
    if (!Number.isFinite(mid)) return;

    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    const fetchOnce = async () => {
      const token = await AsyncStorage.getItem('token');
      if (!token) return null;
      const res = await fetch(`${API_BASE_URL}/match/matches?_=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const allMatches = Array.isArray(data) ? data : [...(data.matched || []), ...(data.pending_approval || [])];
      return allMatches.find((m) => m.match_id === mid) ?? null;
    };

    const maxAttempts = userInfo?.role === 'user' ? 5 : 1;

    for (let i = 0; i < maxAttempts; i++) {
      if (Number(currentMatchIdRef.current) !== mid) return;

      let row = null;
      try {
        row = await fetchOnce();
      } catch (err) {
        console.error('Error fetching match user:', err);
      }

      if (Number(currentMatchIdRef.current) !== mid) return;

      if (!row) {
        if (i < maxAttempts - 1) await delay(400);
        continue;
      }

      const mu = row.match_user;
      const invalidSelf =
        userInfo?.role === 'user' &&
        userInfo?.id != null &&
        mu?.id != null &&
        Number(mu.id) === Number(userInfo.id);

      if (!invalidSelf && mu && mu.id != null) {
        setMatchUser(mu);
        setMatchInfo(row);
        return;
      }

      setMatchInfo(row);
      setMatchUser(null);

      if (i < maxAttempts - 1) await delay(400);
    }
  }, [matchId, userInfo?.role, userInfo?.id]);

  useLayoutEffect(() => {
    if (matchId == null || matchId === '') return;
    setMatchUser(null);
    setMatchInfo(null);
  }, [matchId]);

  useEffect(() => {
    conversationAccessLostRef.current = false;
  }, [matchId]);

  useEffect(() => {
    if (!matchId) return undefined;
    skipNextFocusRefreshRef.current = true;
    setLoading(true);
    loadConversationMessages({ showErrors: true });
  }, [matchId, loadConversationMessages]);

  useEffect(() => {
    if (!matchId) return undefined;
    loadMatchMeta();
  }, [matchId, loadMatchMeta]);

  // Refetch when returning to this screen (same matchId) without waiting for the poll.
  useFocusEffect(
    useCallback(() => {
      if (!matchId) return undefined;
      if (skipNextFocusRefreshRef.current) {
        skipNextFocusRefreshRef.current = false;
        return undefined;
      }
      loadConversationMessages({ showErrors: false });
      loadMatchMeta();
      return undefined;
    }, [matchId, loadConversationMessages, loadMatchMeta])
  );

  useFocusEffect(
    useCallback(() => {
      if (!matchId) return undefined;
      setActiveMatchId(matchId);
      return () => setActiveMatchId(null);
    }, [matchId])
  );

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (typingDebounceRef.current) {
          clearTimeout(typingDebounceRef.current);
          typingDebounceRef.current = null;
        }
        clearTypingIdleClearTimer();
        postTyping(false);
      };
    }, [postTyping, clearTypingIdleClearTimer])
  );

  // After linked-account switch (e.g. notification tap), keep profile in sync with UserContext — same as conversations.js.
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

  useEffect(() => {
    return () => {
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current);
        typingDebounceRef.current = null;
      }
      clearTypingIdleClearTimer();
      postTyping(false);
    };
  }, [matchId, postTyping, clearTypingIdleClearTimer]);

  useEffect(() => {
    if (!matchId || !isFocused) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token || cancelled) return;
        const res = await fetch(`${API_BASE_URL}/conversation/${matchId}/typing`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setOthersTyping(Array.isArray(data.typing) ? data.typing : []);
      } catch {
        if (!cancelled) setOthersTyping([]);
      }
    };
    poll();
    const id = setInterval(poll, TYPING_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [matchId, isFocused]);

  useEffect(() => {
    const data = lastNotificationEvent?.data;
    if (!data || matchId == null) return;
    if (String(data.matchId) !== String(matchId)) return;
    const t = data.type;
    if (t === 'unmatch' || t === 'dater_removed_matchmaker') {
      exitConversationDueToAccessLoss();
      return;
    }
    if (t === 'match_approval') {
      loadMatchMeta();
    }
  }, [lastNotificationEvent?.receivedAt, matchId, exitConversationDueToAccessLoss, loadMatchMeta]);

  // While chat is open, poll so both matchmakers see new messages without leaving.
  useEffect(() => {
    if (!matchId || !isFocused) return undefined;
    const id = setInterval(() => {
      loadConversationMessages({ showErrors: false });
    }, CONVERSATION_POLL_MS);
    return () => clearInterval(id);
  }, [matchId, isFocused, loadConversationMessages]);

  // Two-MM pending: peer approval only changes GET /match/matches — poll lightly while focused (push also refreshes).
  useEffect(() => {
    if (!matchId || !isFocused) return undefined;
    if (userInfo?.role !== 'matchmaker') return undefined;
    if (matchInfo?.status !== 'pending_approval') return undefined;
    if (!matchInfo?.both_matchmakers_involved) return undefined;
    const id = setInterval(() => {
      loadMatchMeta();
    }, MATCH_META_PENDING_POLL_MS);
    return () => clearInterval(id);
  }, [
    matchId,
    isFocused,
    userInfo?.role,
    matchInfo?.status,
    matchInfo?.both_matchmakers_involved,
    loadMatchMeta,
  ]);

  useEffect(() => {
    const fetchNames = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) return;

        const uniqueIds = [...new Set(messages.map((m) => m.sender_id))];
        const names = {};
        const roles = {};
        const referrerIds = {};
        for (const id of uniqueIds) {
          try {
            const res = await fetch(`${API_BASE_URL}/profile/${id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const data = await res.json();
              names[id] = data.user?.first_name || data.first_name;
              roles[id] = data.user?.role || data.role;
              referrerIds[id] = data.user?.referrer_id ?? data.referrer_id ?? null;
            }
          } catch (err) {
            console.error('Error fetching sender name:', err);
          }
        }
        setSenderNames(names);
        setSenderRoles(roles);
        setSenderReferrerIds(referrerIds);
      } catch (err) {
        console.error('Error fetching names:', err);
      }
    };
    if (messages.length > 0) fetchNames();
  }, [messages]);

  const scrollToBottom = (animated = true) => {
    // Retry a few times to handle intermittent keyboard/layout timing.
    requestAnimationFrame(() => scrollViewRef.current?.scrollToEnd({ animated }));
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated }), 40);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated }), 140);
  };

  useEffect(() => {
      if (!loading) {
        scrollToBottom(false);
      }
  }, [loading, messages, selectedPuzzleLink]);

  const scrollToEnd = () => {
    scrollToBottom(true);
  };

  useKeyboardHandler({
    onMove: (e) => {
      'worklet';
      keyboardHeightAnim.value = e.height;
    },
    onEnd: (e) => {
      'worklet';
      keyboardHeightAnim.value = e.height;
      runOnJS(scrollToEnd)();
    },
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    marginBottom: Platform.OS === 'android' ? keyboardHeightAnim.value : 0,
  }));

  const sendMessage = async () => {
    if (!newMessageText.trim() && !selectedPuzzleLink) return;

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return navigation.navigate('Login');

      const bodyData = {};
      if (newMessageText.trim()) bodyData.message = newMessageText.trim();
      if (selectedPuzzleLink) {
        bodyData.puzzle_type = selectedPuzzleType;
        bodyData.puzzle_link = selectedPuzzleLink;
      }

      const res = await fetch(`${API_BASE_URL}/conversation/${matchId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(bodyData),
      });

      if (res.status === 403) {
        exitConversationDueToAccessLoss();
        return;
      }

      if (res.ok || res.status === 201) {
        const data = await res.json();
        setMessages(normalizeMessages(data.messages || []));
        if (typingDebounceRef.current) {
          clearTimeout(typingDebounceRef.current);
          typingDebounceRef.current = null;
        }
        clearTypingIdleClearTimer();
        postTyping(false);
        setNewMessageText('');
        setSelectedPuzzleLink('');
        InteractionManager.runAfterInteractions(() => {
          scrollToBottom(true);
        });
        // Refresh match info to get updated message count
        if (matchId) {
          const token = await AsyncStorage.getItem('token');
          const matchRes = await fetch(`${API_BASE_URL}/match/matches`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (matchRes.ok) {
            const matchData = await matchRes.json();
            const allMatches = Array.isArray(matchData) ? matchData : [...(matchData.matched || []), ...(matchData.pending_approval || [])];
            const updatedMatch = allMatches.find((m) => m.match_id === Number(matchId));
            if (updatedMatch) setMatchInfo(updatedMatch);
          }
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        Alert.alert('Error', errorData.error || 'Failed to send message');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const isMine = (msg) => msg.sender_id === userInfo?.id;

  const getSenderLabel = (msg) => {
    if (isMine(msg)) return '';
    const senderRole = senderRoles[msg.sender_id];
    const trimmedSenderName =
      senderNames[msg.sender_id] != null ? String(senderNames[msg.sender_id]).trim() : '';
    const senderName = trimmedSenderName || 'Loading...';
    if (senderRole === undefined && userInfo?.role === 'matchmaker') {
      // During profile lookup, prefer a stable label for matchmaker-mediated chats.
      return 'Matchmaker';
    }
    if (senderRole === 'matchmaker') {
      const senderLinkedDaterId = senderReferrerIds[msg.sender_id];
      const isDaterViewer = userInfo?.role === 'user';
      const myLinkedDaterId = isDaterViewer
        ? userInfo?.id
        : (userInfo?.referrer_id ?? userInfo?.referred_by_id ?? null);
      const isCurrentUsersMatchmaker =
        myLinkedDaterId != null &&
        senderLinkedDaterId != null &&
        Number(senderLinkedDaterId) === Number(myLinkedDaterId);

      let myDaterFirstName = '';
      if (isDaterViewer) {
        myDaterFirstName = userInfo?.first_name != null ? String(userInfo.first_name).trim() : '';
      } else if (userInfo?.role === 'matchmaker') {
        myDaterFirstName =
          (matchInfo?.linked_dater?.first_name != null && String(matchInfo.linked_dater.first_name).trim()) ||
          (referrerInfo?.first_name != null && String(referrerInfo.first_name).trim()) ||
          '';
      }

      const otherDaterFirstName =
        matchUser?.first_name != null ? String(matchUser.first_name).trim() : '';

      if (isDaterViewer || userInfo?.role === 'matchmaker') {
        if (isCurrentUsersMatchmaker) {
          return myDaterFirstName ? `${myDaterFirstName} • Matchmaker` : 'Matchmaker';
        }
        return otherDaterFirstName ? `${otherDaterFirstName} • Matchmaker` : 'Matchmaker';
      }
      return 'Matchmaker';
    }
    if (senderRole === 'user' || senderRole === 'dater') {
      return trimmedSenderName ? `${trimmedSenderName} • Dater` : senderName;
    }
    return senderName;
  };

  const handleApprove = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return navigation.navigate('Login');

      // Show confirmation alert if both matchmakers are involved and we haven't approved yet
      if (matchInfo?.both_matchmakers_involved && !waitingForOtherApproval) {
        Alert.alert(
          'Confirm Approval',
          'Once you approve this match, you wont be able to send a message till the other matchmaker approves it',
          [
            { text: 'No, dont approve yet', style: 'cancel' },
            {
              text: 'Yes, approve',
              onPress: async () => {
                await performApprove(token);
              }
            }
          ]
        );
      } else {
        await performApprove(token);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to approve match');
    }
  };

  const performApprove = async (token) => {
    try {
      const res = await fetch(`${API_BASE_URL}/match/approve/${matchId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setApprovedByMeLocally(true);
        if (data.waiting_for_other) {
          Alert.alert('Success', 'Your approval has been recorded. Waiting for the other matchmaker to approve.');
        } else {
          Alert.alert('Success', 'Match approved successfully');
        }
        // Refresh match info
        const matchRes = await fetch(`${API_BASE_URL}/match/matches`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (matchRes.ok) {
          const matchData = await matchRes.json();
          const allMatches = Array.isArray(matchData) ? matchData : [...(matchData.matched || []), ...(matchData.pending_approval || [])];
          const updatedMatch = allMatches.find((m) => m.match_id === Number(matchId));
          if (updatedMatch) {
            setMatchInfo(updatedMatch);
            // Only navigate back if match is fully approved
            if (updatedMatch.status === 'matched') {
              navigation.navigate('Main', { screen: 'Conversations' });
            }
          }
        }
      } else {
        const data = await res.json();
        Alert.alert('Error', data.message || 'Failed to approve match');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to approve match');
    }
  };

  const isPendingApproval = matchInfo?.status === 'pending_approval';
  const messageCount = matchInfo?.message_count || 0;
  const canSendMore = messageCount < 10;
  const waitingForOtherApproval = matchInfo?.waiting_for_other_approval || false;

  const mediatedChatAsDater =
    userInfo?.role === 'user' &&
    matchInfo &&
    (matchInfo.status === 'pending_approval' ||
      matchInfo.message_count !== undefined ||
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
  const approvedByOtherMatchmaker = matchInfo?.approved_by_other_matchmaker || false;
  const hasBlindValueFromMatchInfo = typeof matchInfo?.blind_match === 'string';
  const isBlindFromMatchInfo = hasBlindValueFromMatchInfo && matchInfo?.blind_match === 'Blind';
  const effectiveIsBlind = hasBlindValueFromMatchInfo ? isBlindFromMatchInfo : !!isBlind;
  const accentColor = getRoleAccentColor(userInfo?.role || 'matchmaker');

  const typingBannerText = useMemo(() => {
    if (!othersTyping.length) return null;
    const labels = othersTyping.map((t) => {
      if (t.role === 'matchmaker' && userInfo?.role === 'user') return 'Matchmaker';
      return (t.first_name && String(t.first_name).trim()) || 'Someone';
    });
    if (labels.length === 1) return `${labels[0]} is typing…`;
    if (labels.length === 2) return `${labels[0]} and ${labels[1]} are typing…`;
    return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]} are typing…`;
  }, [othersTyping, userInfo?.role]);

  // Matchmakers see this when both are involved and one approval is still outstanding.
  const showSpeakingWithMatchmakerForMatchmaker =
    isPendingApproval &&
    userInfo?.role === 'matchmaker' &&
    matchInfo?.both_matchmakers_involved &&
    !approvedByOtherMatchmaker;

  // Daters see this for pending approvals (these are matchmaker-mediated flows).
  const showSpeakingWithMatchmakerForDater =
    isPendingApproval &&
    userInfo?.role === 'user';

  const showSpeakingWithMatchmaker =
    showSpeakingWithMatchmakerForMatchmaker || showSpeakingWithMatchmakerForDater;
  // Show "(approved by other matchmaker)" when the other matchmaker has approved but we haven't
  const showApprovedByOther = isPendingApproval && userInfo?.role === 'matchmaker' && approvedByOtherMatchmaker;
  const hasLeftPendingApproval = !!matchInfo?.status && matchInfo.status !== 'pending_approval';
  const isApprovedByMatchmaker =
    userInfo?.role === 'matchmaker' &&
    (
      hasLeftPendingApproval ||
      matchInfo?.status === 'matched' ||
      waitingForOtherApproval ||
      approvedByMeLocally
    );
  const showHeaderUnmatchAction =
    userInfo?.role === 'matchmaker' &&
    isPendingApproval &&
    !isApprovedByMatchmaker;
  const showHeaderBlindToggle = userInfo?.role === 'matchmaker' && !!matchInfo;
  // REPLACE WITH:
  const androidActionsBottomPadding =
    Platform.OS === 'android' ? (isKeyboardVisible ? 8 : 16 + insets.bottom) : 16;
  const androidSheetBottomPadding = 16 + insets.bottom;
  const goBackToConversations = () => {
    if (Platform.OS === 'ios') {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Main', params: { screen: 'Conversations' } }],
        })
      );
      return;
    }
    navigation.navigate('Main', { screen: 'Conversations' });
  };
  const iosEdgePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => Platform.OS === 'ios' && evt.nativeEvent.pageX <= 28,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Platform.OS === 'ios' &&
        gestureState.dx > 12 &&
        Math.abs(gestureState.dy) < 24,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 56 && Math.abs(gestureState.dy) < 48) {
          goBackToConversations();
        }
      },
      onPanResponderTerminate: () => {},
      onShouldBlockNativeResponder: () => false,
    })
  ).current;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={accentColor} />
        <Text style={styles.loadingText}>Loading conversation...</Text>
      </View>
    );
  }

  const handleBlock = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      if (!matchUser) {
        Alert.alert('Error', 'User information not available');
        return;
      }

      Alert.alert(
        'Block User',
        'Are you sure you want to block this user? The match will be removed and you will never see each other again.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              try {
                // First, block the user
                const blockRes = await fetch(`${API_BASE_URL}/match/block/${matchUser.id}`, {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${token}`
                  }
                });

                if (blockRes.status === 401) {
                  const data = await blockRes.json();
                  if (data.error_code === 'TOKEN_EXPIRED') {
                    await AsyncStorage.removeItem('token');
                    Alert.alert('Session expired', 'Please log in again.');
                    navigation.navigate('Login');
                    return;
                  }
                }

                if (!blockRes.ok) {
                  const data = await blockRes.json();
                  Alert.alert('Error', data.message || 'Failed to block user');
                  return;
                }

                // Then, unmatch
                const unmatchRes = await fetch(`${API_BASE_URL}/match/unmatch/${matchId}`, {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${token}` }
                });

                if (unmatchRes.status === 401) {
                  const data = await unmatchRes.json();
                  if (data.error_code === 'TOKEN_EXPIRED') {
                    await AsyncStorage.removeItem('token');
                    Alert.alert('Session expired', 'Please log in again.');
                    navigation.navigate('Login');
                    return;
                  }
                }

                if (unmatchRes.ok) {
                  Alert.alert('Success', 'User blocked and match removed successfully');
                  navigation.navigate('Main', { screen: 'Conversations' });
                } else {
                  // Block succeeded but unmatch failed - still show success for blocking
                  Alert.alert('Success', 'User blocked successfully');
                  navigation.navigate('Main', { screen: 'Conversations' });
                }
              } catch (err) {
                console.error('Error blocking/unmatching:', err);
                Alert.alert('Error', 'Failed to complete action');
              }
            }
          }
        ]
      );
    } catch (err) {
      console.error('Error:', err);
      Alert.alert('Error', 'Failed to block user');
    }
  };

  const handleUnmatchFromMenu = async () => {
    setMenuVisible(false);
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
        Alert.alert('Success', 'Match removed successfully');
        navigation.navigate('Main', { screen: 'Conversations' });
      } else {
        const data = await res.json();
        Alert.alert('Error', data.message || 'Failed to unmatch');
      }
    } catch (err) {
      console.error('Error unmatching:', err);
      Alert.alert('Error', 'Failed to unmatch');
    }
  };

  const handleRemoveMyMatchmakerFromMenu = async () => {
    setMenuVisible(false);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }
      Alert.alert(
        'Remove your matchmaker',
        'Your matchmaker will no longer be able to view this chat or send puzzles. You can keep talking with the other dater and their matchmaker.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                const res = await fetch(`${API_BASE_URL}/conversation/${matchId}/remove-my-matchmaker`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (res.status === 401) {
                  const data = await res.json().catch(() => ({}));
                  if (data.error_code === 'TOKEN_EXPIRED') {
                    await AsyncStorage.removeItem('token');
                    Alert.alert('Session expired', 'Please log in again.');
                    navigation.navigate('Login');
                  }
                  return;
                }
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  Alert.alert('Error', data.message || 'Could not remove matchmaker');
                  return;
                }
                setMatchInfo((prev) =>
                  prev
                    ? {
                        ...prev,
                        dater_removed_matcher_1: data.dater_removed_matcher_1 ?? prev.dater_removed_matcher_1,
                        dater_removed_matcher_2: data.dater_removed_matcher_2 ?? prev.dater_removed_matcher_2,
                      }
                    : prev
                );
                Alert.alert('Done', 'Your matchmaker has been removed from this conversation.');
              } catch (err) {
                console.error(err);
                Alert.alert('Error', 'Something went wrong');
              }
            },
          },
        ]
      );
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Something went wrong');
    }
  };

  const handleBlockFromMenu = async () => {
    setMenuVisible(false);
    await handleBlock();
  };

  const handleRevealFromMenu = async () => {
    setMenuVisible(false);
    await handleReveal();
  };

  const handleHideFromMenu = async () => {
    setMenuVisible(false);
    await handleHide();
  };

  const handleUnmatchConfirmFromMenu = async () => {
    setMenuVisible(false);
    await handleUnmatch();
  };

  const handleUnmatch = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      Alert.alert(
        'Unmatch',
        'Are you sure you want to unmatch?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unmatch',
            style: 'destructive',
            onPress: async () => {
              try {
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
                  }
                  return;
                }

                if (res.ok) {
                  Alert.alert('Success', 'Match removed successfully');
                  navigation.navigate('Main', { screen: 'Conversations' });
                } else {
                  const data = await res.json();
                  Alert.alert('Error', data.message || 'Failed to unmatch');
                }
              } catch (err) {
                console.error('Error unmatching:', err);
                Alert.alert('Error', 'Failed to unmatch');
              }
            }
          }
        ]
      );
    } catch (err) {
      console.error('Error:', err);
      Alert.alert('Error', 'Failed to unmatch');
    }
  };

  const handleReveal = async () => {
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

      setMatchInfo((prev) => (prev ? { ...prev, blind_match: 'Revealed' } : prev));
      Alert.alert('Success', 'Match revealed');
    } catch (err) {
      console.error('Error revealing match:', err);
      Alert.alert('Error', 'Something went wrong revealing the match');
    }
  };

  const handleHide = async () => {
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

      setMatchInfo((prev) => (prev ? { ...prev, blind_match: 'Blind' } : prev));
      Alert.alert('Success', 'Match hidden');
    } catch (err) {
      console.error('Error hiding match:', err);
      Alert.alert('Error', 'Something went wrong hiding the match');
    }
  };

  return (
    <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={styles.backButton} onPress={goBackToConversations}>
            <Ionicons name="arrow-back" size={24} color={accentColor} />
            <Text style={[styles.backButtonText, { color: accentColor }]}>Back</Text>
          </TouchableOpacity>

          {userInfo?.role === 'matchmaker' && (
            <View style={styles.headerActions}>
              {isPendingApproval && !waitingForOtherApproval && (
                <TouchableOpacity
                  style={[styles.headerApproveButton, { backgroundColor: accentColor }]}
                  onPress={handleApprove}
                >
                  <Text style={styles.headerApproveButtonText}>Approve</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => setMenuVisible(true)}
              >
                <Ionicons name="ellipsis-vertical" size={24} color={accentColor} />
              </TouchableOpacity>
            </View>
          )}
          {userInfo?.role === 'user' && (
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => setMenuVisible(true)}
              >
                <Ionicons name="ellipsis-vertical" size={24} color={accentColor} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {matchUser && (
          <TouchableOpacity
            style={styles.matchAvatarSection}
            disabled={effectiveIsBlind && userInfo?.role !== 'matchmaker'}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('ProfilePage', { userId: matchUser.id, matchProfile: true })}
          >
            {matchUser.first_image ? (
              <Image
                source={{ uri: getImageUrl(matchUser.first_image, API_BASE_URL) }}
                style={[styles.matchAvatarImg, { borderColor: accentColor }]}
                blurRadius={effectiveIsBlind && userInfo?.role !== 'matchmaker' ? 40 : 0}
              />
            ) : (
              <View style={[styles.matchPlaceholder, { backgroundColor: accentColor }]}>
                <Text style={styles.placeholderText}>{matchUser.first_name?.[0] || '?'}</Text>
              </View>
            )}
            <View style={styles.titleContainer}>
              <Text style={styles.convoTitle}>{matchUser.first_name || `Match ${matchId}`}</Text>
              {showSpeakingWithMatchmaker && (
                <Text style={[styles.speakingWithMatchmakerText, { color: accentColor }]}>(speaking with matchmaker)</Text>
              )}
              {showApprovedByOther && (
                <Text style={[styles.speakingWithMatchmakerText, { color: accentColor }]}>(approved by other matchmaker)</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Message countdown banner for matchmakers */}
      {userInfo?.role === 'matchmaker' && isPendingApproval && (
        <View style={styles.messageCountBannerContainer}>
          <View style={styles.messageCountBanner}>
            <Svg style={StyleSheet.absoluteFill} height="100%" width="100%">
              <Defs>
                <LinearGradient id="messageGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#9D7AFF" stopOpacity="1" />
                  <Stop offset="100%" stopColor="#5B3A8F" stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#messageGradient)" rx={12} />
            </Svg>
            <Text style={styles.messageCountBannerText}>
              {waitingForOtherApproval
                ? 'Waiting for approval'
                : canSendMore 
                  ? `${10 - messageCount} messages left to break the ice`
                  : 'Message limit reached. Please approve to continue'}
            </Text>
          </View>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          ...styles.messagesContent,
          paddingBottom: selectedPuzzleLink ? 1 : 0, // extra space if a puzzle is selected
        }}
        onScroll={handleScrollViewScroll}
        scrollEventThrottle={100}
        onLayout={(e) => {
          scrollMetricsRef.current = {
            ...scrollMetricsRef.current,
            layoutH: e.nativeEvent.layout.height,
          };
        }}
        onContentSizeChange={(contentWidth, contentHeight) => {
          const m = scrollMetricsRef.current;
          const layoutH = m.layoutH;
          const prevContentH = m.contentH;
          const prevScrollY = m.scrollY;

          scrollMetricsRef.current = { ...m, contentH: contentHeight };

          if (layoutH <= 0 || contentHeight <= 0) return;

          const maxScrollOld = Math.max(0, prevContentH - layoutH);
          const maxScrollNew = Math.max(0, contentHeight - layoutH);
          const distFromBottom =
            maxScrollOld <= 0 ? 0 : maxScrollOld - prevScrollY;
          const wasNearBottom =
            maxScrollOld <= 0 || distFromBottom <= TYPING_SCROLL_BOTTOM_THRESHOLD_PX;

          if (wasNearBottom && scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ y: maxScrollNew, animated: false });
            scrollMetricsRef.current.scrollY = maxScrollNew;
          }
        }}
      >
        {messages.length === 0 ? (
          <Text style={styles.emptyText}>No messages yet. Say hi!</Text>
        ) : (
          messages.map((msg, index) => {
            const mine = isMine(msg);
            const senderLabel = getSenderLabel(msg);
            const messageKey = msg.id ?? `${msg.sender_id || 'unknown'}-${msg.timestamp || index}-${index}`;

            return (
              <View key={messageKey} style={[styles.messageBubble, mine ? [styles.mine, { backgroundColor: accentColor }] : styles.theirs]}>
                {!mine && <Text style={[styles.senderLabel, { color: accentColor }]}>{senderLabel}</Text>}
                {msg.text && <Text style={[styles.messageText, mine && { color: '#fff' }]}>{msg.text}</Text>}
                {msg.puzzle_type && (
                  <TouchableOpacity style={styles.puzzleBubble} onPress={() => {
                    AsyncStorage.setItem('activeMatchId', matchId.toString());
                    navigation.navigate(msg.puzzle_link, { matchId: matchId.toString() });
                  }}>
                    <Ionicons name="game-controller-outline" size={20} color={accentColor} />
                    <Text style={[styles.puzzleText, { color: accentColor }]}>Play {msg.puzzle_type}</Text>
                  </TouchableOpacity>
                )}
                <Text style={[styles.timestamp, mine && userInfo?.role === 'user' && styles.timestampMineDater]}>
                  {formatMessageTimestamp(msg.timestamp)}
                </Text>
              </View>
            );
          })
        )}
        {typingBannerText ? (
          <Text style={styles.typingIndicatorInScroll}>{typingBannerText}</Text>
        ) : null}
      </ScrollView>

      {selectedPuzzleLink ? (
        <View style={styles.selectedPuzzlePreview}>
          <Ionicons name="game-controller-outline" size={20} color={accentColor} />
          <Text style={[styles.selectedPuzzleText, { color: accentColor }]}>{selectedPuzzleType}</Text>
          <TouchableOpacity onPress={() => { setSelectedPuzzleLink(''); setSelectedPuzzleType(games[0].name); }}>
            <Ionicons name="close" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      ) : null}

      {userInfo?.role !== 'matchmaker' && (
        <TextInput
          style={styles.messageInput}
          value={newMessageText}
          onChangeText={handleComposerChange}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          multiline
        />
      )}


      {/* Message input for matchmakers when pending approval and under limit and not waiting */}
      {userInfo?.role === 'matchmaker' && isPendingApproval && canSendMore && !waitingForOtherApproval && (
        <TextInput
          style={styles.messageInput}
          value={newMessageText}
          onChangeText={handleComposerChange}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          multiline
        />
      )}

      <View style={[styles.sendActions, { paddingBottom: androidActionsBottomPadding }]}>
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: accentColor },
            ((!newMessageText.trim() && !selectedPuzzleLink) || (userInfo?.role === 'matchmaker' && isPendingApproval && (!canSendMore || waitingForOtherApproval))) && styles.sendButtonDisabled
          ]}
          onPress={sendMessage}
          disabled={(!newMessageText.trim() && !selectedPuzzleLink) || (userInfo?.role === 'matchmaker' && isPendingApproval && (!canSendMore || waitingForOtherApproval))}
          activeOpacity={1}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.sendPuzzleButton, { borderColor: accentColor }]} onPress={() => setPuzzleSheetOpen(true)}>
          <Ionicons name="game-controller-outline" size={20} color={accentColor} />
          <Text style={[styles.sendPuzzleButtonText, { color: accentColor }]}>Puzzle</Text>
        </TouchableOpacity>
      </View>
      </Animated.View>

      <Modal visible={puzzleSheetOpen} transparent animationType="slide" onRequestClose={() => setPuzzleSheetOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setPuzzleSheetOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: androidSheetBottomPadding }]}>
          <Text style={styles.sheetTitle}>Choose a Puzzle</Text>
          <FlatList
            data={games}
            keyExtractor={(item) => item.path}
            renderItem={({ item }) => {
              const isSelected = item.path === selectedPuzzleLink;
              return (
                <TouchableOpacity
                  style={[styles.sheetItem, isSelected && styles.sheetItemSelected]}
                  onPress={() => {
                    setSelectedPuzzleType(item.name);
                    setSelectedPuzzleLink(item.path);
                    setPuzzleSheetOpen(false);
                    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 20);
                  }}
                >
                  <Text style={[styles.sheetItemText, isSelected && styles.sheetItemTextSelected, isSelected && { color: accentColor }]}>{item.name}</Text>
                  {isSelected && <Ionicons name="checkmark" size={20} color={accentColor} />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>

      {/* Overflow menu modal */}
      {(userInfo?.role === 'user' || userInfo?.role === 'matchmaker') && (
        <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
          <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
            <View style={styles.menuContainer}>
              {userInfo?.role === 'matchmaker' && showHeaderBlindToggle && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={effectiveIsBlind ? handleRevealFromMenu : handleHideFromMenu}
                >
                  <Text style={styles.menuItemText}>{effectiveIsBlind ? 'Reveal Match' : 'Blind Match'}</Text>
                </TouchableOpacity>
              )}
              {userInfo?.role === 'matchmaker' && showHeaderUnmatchAction && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleUnmatchConfirmFromMenu}
                >
                  <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Unmatch</Text>
                </TouchableOpacity>
              )}
              {userInfo?.role === 'user' && canRemoveOwnMatchmaker && (
                <TouchableOpacity style={styles.menuItem} onPress={handleRemoveMyMatchmakerFromMenu}>
                  <Text style={styles.menuItemText}>Remove Matchmaker</Text>
                </TouchableOpacity>
              )}
              {userInfo?.role === 'user' && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleUnmatchFromMenu}
                >
                  <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Unmatch</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemLast]}
                onPress={handleBlockFromMenu}
              >
                <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Block</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      )}
      {Platform.OS === 'ios' ? (
        <View
          pointerEvents="box-only"
          style={styles.leftEdgeSwipeHitArea}
          {...iosEdgePanResponder.panHandlers}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  header: { backgroundColor: '#fff', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e0e6ef' },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButtonText: { color: '#6c5ce7', fontSize: 16, fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  headerApproveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#6c5ce7',
  },
  headerApproveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  menuButton: {
    padding: 8,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 16,
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  menuItemTextDanger: {
    color: '#e53e3e',
  },
  matchAvatarSection: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  matchAvatarImg: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#6c5ce7' },
  matchPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#6c5ce7', justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  titleContainer: { flexDirection: 'column', alignItems: 'flex-start', gap: 2 },
  convoTitle: { fontSize: 20, fontWeight: '700', color: '#222' },
  speakingWithMatchmakerText: { fontSize: 12, color: '#6c5ce7', fontStyle: 'italic' },
  messageCountBannerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  messageCountBanner: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  messageCountBannerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    zIndex: 1,
  },
  messagesContent: { padding: 16, gap: 12 },
  emptyText: { textAlign: 'center', color: '#6b7280', fontSize: 16, marginTop: 40 },
  typingIndicatorInScroll: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 14,
    fontStyle: 'italic',
    color: '#6b7280',
  },
  messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 16, marginBottom: 8 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#6c5ce7' },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#fff' },
  senderLabel: { fontSize: 12, fontWeight: '600', color: '#6c5ce7', marginBottom: 4 },
  messageText: { fontSize: 16, color: '#222' },
  puzzleBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, padding: 8, backgroundColor: '#fafafa', borderRadius: 8 },
  puzzleText: { fontSize: 14, color: '#6c5ce7', fontWeight: '600' },
  timestamp: { fontSize: 11, color: '#999', marginTop: 4 },
  timestampMineDater: { color: '#d1d5db' },
  selectedPuzzlePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    marginHorizontal: 16,
    borderRadius: 20,
    marginBottom: 8,
    gap: 8,
  },
  selectedPuzzleText: { fontSize: 16, color: '#6c5ce7', fontWeight: '600', flex: 1 },
  messageInput: { borderWidth: 1, borderColor: '#e0e6ef', borderRadius: 20, padding: 12, marginHorizontal: 16, marginBottom: 8, maxHeight: 100, fontSize: 16, backgroundColor: '#fff' },
  sendActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  sendButton: { flex: 1, backgroundColor: '#6c5ce7', padding: 12, borderRadius: 20, alignItems: 'center' },
  sendButtonDisabled: { backgroundColor: '#ccc', opacity: 0.6 },
  sendButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sendPuzzleButton: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, borderRadius: 20, backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#6c5ce7' },
  sendPuzzleButtonText: { color: '#6c5ce7', fontSize: 14, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '50%' },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  sheetItem: { padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetItemSelected: { backgroundColor: '#fafafa', borderRadius: 8 },
  sheetItemText: { fontSize: 16, color: '#222' },
  sheetItemTextSelected: { fontWeight: '700', color: '#6c5ce7' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#6b7280' },
  leftEdgeSwipeHitArea: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 28,
    zIndex: 1200,
    backgroundColor: 'transparent',
  },
});

export default MatchConvo;
