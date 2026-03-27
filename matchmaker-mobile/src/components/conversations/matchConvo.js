import React, { useEffect, useState, useRef } from 'react';
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
import { CommonActions, useNavigation, useRoute, useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../env';
import { useUserInfo } from './hooks/useUserInfo';
import { games } from '../puzzles/puzzlesPage';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { getImageUrl } from '../profile/utils/profileUtils';
import { getRoleAccentColor } from '../layout/components/RoleHeaderBanner';
import { runOnJS } from 'react-native-reanimated';

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

function haveMessagesChanged(prevMessages, nextMessages) {
  if (prevMessages.length !== nextMessages.length) return true;
  for (let i = 0; i < nextMessages.length; i += 1) {
    const prev = prevMessages[i];
    const next = nextMessages[i];
    if (
      prev?.id !== next?.id ||
      prev?.text !== next?.text ||
      prev?.timestamp !== next?.timestamp ||
      prev?.puzzle_link !== next?.puzzle_link ||
      prev?.puzzle_type !== next?.puzzle_type
    ) {
      return true;
    }
  }
  return false;
}

const MatchConvo = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const containerRef = useRef(null);
  const { matchId, isBlind } = route.params || {};
  const { userInfo } = useUserInfo(API_BASE_URL);
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

  const scrollViewRef = useRef(null);
  const markConversationAsRead = async () => {
    if (!matchId || !isFocused) return;
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
  };

  useEffect(() => {
    const fetchConversation = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) return navigation.navigate('Login');

        const res = await fetch(`${API_BASE_URL}/conversation/${matchId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          const data = await res.json();
          if (data.error_code === 'TOKEN_EXPIRED') {
            await AsyncStorage.removeItem('token');
            Alert.alert('Session expired', 'Please log in again.');
            return navigation.navigate('Login');
          }
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
        Alert.alert('Error', 'Failed to load conversation');
      } finally {
        setLoading(false);
      }
    };
    if (matchId) fetchConversation();
  }, [matchId, isFocused]);

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

  useEffect(() => {
    const fetchMatchUser = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) return;

        const res = await fetch(`${API_BASE_URL}/match/matches`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          // Handle new structure: {matched: [], pending_approval: []}
          const allMatches = Array.isArray(data) ? data : [...(data.matched || []), ...(data.pending_approval || [])];
          const matchInfo = allMatches.find((m) => m.match_id === Number(matchId));
          if (matchInfo) {
            setMatchUser(matchInfo.match_user);
            setMatchInfo(matchInfo);
          }
        }
      } catch (err) {
        console.error('Error fetching match user:', err);
      }
    };
    if (matchId) fetchMatchUser();
  }, [matchId]);

  useEffect(() => {
    const pollConversation = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token || !matchId) return;

        const res = await fetch(`${API_BASE_URL}/conversation/${matchId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;

        const data = await res.json();
        const latestMessages = normalizeMessages(
          Array.isArray(data) && data.length > 0 ? data[0].messages : []
        );

        setMessages((prevMessages) => (
          haveMessagesChanged(prevMessages, latestMessages) ? latestMessages : prevMessages
        ));
        if (isFocused) {
          await markConversationAsRead();
        }
      } catch (err) {
        console.error('Error polling conversation:', err);
      }
    };

    if (!matchId || !isFocused) return undefined;

    const intervalId = setInterval(pollConversation, 3000);

    return () => clearInterval(intervalId);
  }, [matchId, isFocused]);

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

      if (res.ok || res.status === 201) {
        const data = await res.json();
        setMessages(normalizeMessages(data.messages || []));
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
    const senderName = senderNames[msg.sender_id] || 'Loading...';
    if (senderRole === undefined && userInfo?.role === 'matchmaker') {
      // During profile lookup, prefer a stable label for matchmaker-mediated chats.
      return 'Matchmaker';
    }
    if (senderRole === 'matchmaker') {
      if (userInfo?.role === 'user') {
        const senderLinkedDaterId = senderReferrerIds[msg.sender_id];
        const isUsersMatchmaker = Number(senderLinkedDaterId) === Number(userInfo?.id);
        return isUsersMatchmaker ? 'Matchmaker(you)' : 'Matchmaker(them)';
      }
      return 'Matchmaker';
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

  const isPendingApproval = matchInfo?.status === 'pending_approval' || matchInfo?.message_count !== undefined;
  const messageCount = matchInfo?.message_count || 0;
  const canSendMore = messageCount < 10;
  const waitingForOtherApproval = matchInfo?.waiting_for_other_approval || false;
  const approvedByOtherMatchmaker = matchInfo?.approved_by_other_matchmaker || false;
  const hasBlindValueFromMatchInfo = typeof matchInfo?.blind_match === 'string';
  const isBlindFromMatchInfo = hasBlindValueFromMatchInfo && matchInfo?.blind_match === 'Blind';
  const effectiveIsBlind = hasBlindValueFromMatchInfo ? isBlindFromMatchInfo : !!isBlind;
  const accentColor = getRoleAccentColor(userInfo?.role || 'matchmaker');

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
        onContentSizeChange={() => scrollToBottom(false)}
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
                    // Store matchId in AsyncStorage and pass as param
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
          onChangeText={setNewMessageText}
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
          onChangeText={setNewMessageText}
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
                  <Text style={styles.menuItemText}>{effectiveIsBlind ? 'Reveal' : 'Hide'}</Text>
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
