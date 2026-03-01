import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { API_BASE_URL } from '../../env';
import MatchCard from './matchCard';
import ToggleConversationsDater from './toggleConversationsDater';
import ToggleConversationsMatcher from './toggleConversationsMatcher';
import { useMatches } from './hooks/useMatches';
import { useUserInfo } from './hooks/useUserInfo';
import { useNotificationPolling } from './hooks/useNotificationPolling';
import DaterDropdown from '../layout/daterDropdown';
import MatcherHeader from '../layout/components/matcherHeader';

const Conversations = () => {
  const [showDaterMatches, setShowDaterMatches] = useState(true);
  const { userInfo, setUserInfo, referrerInfo, setReferrerInfo, loading: userLoading } = useUserInfo(API_BASE_URL);
  const { matches, setMatches, loading: matchesLoading, fetchMatches } = useMatches(API_BASE_URL);
  const matchedList = Array.isArray(matches) ? matches : (matches?.matched || []);
  const pendingApprovalList = Array.isArray(matches) ? [] : (matches?.pending_approval || []);
  const navigation = useNavigation();
  const [referrer, setReferrer] = useState(null);
  
  // Initialize notification polling
  useNotificationPolling();

  const loading = userLoading || matchesLoading;

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

  // Refresh profile and matches when page comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const timer = setTimeout(() => {
        fetchProfile();
        fetchMatches();
      }, 100);
      return () => clearTimeout(timer);
    }, [])
  );

  const getFilteredMatches = () => {
    if (!userInfo || userInfo.role !== 'user') {
      // For matchmakers, return both matched and pending_approval
      return { matched: matchedList, pending_approval: pendingApprovalList };
    }

    // For daters, filter matched list
    const filteredMatched = matchedList.filter(match => {
      if (showDaterMatches) {
        return !match.both_matchmakers_involved && match.linked_dater === null;
      } else {
        return match.both_matchmakers_involved || match.linked_dater !== null;
      }
    });
    
    // Pending approval matches go in dater section
    return { matched: filteredMatched, pending_approval: pendingApprovalList };
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

  const handleDaterChange = async (daterId) => {
    await fetchProfile();
    fetchMatches();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6c5ce7" />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  const filteredMatches = getFilteredMatches();
  
  // Update unmatch to handle new structure
  const handleUnmatch = async (matchId) => {
    await unmatch(matchId);
    fetchMatches();
  };

  return (
    <View style={styles.container}>
      {userInfo?.role === 'matchmaker' && (
        <MatcherHeader>
          <DaterDropdown
            userInfo={userInfo}
            onDaterChange={handleDaterChange}
          />
        </MatcherHeader>
      )}
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {userInfo && userInfo.role === 'user' && (matchedList.length > 0 || pendingApprovalList.length > 0) && (
          <ToggleConversationsDater
            showDaterMatches={showDaterMatches}
            setShowDaterMatches={setShowDaterMatches}
          />
        )}

        {userInfo && userInfo.role === 'matchmaker' && (filteredMatches.pending_approval.length > 0 || filteredMatches.matched.length > 0) && (
          <ToggleConversationsMatcher
            showDaterMatches={showDaterMatches}
            setShowDaterMatches={setShowDaterMatches}
          />
        )}
        
        {/* Pending Approval Section - for matchmakers */}
        {userInfo?.role === 'matchmaker' && showDaterMatches && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Pending</Text>
            <View style={styles.matchList}>
              {filteredMatches.pending_approval.length > 0 ? (
                filteredMatches.pending_approval.map((matchObj, index) => (
                  <MatchCard
                    key={`pending-${index}`}
                    matchObj={matchObj}
                    userInfo={userInfo}
                    navigation={navigation}
                    unmatch={handleUnmatch}
                    reveal={reveal}
                    hide={hide}
                  />
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No pending matches yet!</Text>
                </View>
              )}
            </View>
          </View>
        )}
        
        {/* Approved/Matched Section - for matchmakers */}
        {userInfo?.role === 'matchmaker' && !showDaterMatches && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Approved</Text>
            <View style={styles.matchList}>
              {filteredMatches.matched.length > 0 ? (
                filteredMatches.matched.map((matchObj, index) => (
                  <MatchCard
                    key={`matched-${index}`}
                    matchObj={matchObj}
                    userInfo={userInfo}
                    navigation={navigation}
                    unmatch={handleUnmatch}
                    reveal={reveal}
                    hide={hide}
                  />
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No matches yet!</Text>
                </View>
              )}
            </View>
          </View>
        )}
        
        {/* Matched Section - for daters */}
        {userInfo?.role === 'user' && (
          <View style={styles.sectionContainer}>
            <View style={styles.matchList}>
              {filteredMatches.matched.length > 0 ? (
                filteredMatches.matched.map((matchObj, index) => (
                  <MatchCard
                    key={`matched-${index}`}
                    matchObj={matchObj}
                    userInfo={userInfo}
                    navigation={navigation}
                    unmatch={handleUnmatch}
                    reveal={reveal}
                    hide={hide}
                  />
                ))
              ) : filteredMatches.pending_approval.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No matches yet!</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}
        
        {/* Pending Approval Section - for daters (in dater section) */}
        {userInfo?.role === 'user' && showDaterMatches && filteredMatches.pending_approval.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.matchList}>
              {filteredMatches.pending_approval.map((matchObj, index) => (
                <MatchCard
                  key={`pending-${index}`}
                  matchObj={matchObj}
                  userInfo={userInfo}
                  navigation={navigation}
                  unmatch={handleUnmatch}
                  reveal={reveal}
                  hide={hide}
                />
              ))}
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
  },
  content: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 16,
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
    gap: 16,
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
});

export default Conversations;
