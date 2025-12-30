import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView, Image, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { API_BASE_URL } from '../../env';
import Profile from './profile';
import AvatarSelectorModal from './avatarSelectorModal';
import { avatarMap } from './avatarSelectorModal';
import { Ionicons } from '@expo/vector-icons';
import { EditToolbar } from './components/editToolbar';

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
  const navigation = useNavigation();

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
    if (user?.role === 'matchmaker' && user.referred_by_id) {
      fetchReferrer(user.referred_by_id);
    }
  }, [user]);

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
    <View style={[styles.container, editing && styles.containerWithToolbar]}>
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
      
      <ScrollView contentContainerStyle={styles.content}>
        {user.role === 'user' && (
          <Profile
            user={user}
            framed={matchProfile === true}
            editing={editing}
            setEditing={setEditing}
            onSave={handleSave}
            onEditingFormData={handleEditingFormData}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f4fc',
    paddingTop: 50
  },
  containerWithToolbar: {
    paddingTop: 0,
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
