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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { API_BASE_URL } from '../../env';
import { useUserInfo } from './hooks/useUserInfo';
import { games } from '../puzzles/puzzlesPage';
import { Ionicons } from '@expo/vector-icons';

const MatchConvo = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { matchId, isBlind } = route.params || {};
  const { userInfo } = useUserInfo(API_BASE_URL);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessageText, setNewMessageText] = useState('');
  const [selectedPuzzleType, setSelectedPuzzleType] = useState(games[0].name);
  const [selectedPuzzleLink, setSelectedPuzzleLink] = useState('');
  const [senderNames, setSenderNames] = useState({});
  const [senderRoles, setSenderRoles] = useState({});
  const [matchUser, setMatchUser] = useState(null);
  const [puzzleSheetOpen, setPuzzleSheetOpen] = useState(false);

  const scrollViewRef = useRef(null);

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
          setMessages(data || []);
        }
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to load conversation');
      } finally {
        setLoading(false);
      }
    };
    if (matchId) fetchConversation();
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
          const matchInfo = data.find((m) => m.match_id === Number(matchId));
          if (matchInfo) setMatchUser(matchInfo.match_user);
        }
      } catch (err) {
        console.error('Error fetching match user:', err);
      }
    };
    if (matchId) fetchMatchUser();
  }, [matchId]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });
  
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
  if (!loading) {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    });
  }
}, [loading, messages, selectedPuzzleLink]);

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
        setMessages(data.messages || []);
        setNewMessageText('');
        setSelectedPuzzleLink('');
      } else {
        Alert.alert('Error', 'Failed to send message');
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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Main', { screen: 'Conversations' })}>
          <Ionicons name="arrow-back" size={24} color="#6B46C1" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        {matchUser && (
          <TouchableOpacity
            style={styles.matchAvatarSection}
            disabled={isBlind && userInfo?.role !== 'matchmaker'}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('ProfilePage', { userId: matchUser.id, matchProfile: true })}
          >
            {matchUser.first_image ? (
              <Image
                source={{ uri: matchUser.first_image.startsWith('http') ? matchUser.first_image : `${API_BASE_URL}${matchUser.first_image}` }}
                style={styles.matchAvatarImg}
              />
            ) : (
              <View style={styles.matchPlaceholder}>
                <Text style={styles.placeholderText}>{matchUser.first_name?.[0] || '?'}</Text>
              </View>
            )}
            <Text style={styles.convoTitle}>{matchUser.first_name || `Match ${matchId}`}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          ...styles.messagesContent,
          paddingBottom: selectedPuzzleLink ? 1 : 0, // extra space if a puzzle is selected
        }}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.length === 0 ? (
          <Text style={styles.emptyText}>No messages yet. Say hi!</Text>
        ) : (
          messages.map((msg) => {
            const mine = isMine(msg);
            const senderLabel = getSenderLabel(msg);

            return (
              <View key={msg.id} style={[styles.messageBubble, mine ? styles.mine : styles.theirs]}>
                {!mine && <Text style={styles.senderLabel}>{senderLabel}</Text>}
                {msg.text && <Text style={[styles.messageText, mine && { color: '#fff' }]}>{msg.text}</Text>}
                {msg.puzzle_type && (
                  <TouchableOpacity style={styles.puzzleBubble} onPress={() => navigation.navigate(msg.puzzle_link)}>
                    <Ionicons name="game-controller-outline" size={20} color="#6B46C1" />
                    <Text style={styles.puzzleText}>Play {msg.puzzle_type}</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.timestamp}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {selectedPuzzleLink ? (
        <View style={styles.selectedPuzzlePreview}>
          <Ionicons name="game-controller-outline" size={20} color="#6B46C1" />
          <Text style={styles.selectedPuzzleText}>{selectedPuzzleType}</Text>
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

      <View style={styles.sendActions}>
        <TouchableOpacity
          style={[
            styles.sendButton,
            !newMessageText.trim() && !selectedPuzzleLink && styles.sendButtonDisabled
          ]}
          onPress={sendMessage}
          disabled={!newMessageText.trim() && !selectedPuzzleLink}
          activeOpacity={1}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.sendPuzzleButton} onPress={() => setPuzzleSheetOpen(true)}>
          <Ionicons name="game-controller-outline" size={20} color="#6B46C1" />
          <Text style={styles.sendPuzzleButtonText}>Puzzle</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={puzzleSheetOpen} transparent animationType="slide" onRequestClose={() => setPuzzleSheetOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setPuzzleSheetOpen(false)} />
        <View style={styles.sheet}>
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
                  <Text style={[styles.sheetItemText, isSelected && styles.sheetItemTextSelected]}>{item.name}</Text>
                  {isSelected && <Ionicons name="checkmark" size={20} color="#6B46C1" />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f4fc' },
  header: { backgroundColor: '#fff', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e0e6ef' },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  backButtonText: { color: '#6B46C1', fontSize: 16, fontWeight: '600' },
  matchAvatarSection: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  matchAvatarImg: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#6B46C1' },
  matchPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#6B46C1', justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  convoTitle: { fontSize: 20, fontWeight: '700', color: '#222' },
  messagesContent: { padding: 16, gap: 12 },
  emptyText: { textAlign: 'center', color: '#6b7280', fontSize: 16, marginTop: 40 },
  messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 16, marginBottom: 8 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#6B46C1' },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#fff' },
  senderLabel: { fontSize: 12, fontWeight: '600', color: '#6B46C1', marginBottom: 4 },
  messageText: { fontSize: 16, color: '#222' },
  puzzleBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, padding: 8, backgroundColor: '#f6f4fc', borderRadius: 8 },
  puzzleText: { fontSize: 14, color: '#6B46C1', fontWeight: '600' },
  timestamp: { fontSize: 11, color: '#999', marginTop: 4 },
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
  selectedPuzzleText: { fontSize: 16, color: '#6B46C1', fontWeight: '600', flex: 1 },
  messageInput: { borderWidth: 1, borderColor: '#e0e6ef', borderRadius: 20, padding: 12, marginHorizontal: 16, marginBottom: 8, maxHeight: 100, fontSize: 16, backgroundColor: '#fff' },
  sendActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  sendButton: { flex: 1, backgroundColor: '#6B46C1', padding: 12, borderRadius: 20, alignItems: 'center' },
  sendButtonDisabled: { backgroundColor: '#ccc', opacity: 0.6 },
  sendButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sendPuzzleButton: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, borderRadius: 20, backgroundColor: '#f6f4fc', borderWidth: 1, borderColor: '#6B46C1' },
  sendPuzzleButtonText: { color: '#6B46C1', fontSize: 14, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '50%' },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  sheetItem: { padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetItemSelected: { backgroundColor: '#f6f4fc', borderRadius: 8 },
  sheetItemText: { fontSize: 16, color: '#222' },
  sheetItemTextSelected: { fontWeight: '700', color: '#6B46C1' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f4fc' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#6b7280' },
});

export default MatchConvo;
