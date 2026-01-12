import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../env';
import SendNoteModal from './sendNoteModal';
import ProfileCard from './profileCard';
import { useProfiles } from './hooks/useProfiles';
import { useUserInfo } from './hooks/useUserInfo';
import DaterDropdown from '../layout/daterDropdown';
import MatcherHeader from '../layout/components/matcherHeader';

const Match = () => {
  const { profiles, setProfiles, loading } = useProfiles(API_BASE_URL);
  const { userInfo, setUserInfo } = useUserInfo(API_BASE_URL);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [referrer, setReferrer] = useState(null);
  const navigation = useNavigation();

  const refreshUserInfo = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

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

      if (!res.ok) return;

      const data = await res.json();
      setUserInfo(data.user);
    } catch (err) {
      console.error('Error refreshing user info:', err);
    }
  };

  const handleDaterChange = async (daterId) => {
    // Refresh userInfo to get updated referred_by_id, then refresh profiles
    await refreshUserInfo();
    setCurrentIndex(0);
    fetchProfiles();
  };

  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

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

      if (!res.ok) return;

      const data = await res.json();
      setReferrer(data.referrer || null);
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const fetchReferrer = async (daterId) => {
    if (!daterId) return;
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`${API_BASE_URL}/profile/${daterId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setReferrer(data.user);
    } catch (err) {
      console.error('Error fetching referrer:', err);
    }
  };

  const fetchProfiles = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`${API_BASE_URL}/match/users_to_match`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch profiles');
      const data = await res.json();
      setProfiles(data);
    } catch (err) {
      console.error('Error fetching profiles:', err);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Refresh profiles when userInfo.referrer_id changes (selected dater changed)
  useEffect(() => {
    if (userInfo && userInfo.role === 'matchmaker') {
      fetchProfiles();
      setCurrentIndex(0); // Reset to first profile
    }
  }, [userInfo?.referrer_id]);

  // Refresh userInfo and profiles when page comes into focus to get latest selected dater
  useFocusEffect(
    React.useCallback(() => {
      setCurrentIndex(0);
      
      // Small delay to ensure backend has updated after dater selection
      const timer = setTimeout(async () => {
        await refreshUserInfo();
        // Refresh profiles after userInfo is updated
        fetchProfiles();
      }, 100);
      return () => clearTimeout(timer);
    }, [])
  );

  const skipUser = async (skippedUserId) => {
    // Immediately remove the skipped user from local state (optimistic update)
    setProfiles(prevProfiles => {
      const filtered = prevProfiles.filter(profile => profile.id !== skippedUserId);
      
      // Adjust index: if we removed the current item, stay at current index (which is now the next item)
      setCurrentIndex(prevIndex => {
        const removedIndex = prevProfiles.findIndex(p => p.id === skippedUserId);
        if (removedIndex < prevIndex) {
          // Removed item was before current, decrement index
          return Math.max(0, prevIndex - 1);
        } else if (removedIndex === prevIndex) {
          // Removed current item, stay at same index (next item moves into current position)
          return Math.min(prevIndex, filtered.length - 1);
        }
        // Removed item was after current, no change needed
        return prevIndex;
      });
      
      return filtered;
    });

    // Call the skip API in the background (fire and forget)
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        return; // Already updated UI, no need to show error
      }

      const res = await fetch(`${API_BASE_URL}/match/skip/${skippedUserId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
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

      // Don't refresh profiles - skipped user should stay hidden until page is reloaded
    } catch (err) {
      console.error('Error skipping user:', err);
      // Error is logged but UI already updated, so user experience is not affected
    }
  };

  const nextProfile = () => {
    if (profiles.length > 0 && currentIndex < profiles.length) {
      const currentProfile = profiles[currentIndex];
      
      // Skip the current profile (removes from local state immediately, calls API in background)
      skipUser(currentProfile.id);
      
      // skipUser handles the state update and index adjustment
      // The skipped user will stay hidden until the user leaves and returns to the page
    } else {
      Alert.alert('No more profiles', 'No more profiles to show!');
    }
  };

  const likeUser = async (likedUserId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/match/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ liked_user_id: likedUserId })
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
        // Remove the liked user from local state immediately
        setProfiles(prevProfiles => {
          const filtered = prevProfiles.filter(profile => profile.id !== likedUserId);
          
          // Adjust index: if we removed the current item, stay at current index (which is now the next item)
          setCurrentIndex(prevIndex => {
            const removedIndex = prevProfiles.findIndex(p => p.id === likedUserId);
            if (removedIndex < prevIndex) {
              // Removed item was before current, decrement index
              return Math.max(0, prevIndex - 1);
            } else if (removedIndex === prevIndex) {
              // Removed current item, stay at same index (next item moves into current position)
              return Math.min(prevIndex, filtered.length - 1);
            }
            // Removed item was after current, no change needed
            return prevIndex;
          });
          
          return filtered;
        });
      }
    } catch (err) {
      console.error('Error liking user:', err);
    }
  };

  const blindMatch = async (likedUserId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/match/blind_match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ liked_user_id: likedUserId })
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
        // Remove the matched user from local state immediately
        setProfiles(prevProfiles => {
          const filtered = prevProfiles.filter(profile => profile.id !== likedUserId);
          
          // Adjust index: if we removed the current item, stay at current index (which is now the next item)
          setCurrentIndex(prevIndex => {
            const removedIndex = prevProfiles.findIndex(p => p.id === likedUserId);
            if (removedIndex < prevIndex) {
              // Removed item was before current, decrement index
              return Math.max(0, prevIndex - 1);
            } else if (removedIndex === prevIndex) {
              // Removed current item, stay at same index (next item moves into current position)
              return Math.min(prevIndex, filtered.length - 1);
            }
            // Removed item was after current, no change needed
            return prevIndex;
          });
          
          return filtered;
        });
      }
    } catch (err) {
      console.error('Error blind matching:', err);
    }
  };

  const handleLike = () => {
    if (profiles.length > 0 && currentIndex < profiles.length) {
      const likedUser = profiles[currentIndex];
      likeUser(likedUser.id);
      // likeUser now handles profile removal and index adjustment, no need to call nextProfile
    }
  };

  const handleBlindMatch = () => {
    if (profiles.length > 0 && currentIndex < profiles.length) {
      const likedUser = profiles[currentIndex];
      blindMatch(likedUser.id);
    }
  };

  const blockUser = async (blockedUserId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      Alert.alert(
        'Block User',
        'Are you sure you want to block this user? You will never see each other again.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              try {
                const res = await fetch(`${API_BASE_URL}/match/block/${blockedUserId}`, {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${token}`
                  }
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
                  // Remove the blocked user from local state immediately
                  setProfiles(prevProfiles => {
                    const filtered = prevProfiles.filter(profile => profile.id !== blockedUserId);
                    
                    // Adjust index: if we removed the current item, stay at current index (which is now the next item)
                    setCurrentIndex(prevIndex => {
                      const removedIndex = prevProfiles.findIndex(p => p.id === blockedUserId);
                      if (removedIndex < prevIndex) {
                        return Math.max(0, prevIndex - 1);
                      } else if (removedIndex === prevIndex) {
                        return Math.min(prevIndex, filtered.length - 1);
                      }
                      return prevIndex;
                    });
                    
                    return filtered;
                  });
                  
                  Alert.alert('Success', 'User blocked successfully');
                } else {
                  const data = await res.json();
                  Alert.alert('Error', data.message || 'Failed to block user');
                }
              } catch (err) {
                console.error('Error blocking user:', err);
                Alert.alert('Error', 'Failed to block user');
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

  const handleSendNote = async (note) => {
    try {
      const likedUser = profiles[currentIndex];
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      await fetch(`${API_BASE_URL}/match/send_note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ recipient_id: likedUser.id, note })
      });

      setShowNoteModal(false);
      // Remove the user from profiles after sending note (note creates a pending match)
      setProfiles(prevProfiles => {
        const filtered = prevProfiles.filter(profile => profile.id !== likedUser.id);
        
        // Adjust index: if we removed the current item, stay at current index (which is now the next item)
        setCurrentIndex(prevIndex => {
          const removedIndex = prevProfiles.findIndex(p => p.id === likedUser.id);
          if (removedIndex < prevIndex) {
            // Removed item was before current, decrement index
            return Math.max(0, prevIndex - 1);
          } else if (removedIndex === prevIndex) {
            // Removed current item, stay at same index (next item moves into current position)
            return Math.min(prevIndex, filtered.length - 1);
          }
          // Removed item was after current, no change needed
          return prevIndex;
        });
        
        return filtered;
      });
    } catch (err) {
      console.error('Error sending note:', err);
      Alert.alert('Error', 'Failed to send note');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6B46C1" />
        <Text style={styles.loadingText}>Loading profiles...</Text>
      </View>
    );
  }

  const currentProfile = profiles.length > 0 && currentIndex < profiles.length ? profiles[currentIndex] : null;

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
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.content, userInfo?.role === 'matchmaker' && styles.contentWithDropdown]}>
        {currentProfile ? (
          <>
            <ProfileCard
              profile={currentProfile}
              userInfo={userInfo}
              onSkip={nextProfile}
            />
            {showNoteModal && (
              <SendNoteModal
                onClose={() => setShowNoteModal(false)}
                onSend={handleSendNote}
              />
            )}
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No profiles to match with currently, come back later!</Text>
          </View>
        )}
      </ScrollView>
      {currentProfile && (
        <View style={styles.buttonContainer}>
          <View style={styles.leftButtonContainer}>
            {userInfo?.role === 'user' && (
              <TouchableOpacity style={styles.smallButton} onPress={() => blockUser(currentProfile.id)}>
                <Ionicons name="ban-outline" size={24} color="#e53e3e" />
              </TouchableOpacity>
            )}
            {userInfo?.role === 'matchmaker' && !currentProfile.liked_linked_dater && (
              <TouchableOpacity style={styles.smallButton} onPress={handleBlindMatch}>
                <Ionicons name="person" size={24} color="#6B46C1" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.centerButtonContainer}>
            {userInfo?.role === 'matchmaker' && currentProfile.liked_linked_dater ? (
              <TouchableOpacity style={styles.likeButton} onPress={handleBlindMatch}>
                <Ionicons name="heart" size={40} color="#e53e3e" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.likeButton} onPress={handleLike}>
                <Ionicons name="heart" size={40} color="#e53e3e" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.rightButtonContainer}>
            <TouchableOpacity style={styles.smallButton} onPress={() => setShowNoteModal(true)}>
              <Ionicons name="create-outline" size={24} color="#6B46C1" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f4fc',
  },
  dropdownContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 100,
  },
  scrollView: {
    flex: 1,
    paddingTop: 50,
  },
  content: {
    padding: 20,
    paddingBottom: 100, // Space for buttons at bottom
  },
  contentWithDropdown: {
    paddingTop: 8, // Extra space for dropdown
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
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 80, // Position above bottom tabs (typical tab height ~60-80px)
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'transparent',
  },
  leftButtonContainer: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  centerButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightButtonContainer: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  smallButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f6f4fc',
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
  },
  likeButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 72,
  },
});

export default Match;
