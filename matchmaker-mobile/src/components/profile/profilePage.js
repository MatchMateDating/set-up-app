import React, { useContext, useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView, Image, TouchableOpacity } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { API_BASE_URL } from '../../env';
import { subscribeToLocationUpdated } from '../auth/utils/startLocationWatcher';
import Profile from './profile';
import ProfileCard from '../matches/profileCard';
import { Ionicons } from '@expo/vector-icons';
import { EditToolbar } from './components/editToolbar';
import ImageCropModal from './components/ImageCropModal';
import {
  DATER_SCREEN_BG,
  getRoleAccentColor,
  getRoleBackgroundTint,
} from '../layout/components/RoleHeaderBanner';
import DaterDropdown from '../layout/daterDropdown';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserContext } from '../../context/UserContext';
import { shouldSuppressAuthErrors } from '../../utils/authSession';

const MATCHMAKER_SCREEN_BG = '#f3f4f6';
/** Same reserve above the profile card as on the Matches tab. */
const MATCHMAKER_CARD_STACK_PADDING_TOP = 32;
/** Dater Matches tab card stack inset (see match.js). */
const DATER_CARD_STACK_PADDING_TOP = 14;

const ProfilePage = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const { userId, matchProfile } = route.params || {};
  const { user: contextUser, setIsProfileEditing } = useContext(UserContext);
  const [user, setUser] = useState(null);
  const [referrer, setReferrer] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileFormData, setProfileFormData] = useState(null);
  const [profileHandleInputChange, setProfileHandleInputChange] = useState(null);
  const [profileEditActions, setProfileEditActions] = useState(null);
  const [hasInitializedDater, setHasInitializedDater] = useState(false);
  const navigation = useNavigation();
  const scrollViewRef = useRef(null);
  const parentScrollOffsetYRef = useRef(0);
  const profileEditActionsRef = useRef(null);
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState(null);
  const [pendingCropUris, setPendingCropUris] = useState([]);
  const cropCompleteRef = useRef(null);
  const [cropKey, setCropKey] = useState(0);
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

  const handleSave = () => {
    fetchProfile();
    setEditing(false);
    setProfileFormData(null);
    setProfileHandleInputChange(null);
    setProfileEditActions(null);
    profileEditActionsRef.current = null;
  };

  const handleEditingFormData = useCallback((data) => {
    if (data) {
      setProfileFormData((prev) => {
        if (prev === data.formData) return prev;
        if (prev && JSON.stringify(prev) === JSON.stringify(data.formData)) return prev;
        return data.formData;
      });

      setProfileHandleInputChange((prev) => {
        if (prev === data.handleInputChange) return prev;
        return data.handleInputChange;
      });

      if (profileEditActionsRef.current) {
        profileEditActionsRef.current.onSave = data.handleFormSubmit;
        profileEditActionsRef.current.onCancel = data.handleCancel;
      } else {
        const actions = {
          onSave: data.handleFormSubmit,
          onCancel: data.handleCancel,
        };
        profileEditActionsRef.current = actions;
        setProfileEditActions(actions);
      }
    } else {
      profileEditActionsRef.current = null;
      setProfileFormData(null);
      setProfileHandleInputChange(null);
      setProfileEditActions(null);
    }
  }, []);

  const handleEditBack = () => {
    if (profileEditActions?.onCancel) {
      profileEditActions.onCancel();
    } else {
      setEditing(false);
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

  if (loading) {
    const loadingRole = matchProfile && contextUser?.role === 'matchmaker'
      ? 'matchmaker'
      : (user?.role || contextUser?.role || 'matchmaker');
    const loadingColor = getRoleAccentColor(loadingRole);
    const loadingBg = loadingRole === 'matchmaker' && (matchProfile || user?.role === 'matchmaker')
      ? MATCHMAKER_SCREEN_BG
      : getRoleBackgroundTint(loadingRole);
    return (
      <View style={[styles.loadingContainer, { backgroundColor: loadingBg }]}>
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

  const viewerIsMatchmaker = contextUser?.role === 'matchmaker';
  const accentColor = getRoleAccentColor(user.role);
  const matchmakerAccentColor = getRoleAccentColor('matchmaker');
  const backgroundTint = getRoleBackgroundTint(user.role);
  const isMatchmaker = user.role === 'matchmaker';
  const isDater = user.role === 'user';
  const viewerIsDater = contextUser?.role === 'user';
  const showMatchmakerViewingDater = matchProfile && viewerIsMatchmaker && isDater && !editing;
  const showDaterViewingMatchProfile = matchProfile && viewerIsDater && isDater && !editing;
  const showMatchmakerChrome = isMatchmaker && !matchProfile && !editing;
  const showDaterChrome = isDater && !matchProfile && !editing;
  const showDaterEditChrome = isDater && !matchProfile && editing;
  const useSharedDaterDropdown = showMatchmakerChrome && route.name === 'Profile';
  const screenBackground = showMatchmakerChrome || showMatchmakerViewingDater
    ? MATCHMAKER_SCREEN_BG
    : showDaterChrome || showDaterViewingMatchProfile || (isDater && !matchProfile)
      ? DATER_SCREEN_BG
      : backgroundTint;
  const headerTopPadding = showMatchmakerChrome || showDaterChrome || showMatchmakerViewingDater
    ? insets.top + 4
    : insets.top + 8;
  const bottomInset = Math.max(insets.bottom, 8);
  const editFooterVerticalPadding = 16;
  const tabBarReplacementHeight = 56 + bottomInset + editFooterVerticalPadding * 2;
  const editKeyboardBottomOffset = 16;
  const contentTopPadding = showMatchmakerChrome || showDaterChrome || showMatchmakerViewingDater || showDaterViewingMatchProfile
    ? 0
    : editing
      ? 0
      : isMatchmaker
        ? 12
        : 56;

  const ScrollComponent = showDaterEditChrome ? KeyboardAwareScrollView : ScrollView;
  const keyboardAwareProps = showDaterEditChrome
    ? {
        bottomOffset: editKeyboardBottomOffset,
        extraKeyboardSpace: tabBarReplacementHeight,
      }
    : {};

  return (
    <View
      style={[
        styles.container,
        editing && styles.containerWithToolbar,
        { backgroundColor: screenBackground },
      ]}
    >
      {matchProfile && !editing && !showMatchmakerViewingDater && (
        <TouchableOpacity
          style={[styles.backButton, { paddingTop: insets.top + 8 }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={accentColor} />
          <Text style={[styles.backButtonText, { color: accentColor }]}>Back</Text>
        </TouchableOpacity>
      )}
      
      {showDaterEditChrome ? (
        <View style={[styles.editFixedTop, { paddingTop: headerTopPadding }]}>
          <View style={styles.editHeader}>
            <TouchableOpacity
              style={styles.editHeaderBack}
              onPress={handleEditBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={24} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.editHeaderTitle}>Edit Profile</Text>
            <View style={styles.editHeaderSide} />
          </View>
          {profileFormData && profileHandleInputChange ? (
            <EditToolbar
              formData={profileFormData}
              handleInputChange={profileHandleInputChange}
              editing={editing}
              accentColorOverride={accentColor}
              sticky
            />
          ) : null}
        </View>
      ) : null}

      {showMatchmakerViewingDater ? (
        <View
          style={[
            styles.screenHeader,
            styles.screenHeaderMatchmaker,
            { paddingTop: headerTopPadding },
          ]}
        >
          <View style={styles.headerSide}>
            <TouchableOpacity
              style={styles.headerBackButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={24} color={matchmakerAccentColor} />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerTitle}>Dater Profile</Text>
          <View style={[styles.headerSide, styles.headerSideRight]} />
        </View>
      ) : null}

      {showMatchmakerChrome ? (
        <>
          <View
            style={[
              styles.screenHeader,
              styles.screenHeaderMatchmaker,
              { paddingTop: headerTopPadding },
            ]}
          >
            <View style={styles.headerSide}>
              <Image
                source={require('../../../assets/matchmate_logo.png')}
                style={styles.headerLogo}
                accessibilityLabel="Matchmate logo"
              />
            </View>
            <Text style={styles.headerTitle}>Dater Profile</Text>
            <View style={[styles.headerSide, styles.headerSideRight]} />
          </View>
          <View style={styles.choosingSection}>
            {!useSharedDaterDropdown ? (
              <DaterDropdown
                userInfo={user}
                onDaterChange={async () => {
                  await fetchProfile();
                }}
                showLabel
              />
            ) : null}
          </View>
        </>
      ) : null}

      {showDaterChrome ? (
        <View
          style={[
            styles.screenHeader,
            styles.screenHeaderDater,
            { paddingTop: headerTopPadding },
          ]}
        >
          <View style={styles.headerSide}>
            <Image
              source={require('../../../assets/matchmate_logo.png')}
              style={styles.headerLogo}
              accessibilityLabel="Matchmate logo"
            />
          </View>
          <Text style={styles.headerTitle}>Your Profile</Text>
          <View style={[styles.headerSide, styles.headerSideRight]}>
            <TouchableOpacity
              style={styles.headerActionButton}
              onPress={() => setEditing(true)}
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
            >
              <Ionicons name="create-outline" size={22} color={accentColor} />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <ScrollComponent
        ref={scrollViewRef}
        style={[
          showMatchmakerChrome ||
            showMatchmakerViewingDater ||
            showDaterViewingMatchProfile ||
            showDaterEditChrome
            ? styles.scrollView
            : undefined,
          (isDater && !matchProfile) || showDaterViewingMatchProfile
            ? { backgroundColor: DATER_SCREEN_BG }
            : undefined,
        ]}
        contentContainerStyle={[
          styles.content,
          (showMatchmakerChrome || showMatchmakerViewingDater) && styles.contentMatchmaker,
          showDaterViewingMatchProfile && styles.contentDaterMatch,
          isDater && !matchProfile && !showDaterEditChrome && styles.contentDater,
          showDaterEditChrome && styles.contentDaterEdit,
          !showMatchmakerChrome &&
            !showMatchmakerViewingDater &&
            !showDaterViewingMatchProfile &&
            !showDaterChrome &&
            !showDaterEditChrome &&
            !(isDater && !matchProfile) && {
            paddingTop: contentTopPadding,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          parentScrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
        }}
        nestedScrollEnabled
        {...keyboardAwareProps}
      >
        {showMatchmakerViewingDater ? (
          <View
            style={[
              styles.cardStack,
              { paddingTop: MATCHMAKER_CARD_STACK_PADDING_TOP },
            ]}
          >
            <View style={styles.currentCard}>
              <ProfileCard
                profile={user}
                userInfo={contextUser}
                blendWithBackground
                hideProfileThumbnail
              />
            </View>
          </View>
        ) : null}

        {showDaterViewingMatchProfile ? (
          <View
            style={[
              styles.cardStack,
              { paddingTop: DATER_CARD_STACK_PADDING_TOP },
            ]}
          >
            <View style={styles.currentCard}>
              <ProfileCard profile={user} userInfo={contextUser} />
            </View>
          </View>
        ) : null}

        {user.role === 'user' && !showMatchmakerViewingDater && !showDaterViewingMatchProfile && (
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
            usePageLayout={showDaterChrome || (isDater && !matchProfile && editing)}
          />
        )}

        {user.role === 'matchmaker' && !matchProfile && (
          referrer ? (
            <View
              style={[
                styles.cardStack,
                { paddingTop: MATCHMAKER_CARD_STACK_PADDING_TOP },
              ]}
            >
              <View style={styles.currentCard}>
                <ProfileCard
                  profile={referrer}
                  userInfo={user}
                  blendWithBackground
                  hideProfileThumbnail
                />
              </View>
            </View>
          ) : (
            <View style={styles.noDaterCard}>
              <Text style={styles.noDaterText}>No dater selected</Text>
            </View>
          )
        )}
      </ScrollComponent>

      {showDaterEditChrome && profileEditActions ? (
        <View
          style={[
            styles.editFooter,
            {
              height: tabBarReplacementHeight,
              paddingTop: editFooterVerticalPadding,
              paddingBottom: bottomInset + editFooterVerticalPadding,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.editCancelBtn}
            onPress={profileEditActions.onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel editing"
          >
            <Text style={styles.editCancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.editSaveBtn, { backgroundColor: accentColor }]}
            onPress={profileEditActions.onSave}
            accessibilityRole="button"
            accessibilityLabel="Save profile"
          >
            <Text style={styles.editSaveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      ) : null}

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
    paddingBottom: 120,
  },
  contentDater: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  contentDaterMatch: {
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  contentDaterEdit: {
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  editFixedTop: {
    backgroundColor: DATER_SCREEN_BG,
    zIndex: 10,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  editHeaderBack: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  editHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  editHeaderSide: {
    width: 44,
  },
  editFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    backgroundColor: DATER_SCREEN_BG,
  },
  editCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editCancelBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  editSaveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editSaveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
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
    paddingBottom: 0,
  },
  screenHeaderDater: {
    backgroundColor: 'transparent',
  },
  headerSide: {
    width: 44,
    alignItems: 'flex-start',
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerLogo: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
  },
  headerBackButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
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
    minHeight: 71,
  },
  scrollView: {
    flex: 1,
  },
  cardStack: {
    position: 'relative',
  },
  currentCard: {
    position: 'relative',
    zIndex: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  noDaterCard: {
    marginTop: 24,
    padding: 24,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  noDaterText: {
    fontSize: 16,
    color: '#6b7280',
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
