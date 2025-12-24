import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { API_BASE_URL } from '@env';
import { useUserInfo } from './hooks/useUserInfo';
import SendPuzzle from './conversationPuzzle';
import { games } from '../puzzles/puzzlesPage';
import { Ionicons } from '@expo/vector-icons';

const MatchConvo = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { matchId } = route.params || {};
  const { userInfo } = useUserInfo(API_BASE_URL);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessageText, setNewMessageText] = useState('');
  const [sendPuzzle, setSendPuzzle] = useState(false);
  const [selectedPuzzleType, setSelectedPuzzleType] = useState(games[0].name);
  const [selectedPuzzleLink, setSelectedPuzzleLink] = useState(games[0].path);
  const [senderNames, setSenderNames] = useState({});
  const [senderRoles, setSenderRoles] = useState({});
  const [matchUser, setMatchUser] = useState(null);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    const fetchConversation = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          Alert.alert('Error', 'Please log in');
          navigation.navigate('Login');
          return;
        }

        const res = await fetch(`${API_BASE_URL}/conversation/${matchId}`, {
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

        if (res.ok) {
          let data = await res.json();
          if (data.length > 0) data = data[0].messages;
          setMessages(data || []);
        }
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to load conversation');
      } finally {
        setLoading(false);
      }
    };
    if (matchId) {
      fetchConversation();
    }
  }, [matchId]);

  useEffect(() => {
    const fetchNames = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) return;

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
              names[id] = data.user?.first_name || data.first_name;
              roles[id] = data.user?.role || data.role;
            }
          } catch (err) {
            console.error('Error fetching sender name:', err);
          }
        }
        setSenderNames(names);
        setSenderRoles(roles);
      } catch (err) {
        console.error('Error fetching names:', err);
      }
    };
    if (messages.length > 0) {
      fetchNames();
    }
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
          const matchInfo = data.find((m) => m.match_id === Number(matchId));
          if (matchInfo) setMatchUser(matchInfo.match_user);
        }
      } catch (err) {
        console.error('Error fetching match user:', err);
      }
    };
    if (matchId) {
      fetchMatchUser();
    }
  }, [matchId]);

  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessageText.trim() && !sendPuzzle) return;

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const bodyData = {};
      if (newMessageText.trim()) bodyData.message = newMessageText.trim();
      if (sendPuzzle) {
        bodyData.puzzle_type = selectedPuzzleType;
        bodyData.puzzle_link = selectedPuzzleLink;
      }

      const res = await fetch(`${API_BASE_URL}/conversation/${matchId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bodyData),
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

      if (res.ok || res.status === 201) {
        const data = await res.json();
        setMessages(data.messages || []);
        setNewMessageText('');
        setSendPuzzle(false);
      } else {
        Alert.alert('Error', 'Failed to send message');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handlePuzzleClick = async (puzzleLink) => {
    await AsyncStorage.setItem('activeMatchId', matchId.toString());
    if (puzzleLink) {
      navigation.navigate(puzzleLink);
    }
  };

  const isMine = (msg) => msg.sender_id === userInfo?.id;

  const getSenderLabel = (msg) => {
    if (isMine(msg)) return '';

    const senderRole = senderRoles[msg.sender_id];
    const senderName = senderNames[msg.sender_id] || 'Loading...';

    if (senderRole === 'matchmaker') {
      if (userInfo?.role === 'user') return 'Matchmaker';
      return senderName;
    }

    return senderName;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6B46C1" />
        <Text style={styles.loadingText}>Loading conversation...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Main', { screen: 'Conversations' })}>
          <Ionicons name="arrow-back" size={24} color="#6B46C1" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        {matchUser && (
          <TouchableOpacity
            style={styles.matchAvatarSection}
            onPress={() => navigation.navigate('ProfilePage', { userId: matchUser.id, matchProfile: true })}
          >
            {matchUser.first_image ? (
              <Image
                source={{
                  uri: matchUser.first_image.startsWith('http')
                    ? matchUser.first_image
                    : `${API_BASE_URL}${matchUser.first_image}`
                }}
                style={styles.matchAvatarImg}
              />
            ) : (
              <View style={styles.matchPlaceholder}>
                <Text style={styles.placeholderText}>{matchUser.first_name?.[0] || '?'}</Text>
              </View>
            )}
            <Text style={styles.convoTitle}>
              {matchUser.first_name || `Match ${matchId}`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesBox}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.length === 0 ? (
          <Text style={styles.emptyText}>No messages yet. Say hi!</Text>
        ) : (
          messages.map((msg) => {
            const mine = isMine(msg);
            const senderLabel = getSenderLabel(msg);

            return (
              <View
                key={msg.id}
                style={[styles.messageBubble, mine ? styles.mine : styles.theirs]}
              >
                {!mine && <Text style={styles.senderLabel}>{senderLabel}</Text>}
                {msg.text && <Text style={[styles.messageText, mine && { color: '#fff' }]}>{msg.text}</Text>}
                {msg.puzzle_type && (
                  <TouchableOpacity
                    style={styles.puzzleBubble}
                    onPress={() => handlePuzzleClick(msg.puzzle_link)}
                  >
                    <Ionicons name="game-controller-outline" size={20} color="#6B46C1" />
                    <Text style={styles.puzzleText}>Play {msg.puzzle_type}</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.timestamp}>
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {sendPuzzle && (
        <SendPuzzle
          selectedPuzzleType={selectedPuzzleType}
          selectedPuzzleLink={selectedPuzzleLink}
          onPuzzleChange={(name, link) => {
            setSelectedPuzzleType(name);
            setSelectedPuzzleLink(link);
          }}
          onClose={() => setSendPuzzle(false)}
        />
      )}

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

      <View style={styles.sendActions}>
        <TouchableOpacity
          style={[styles.sendButton, (!newMessageText.trim() && !sendPuzzle) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!newMessageText.trim() && !sendPuzzle}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>

        {!sendPuzzle && (
          <TouchableOpacity
            style={styles.sendPuzzleButton}
            onPress={() => setSendPuzzle(true)}
          >
            <Ionicons name="game-controller-outline" size={20} color="#6B46C1" />
            <Text style={styles.sendPuzzleButtonText}>Puzzle</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f4fc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f6f4fc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e6ef',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  backButtonText: {
    color: '#6B46C1',
    fontSize: 16,
    fontWeight: '600',
  },
  matchAvatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  matchAvatarImg: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#6B46C1',
  },
  matchPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6B46C1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  convoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
  },
  messagesBox: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
    marginTop: 40,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: '#6B46C1',
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
  },
  senderLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B46C1',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#222',
  },
  puzzleBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f6f4fc',
    borderRadius: 8,
  },
  puzzleText: {
    fontSize: 14,
    color: '#6B46C1',
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#e0e6ef',
    borderRadius: 20,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    maxHeight: 100,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  sendActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sendButton: {
    flex: 1,
    backgroundColor: '#6B46C1',
    padding: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sendPuzzleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#f6f4fc',
    borderWidth: 1,
    borderColor: '#6B46C1',
  },
  sendPuzzleButtonText: {
    color: '#6B46C1',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default MatchConvo;
