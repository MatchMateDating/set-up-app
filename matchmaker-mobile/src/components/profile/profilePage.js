import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView, Image, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { API_BASE_URL } from '../../env';
import Profile from './profile';
import AvatarSelectorModal from './avatarSelectorModal';
import { avatarMap } from './avatarSelectorModal';
import { Ionicons } from '@expo/vector-icons';
import { EditToolbar } from './components/editToolbar';
import DaterDropdown from '../layout/daterDropdown';

import { SafeAreaView } from 'react-native-safe-area-context';

const ProfilePage = () => {
  const route = useRoute();
  const { userId, matchProfile } = route.params || {};
  const [user, setUser] = useState(null);
  const [referrer, setReferrer] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatar, setAvatar] = useState(null);
  const [profileFormData, setProfileFormData] = useState(null);
  const [profileHandleInputChange, setProfileHandleInputChange] = useState(null);
  const [hasInitializedDater, setHasInitializedDater] = useState(false);
  const navigation = useNavigation();
  const scrollViewRef = useRef(null);

  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const userIdUrl = userId ?? "";
      const res = await fetch(`${API_BASE_URL}/profile/${userIdUrl}`, {
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
      setUser(data.user);
      setReferrer(data.referrer || null);
      
      if (data.user?.role === 'matchmaker') {
        setAvatar(data.user.avatar || 'avatars/allyson_avatar.png');
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
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

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (user?.role === 'matchmaker') {
      if (user.referred_by_id) {
        fetchReferrer(user.referred_by_id);
        // Mark as initialized once we have a referred_by_id
        // This prevents auto-setting first dater when switching daters
        if (!hasInitializedDater) {
          setHasInitializedDater(true);
        }
      } else if (!hasInitializedDater && !matchProfile) {
        // Only fetch and set first dater on initial load if no referred_by_id
        // This prevents resetting when switching daters
        fetchLinkedDatersAndSetFirst();
      }
    }
  }, [user?.referred_by_id, matchProfile, hasInitializedDater]);

  const fetchLinkedDatersAndSetFirst = async () => {
    if (!user || user.role !== 'matchmaker' || user.referred_by_id) return;
    
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`${API_BASE_URL}/referral/referrals/${user.id}`, {
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
      const linkedDaters = data.linked_daters || [];
      
      if (linkedDaters.length > 0) {
        // Set the first linked dater as selected
        const firstDaterId = linkedDaters[0].id;
        
        const setRes = await fetch(`${API_BASE_URL}/referral/set_selected_dater`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ selected_dater_id: firstDaterId }),
        });

        if (setRes.ok) {
          // Refresh profile to get updated user with referred_by_id
          await fetchProfile();
        }
      }
    } catch (err) {
      console.error('Error fetching linked daters:', err);
    }
  };

  // Refresh profile when page comes into focus to get latest selected dater
  useFocusEffect(
    React.useCallback(() => {
      if (!matchProfile) {
        // Small delay to ensure backend has updated after dater selection
        const timer = setTimeout(() => {
          fetchProfile();
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [matchProfile])
  );

  const handleAvatarClick = () => {
    setShowAvatarModal(true);
  };

  const handleSave = () => {
    fetchProfile();
    setEditing(false);
    setProfileFormData(null);
    setProfileHandleInputChange(null);
  };

  const handleEditingFormData = (data) => {
    if (data) {
      setProfileFormData(data.formData);
      setProfileHandleInputChange(() => data.handleInputChange);
    } else {
      setProfileFormData(null);
      setProfileHandleInputChange(null);
    }
  };

  const handleDaterChange = async (daterId) => {
    setHasInitializedDater(true);
    await fetchProfile();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6B46C1" />
        <Text style={styles.loadingText}>Loading user profile...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Failed to load profile</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, editing && styles.containerWithToolbar]}>
      {matchProfile && !editing && (
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#6B46C1" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      )}
      
      {editing && profileFormData && profileHandleInputChange && (
        <EditToolbar
          formData={profileFormData}
          handleInputChange={profileHandleInputChange}
          editing={editing}
          extendToTop={true}
        />
      )}

      {user?.role === 'matchmaker' && !matchProfile && (
        <View style={styles.daterDropdownWrapper}>
          <DaterDropdown
            API_BASE_URL={API_BASE_URL}
            userInfo={user}
            onDaterChange={handleDaterChange}
          />
        </View>
      )}
      
      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.content}>
        {user.role === 'user' && (
          <Profile
            user={user}
            framed={matchProfile === true}
            editing={editing}
            setEditing={setEditing}
            onSave={handleSave}
            onEditingFormData={handleEditingFormData}
            parentScrollRef={scrollViewRef}
          />
        )}

        {user.role === 'matchmaker' && referrer && (
          <>
            <View style={styles.profileHeader}>
              <TouchableOpacity onPress={handleAvatarClick}>
              <Image
                source={ avatarMap[avatar] || avatarMap['avatars/allyson_avatar.png'] }
                style={styles.avatar}
              />
              </TouchableOpacity>
              <View style={styles.profileInfo}>
                <View style={styles.nameSection}>
                  <Text style={styles.name}>{user.first_name}</Text>
                </View>
              </View>
            </View>
            <View style={styles.embeddedProfile}>
              <Text style={styles.subHeader}>Dater's Profile</Text>
              <Profile user={referrer} framed={true} editing={false} />
            </View>
          </>
        )}

        {showAvatarModal && (
          <AvatarSelectorModal
            onSelect={(selectedAvatar) => {
              setAvatar(selectedAvatar);
              setShowAvatarModal(false);
            }}
            userId={user.id}
            onClose={() => setShowAvatarModal(false)}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f4fc',
  },
  containerWithToolbar: {
    paddingTop: 0,
  },
  content: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  dropdownContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 100,
    marginBottom: 16,
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
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 8,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#f0f0f0',
  },
  profileInfo: {
    flex: 1,
  },
  nameSection: {
    marginBottom: 4,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#222',
  },
  embeddedProfile: {
    marginTop: 20,
    padding: 16,
    borderWidth: 2,
    borderColor: '#ebe7fb',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  subHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B46C1',
    marginBottom: 16,
  },
  daterDropdownWrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    zIndex: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  backButtonText: {
    color: '#6B46C1',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfilePage;
