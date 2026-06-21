import React, { useContext, useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView, Image, TouchableOpacity, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { API_BASE_URL } from '../../env';
import { subscribeToLocationUpdated } from '../auth/utils/startLocationWatcher';
import Profile from './profile';
import AvatarSelectorModal from './avatarSelectorModal';
import { avatarMap } from './avatarSelectorModal';
import { Ionicons } from '@expo/vector-icons';
import { EditToolbar } from './components/editToolbar';
import ImageCropModal from './components/ImageCropModal';
import { getRoleAccentColor, getRoleBackgroundTint } from '../layout/components/RoleHeaderBanner';
import DaterDropdown from '../layout/daterDropdown';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserContext } from '../../context/UserContext';
import { shouldSuppressAuthErrors } from '../../utils/authSession';

const MATCHMAKER_SCREEN_BG = '#f3f4f6';

const ProfilePage = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const { userId, matchProfile } = route.params || {};
  const { user: contextUser, setUser: setContextUser, setIsProfileEditing } = useContext(UserContext);
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
  const parentScrollOffsetYRef = useRef(0);
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState(null);
  const [pendingCropUris, setPendingCropUris] = useState([]);
  const cropCompleteRef = useRef(null);
  const [cropKey, setCropKey] = useState(0);
  const [matchmakerForm, setMatchmakerForm] = useState({ first_name: '', last_name: '' });
  const [matchmakerFieldErrors, setMatchmakerFieldErrors] = useState({
    first_name: '',
    last_name: '',
  });
  const [savingMatchmakerProfile, setSavingMatchmakerProfile] = useState(false);
  const selectedDaterId = user?.referrer_id || user?.referred_by_id || null;
  const linkedDatersSignature = JSON.stringify(user?.linked_daters || []);

  const handleRequestCrop = useCallback((uris, onComplete) => {
    const list = Array.isArray(uris) ? uris : [uris];
    if (!list.length) return;
    setPendingCropUris(list);
    setSelectedImageUri(list[0]);
    setCropModalVisible(true);
    setCropKey((prev) => prev + 1);
    cropCompleteRef.current = onComplete;
  }, []);

  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
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
      setUser(data.user);
      setReferrer(data.referrer || null);
      
      if (data.user?.role === 'matchmaker') {
        setAvatar(data.user.avatar || 'avatars/allyson_avatar.png');
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      if (await shouldSuppressAuthErrors()) return;
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
    if (matchProfile || !contextUser) {
      return;
    }

    setUser((prevUser) => {
      if (!prevUser) {
        return contextUser;
      }

      const sameUser = prevUser.id === contextUser.id;
      const sameSelectedDater =
        prevUser.referrer_id === contextUser.referrer_id &&
        prevUser.referred_by_id === contextUser.referred_by_id;
      const sameLinkedDaters =
        JSON.stringify(prevUser.linked_daters || []) === JSON.stringify(contextUser.linked_daters || []);

      if (sameUser && sameSelectedDater && sameLinkedDaters) {
        return prevUser;
      }

      return { ...prevUser, ...contextUser };
    });
  }, [contextUser, matchProfile]);

  useEffect(() => {
    const unsub = subscribeToLocationUpdated(() => {
      if (!matchProfile) fetchProfile();
    });
    return unsub;
  }, [matchProfile]);

  useEffect(() => {
    if (user?.role === 'matchmaker') {
      if (selectedDaterId) {
        fetchReferrer(selectedDaterId);
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
  }, [user?.id, user?.role, selectedDaterId, linkedDatersSignature, matchProfile, hasInitializedDater]);

  const fetchLinkedDatersAndSetFirst = async () => {
    if (!user || user.role !== 'matchmaker' || selectedDaterId) return;
    
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
          setHasInitializedDater(true);
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
        // Refresh in place to avoid a UI flash/glitch when swiping tabs.
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

  useEffect(() => {
    if (user?.role === 'matchmaker') {
      setMatchmakerForm({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
      });
    }
  }, [user?.role, user?.first_name, user?.last_name]);

  const handleMatchmakerCancel = () => {
    setMatchmakerFieldErrors({ first_name: '', last_name: '' });
    setMatchmakerForm({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
    });
    setEditing(false);
  };

  const handleMatchmakerSave = async () => {
    const nextErrors = {
      first_name: !matchmakerForm.first_name?.trim() ? 'First name is required.' : '',
      last_name: !matchmakerForm.last_name?.trim() ? 'Last name is required.' : '',
    };
    setMatchmakerFieldErrors(nextErrors);
    if (nextErrors.first_name || nextErrors.last_name) {
      return;
    }

    setSavingMatchmakerProfile(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/profile/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          first_name: matchmakerForm.first_name.trim(),
          last_name: matchmakerForm.last_name.trim(),
        }),
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
        const data = await res.json().catch(() => ({}));
        Alert.alert('Error', data.error || 'Failed to update profile');
        return;
      }

      const updatedUser = await res.json();
      setUser((prev) => ({ ...prev, ...updatedUser }));
      setContextUser((prev) => ({ ...prev, ...updatedUser }));
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setEditing(false);
      setMatchmakerFieldErrors({ first_name: '', last_name: '' });
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSavingMatchmakerProfile(false);
    }
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

  useEffect(() => {
    if (!matchProfile) {
      setIsProfileEditing(Boolean(editing));
    }
  }, [editing, matchProfile, setIsProfileEditing]);

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        setIsProfileEditing(false);
      };
    }, [setIsProfileEditing])
  );

  const handleDaterChange = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`${API_BASE_URL}/profile/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const data = await res.json();
      if (data?.user) {
        setUser(data.user);
        setContextUser(data.user);
      }
      if (data?.referrer) {
        setReferrer(data.referrer);
      }
    } catch (err) {
      console.error('Error refreshing user after dater change:', err);
    }
  };

  if (loading) {
    const loadingColor = getRoleAccentColor(user?.role || 'matchmaker');
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={loadingColor} />
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

  const accentColor = getRoleAccentColor(user.role);
  const backgroundTint = getRoleBackgroundTint(user.role);
  const isMatchmaker = user.role === 'matchmaker';
  const showMatchmakerChrome = isMatchmaker && !matchProfile && !editing;
  const screenBackground = showMatchmakerChrome ? MATCHMAKER_SCREEN_BG : backgroundTint;
  const headerTopPadding = showMatchmakerChrome ? insets.top + 4 : insets.top + 8;
  const contentTopPadding = showMatchmakerChrome
    ? 0
    : editing
      ? 0
      : isMatchmaker
        ? 12
        : 56;

  return (
    <View
      style={[
        styles.container,
        editing && styles.containerWithToolbar,
        { backgroundColor: screenBackground },
      ]}
    >
      {matchProfile && !editing && (
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={accentColor} />
          <Text style={[styles.backButtonText, { color: accentColor }]}>Back</Text>
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

      {showMatchmakerChrome ? (
        <>
          <View
            style={[
              styles.screenHeader,
              styles.screenHeaderMatchmaker,
              { paddingTop: headerTopPadding },
            ]}
          >
            <Image
              source={require('../../../assets/matchmate_logo.png')}
              style={styles.headerLogo}
              accessibilityLabel="Matchmate logo"
            />
            <TouchableOpacity
              style={styles.headerActionButton}
              onPress={() => setEditing(true)}
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
            >
              <Ionicons name="create-outline" size={22} color="#374151" />
            </TouchableOpacity>
          </View>
          <View style={styles.choosingSection}>
            <DaterDropdown
              userInfo={user}
              onDaterChange={handleDaterChange}
              showLabel
            />
          </View>
        </>
      ) : null}

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.content,
          showMatchmakerChrome && styles.contentMatchmaker,
          !showMatchmakerChrome && { paddingTop: contentTopPadding },
        ]}
        scrollEventThrottle={16}
        onScroll={(event) => {
          parentScrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
        }}
        nestedScrollEnabled
      >
        {user.role === 'user' && (
          <Profile
            user={user}
            framed={matchProfile === true}
            editing={editing}
            setEditing={setEditing}
            onSave={handleSave}
            onEditingFormData={handleEditingFormData}
            parentScrollRef={scrollViewRef}
            parentScrollOffsetYRef={parentScrollOffsetYRef}
            onRequestCrop={handleRequestCrop}
          />
        )}

        {user.role === 'matchmaker' && !matchProfile && (
          <>
            <View style={styles.profileHeader}>
              <TouchableOpacity onPress={handleAvatarClick} disabled={editing}>
                <Image
                  source={avatarMap[avatar] || avatarMap['avatars/allyson_avatar.png']}
                  style={styles.avatar}
                />
              </TouchableOpacity>
              <View style={styles.profileInfo}>
                {!editing && (
                  <View style={styles.nameSection}>
                    <Text style={styles.name}>{user.first_name || 'Matchmaker'}</Text>
                  </View>
                )}
              </View>
            </View>

            {editing && (
              <View style={styles.matchmakerEditCard}>
                <Text style={styles.label}>First Name</Text>
                <TextInput
                  style={styles.input}
                  value={matchmakerForm.first_name}
                  onChangeText={(value) => {
                    setMatchmakerForm((prev) => ({ ...prev, first_name: value }));
                    if (value.trim()) {
                      setMatchmakerFieldErrors((prev) => ({ ...prev, first_name: '' }));
                    }
                  }}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
                {Boolean(matchmakerFieldErrors.first_name) && (
                  <Text style={styles.validationError}>{matchmakerFieldErrors.first_name}</Text>
                )}

                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  value={matchmakerForm.last_name}
                  onChangeText={(value) => {
                    setMatchmakerForm((prev) => ({ ...prev, last_name: value }));
                    if (value.trim()) {
                      setMatchmakerFieldErrors((prev) => ({ ...prev, last_name: '' }));
                    }
                  }}
                  autoCapitalize="words"
                  returnKeyType="done"
                />
                {Boolean(matchmakerFieldErrors.last_name) && (
                  <Text style={styles.validationError}>{matchmakerFieldErrors.last_name}</Text>
                )}

                <View style={styles.matchmakerActions}>
                  {savingMatchmakerProfile ? (
                    <ActivityIndicator size="small" color={accentColor} />
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[styles.saveBtn, { backgroundColor: accentColor }]}
                        onPress={handleMatchmakerSave}
                      >
                        <Text style={styles.saveBtnText}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.cancelBtn, { borderColor: accentColor }]}
                        onPress={handleMatchmakerCancel}
                      >
                        <Text style={[styles.cancelBtnText, { color: accentColor }]}>Cancel</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            )}

            {referrer && (
              <View style={styles.embeddedProfile}>
                <Text style={[styles.subHeader, { color: accentColor }]}>Dater's Profile</Text>
                <Profile user={referrer} framed={true} editing={false} />
              </View>
            )}
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

      <ImageCropModal
        key={cropKey}
        visible={cropModalVisible}
        imageUri={selectedImageUri}
        onCropComplete={(croppedImage) => {
          if (cropCompleteRef.current) {
            cropCompleteRef.current(croppedImage);
          }
          setPendingCropUris((prev) => {
            const next = prev.slice(1);
            if (next.length === 0) {
              setCropModalVisible(false);
              setSelectedImageUri(null);
              cropCompleteRef.current = null;
              return [];
            }
            setSelectedImageUri(next[0]);
            setCropKey((k) => k + 1);
            return next;
          });
        }}
        onCancel={() => {
          setCropModalVisible(false);
          setSelectedImageUri(null);
          setPendingCropUris([]);
          cropCompleteRef.current = null;
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  containerWithToolbar: {
    paddingTop: 0,
  },
  content: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  contentMatchmaker: {
    paddingTop: 0,
    paddingHorizontal: 20,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  screenHeaderMatchmaker: {
    backgroundColor: 'transparent',
  },
  headerLogo: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
  },
  headerActionButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  choosingSection: {
    paddingHorizontal: 20,
    paddingBottom: 4,
    zIndex: 10,
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
  matchmakerEditCard: {
    marginTop: 8,
    marginBottom: 8,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ebe7fb',
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
    marginTop: 12,
    color: '#111',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  validationError: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 4,
  },
  matchmakerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
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
    color: '#6c5ce7',
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  backButtonText: {
    color: '#6c5ce7',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfilePage;
