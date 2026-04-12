import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Modal,
  Image,
  Dimensions,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import { API_BASE_URL } from '../../env';
import SendNoteModal from './sendNoteModal';
import ProfileCard from './profileCard';
import { useProfiles } from './hooks/useProfiles';
import { useUserInfo } from './hooks/useUserInfo';
import { startLocationWatcher, stopLocationWatcher } from '../auth/utils/startLocationWatcher';
import { getImageUrl, heightStringToCm, convertHeightForViewer } from '../profile/utils/profileUtils';
import { getRoleAccentColor, getRoleBackgroundTint } from '../layout/components/RoleHeaderBanner';
import { UserContext } from '../../context/UserContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DEFAULT_HEIGHT_MIN_CM = 137;
const DEFAULT_HEIGHT_MAX_CM = 213;

const INITIAL_MATCH_FILTERS = {
  heightMinCm: DEFAULT_HEIGHT_MIN_CM,
  heightMaxCm: DEFAULT_HEIGHT_MAX_CM,
  requireBio: false,
  internalMatchmakingOnly: false,
  /** Off until the user moves the height slider — avoids treating clamped "full deck" range as an active filter. */
  heightFilterEnabled: false,
};

const formatCmAsHeightLabel = (cm, viewerUnit) => {
  const m = Math.floor(cm / 100);
  const centimeters = Math.round(cm - m * 100);
  return convertHeightForViewer(`${m}m ${centimeters}cm`, 'metric', viewerUnit);
};

const Match = () => {
  const insets = useSafeAreaInsets();
  const { profiles, setProfiles, loading } = useProfiles(API_BASE_URL);
  const { userInfo, setUserInfo } = useUserInfo(API_BASE_URL);
  const { user: contextUser } = useContext(UserContext);
  const [refreshing, setRefreshing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchModalData, setMatchModalData] = useState(null);
  const [referrer, setReferrer] = useState(null);
  const [roleHint, setRoleHint] = useState(null);
  const [showFilterSidebar, setShowFilterSidebar] = useState(false);
  const [matchFilters, setMatchFilters] = useState(() => ({ ...INITIAL_MATCH_FILTERS }));
  const [filterDraft, setFilterDraft] = useState(() => ({ ...INITIAL_MATCH_FILTERS }));
  const navigation = useNavigation();
  const selectedDaterId = userInfo?.referrer_id || userInfo?.referred_by_id || null;

  const sliderWidth = Math.min(Dimensions.get('window').width - 56, 300);

  const linkedDaterIdSet = useMemo(() => {
    const ids = userInfo?.linked_daters;
    if (!Array.isArray(ids)) return new Set();
    return new Set(ids.map((id) => Number(id)));
  }, [userInfo?.linked_daters]);

  const showInternalMatchmakingFilter =
    userInfo?.role === 'matchmaker' && linkedDaterIdSet.size >= 2;

  const heightBoundsCm = useMemo(() => {
    const cms = profiles
      .map((p) => heightStringToCm(p.height, p.unit))
      .filter((c) => c != null && !Number.isNaN(c));
    if (cms.length === 0) {
      return { minCm: DEFAULT_HEIGHT_MIN_CM, maxCm: DEFAULT_HEIGHT_MAX_CM };
    }
    const rawMin = Math.min(...cms);
    const rawMax = Math.max(...cms);
    let minCm = Math.floor(rawMin);
    let maxCm = Math.ceil(rawMax);
    if (maxCm <= minCm) {
      maxCm = minCm + 1;
    }
    return { minCm, maxCm };
  }, [profiles]);

  useEffect(() => {
    const { minCm, maxCm } = heightBoundsCm;
    const clampPair = (lo, hi) => {
      let a = Math.min(Math.max(lo, minCm), maxCm);
      let b = Math.min(Math.max(hi, minCm), maxCm);
      if (a > b) {
        return [minCm, maxCm];
      }
      return [a, b];
    };
    setMatchFilters((prev) => {
      const [a, b] = clampPair(prev.heightMinCm, prev.heightMaxCm);
      if (a === prev.heightMinCm && b === prev.heightMaxCm) return prev;
      return { ...prev, heightMinCm: a, heightMaxCm: b };
    });
    setFilterDraft((prev) => {
      const [a, b] = clampPair(prev.heightMinCm, prev.heightMaxCm);
      if (a === prev.heightMinCm && b === prev.heightMaxCm) return prev;
      return { ...prev, heightMinCm: a, heightMaxCm: b };
    });
  }, [heightBoundsCm.minCm, heightBoundsCm.maxCm]);

  const isHeightFilterActive =
    matchFilters.heightFilterEnabled &&
    (matchFilters.heightMinCm > heightBoundsCm.minCm ||
      matchFilters.heightMaxCm < heightBoundsCm.maxCm);

  const internalMatchmakingFilterActive =
    matchFilters.internalMatchmakingOnly &&
    userInfo?.role === 'matchmaker' &&
    linkedDaterIdSet.size >= 2;

  const activeFilterCount =
    (isHeightFilterActive ? 1 : 0) +
    (matchFilters.requireBio ? 1 : 0) +
    (internalMatchmakingFilterActive ? 1 : 0);

  const filterProfilesList = useCallback(
    (list) => {
      const hActive =
        matchFilters.heightFilterEnabled &&
        (matchFilters.heightMinCm > heightBoundsCm.minCm ||
          matchFilters.heightMaxCm < heightBoundsCm.maxCm);
      const internalActive =
        matchFilters.internalMatchmakingOnly &&
        userInfo?.role === 'matchmaker' &&
        linkedDaterIdSet.size >= 2;

      return list.filter((p) => {
        if (hActive) {
          const cm = heightStringToCm(p.height, p.unit);
          if (cm == null || Number.isNaN(cm)) return false;
          if (cm < matchFilters.heightMinCm || cm > matchFilters.heightMaxCm) return false;
        }
        if (matchFilters.requireBio) {
          if (!p.bio || !String(p.bio).trim()) return false;
        }
        if (internalActive && !linkedDaterIdSet.has(Number(p.id))) {
          return false;
        }
        return true;
      });
    },
    [
      matchFilters,
      heightBoundsCm.minCm,
      heightBoundsCm.maxCm,
      userInfo?.role,
      linkedDaterIdSet,
    ]
  );

  const adjustCurrentIndexAfterRemoval = useCallback(
    (prevProfiles, removedUserId, prevIndex, nextProfiles) => {
      const beforeFiltered = filterProfilesList(prevProfiles);
      const removedFilteredIdx = beforeFiltered.findIndex((p) => p.id === removedUserId);
      const afterFiltered = filterProfilesList(nextProfiles);
      const nextLen = afterFiltered.length;
      if (nextLen === 0) return 0;
      if (removedFilteredIdx === -1) {
        return Math.min(prevIndex, nextLen - 1);
      }
      if (removedFilteredIdx < prevIndex) {
        return Math.max(0, prevIndex - 1);
      }
      if (removedFilteredIdx === prevIndex) {
        return Math.min(prevIndex, nextLen - 1);
      }
      return Math.min(prevIndex, nextLen - 1);
    },
    [filterProfilesList]
  );

  const filteredProfiles = useMemo(
    () => filterProfilesList(profiles),
    [profiles, filterProfilesList]
  );

  useEffect(() => {
    setCurrentIndex((i) => {
      if (filteredProfiles.length === 0) return 0;
      return Math.min(i, filteredProfiles.length - 1);
    });
  }, [filteredProfiles.length]);

  useEffect(() => {
    const loadRoleHint = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (!storedUser) return;
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser?.role) {
          setRoleHint(parsedUser.role);
        }
      } catch (err) {
        console.error('Error loading role hint:', err);
      }
    };
    loadRoleHint();
  }, []);

  useEffect(() => {
    if (userInfo?.role) {
      setRoleHint(userInfo.role);
    }
  }, [userInfo?.role]);

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

  // Start location watcher when Match screen is shown (for nearby matching)
  useEffect(() => {
    let mounted = true;
    const initLocation = async () => {
      const token = await AsyncStorage.getItem('token');
      if (token && mounted) {
        startLocationWatcher(API_BASE_URL, token);
      }
    };
    initLocation();
    return () => {
      mounted = false;
      stopLocationWatcher();
    };
  }, [API_BASE_URL]);

  // Refresh profiles when userInfo.referrer_id changes (selected dater changed)
  useEffect(() => {
    if (userInfo && userInfo.role === 'matchmaker') {
      fetchProfiles();
      setCurrentIndex(0); // Reset to first profile
    }
  }, [selectedDaterId]);

  // Refresh userInfo and profiles when page comes into focus to get latest selected dater
  useFocusEffect(
    React.useCallback(() => {
      // Prevent stale account data flash while switching roles/daters.
      setRefreshing(true);
      setCurrentIndex(0);
      setProfiles([]);
      setReferrer(null);
      setUserInfo(null);
      // Reset filters so height range matches fresh profile bounds (avoids stale "active" height filter).
      setMatchFilters({ ...INITIAL_MATCH_FILTERS });
      setFilterDraft({ ...INITIAL_MATCH_FILTERS });

      // Small delay to ensure backend has updated after dater selection
      const timer = setTimeout(async () => {
        try {
          await refreshUserInfo();
          await fetchProfile();
          // Refresh profiles after userInfo is updated
          await fetchProfiles();
        } finally {
          setRefreshing(false);
        }
      }, 100);
      return () => clearTimeout(timer);
    }, [])
  );

  const skipUser = async (skippedUserId) => {
    // Immediately remove the skipped user from local state (optimistic update)
    setProfiles((prevProfiles) => {
      const nextProfiles = prevProfiles.filter((profile) => profile.id !== skippedUserId);
      setCurrentIndex((prevIndex) =>
        adjustCurrentIndexAfterRemoval(prevProfiles, skippedUserId, prevIndex, nextProfiles)
      );
      return nextProfiles;
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
    if (filteredProfiles.length > 0 && currentIndex < filteredProfiles.length) {
      const currentProfile = filteredProfiles[currentIndex];
      
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
        const data = await res.json();
        const likedProfile = profiles.find(p => p.id === likedUserId);

        // Remove the liked user from local state immediately
        setProfiles((prevProfiles) => {
          const nextProfiles = prevProfiles.filter((profile) => profile.id !== likedUserId);
          setCurrentIndex((prevIndex) =>
            adjustCurrentIndexAfterRemoval(prevProfiles, likedUserId, prevIndex, nextProfiles)
          );
          return nextProfiles;
        });

        if (data.match?.status === 'matched' || data.match?.status === 'pending_approval') {
          const firstImage = likedProfile?.images?.[0]?.image_url || null;
          setMatchModalData({
            matchId: data.match.id,
            firstName: likedProfile?.first_name || 'someone',
            imageUrl: firstImage ? getImageUrl(firstImage, API_BASE_URL) : null,
            isPendingApproval: data.match.status === 'pending_approval',
          });
          setShowMatchModal(true);
        }
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
        const data = await res.json();
        const likedProfile = profiles.find(p => p.id === likedUserId);

        // Remove the matched user from local state immediately
        setProfiles((prevProfiles) => {
          const nextProfiles = prevProfiles.filter((profile) => profile.id !== likedUserId);
          setCurrentIndex((prevIndex) =>
            adjustCurrentIndexAfterRemoval(prevProfiles, likedUserId, prevIndex, nextProfiles)
          );
          return nextProfiles;
        });

        if (data.match?.status === 'pending_approval') {
          const firstImage = likedProfile?.images?.[0]?.image_url || null;
          setMatchModalData({
            matchId: data.match.id,
            firstName: likedProfile?.first_name || 'someone',
            imageUrl: firstImage ? getImageUrl(firstImage, API_BASE_URL) : null,
            isPendingApproval: true,
          });
          setShowMatchModal(true);
        }
      }
    } catch (err) {
      console.error('Error blind matching:', err);
    }
  };

  const handleLike = () => {
    if (filteredProfiles.length > 0 && currentIndex < filteredProfiles.length) {
      const likedUser = filteredProfiles[currentIndex];
      likeUser(likedUser.id);
      // likeUser now handles profile removal and index adjustment, no need to call nextProfile
    }
  };

  const handleBlindMatch = () => {
    if (filteredProfiles.length > 0 && currentIndex < filteredProfiles.length) {
      const likedUser = filteredProfiles[currentIndex];
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
                  setProfiles((prevProfiles) => {
                    const nextProfiles = prevProfiles.filter((profile) => profile.id !== blockedUserId);
                    setCurrentIndex((prevIndex) =>
                      adjustCurrentIndexAfterRemoval(prevProfiles, blockedUserId, prevIndex, nextProfiles)
                    );
                    return nextProfiles;
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
      const likedUser =
        filteredProfiles.length > 0 && currentIndex < filteredProfiles.length
          ? filteredProfiles[currentIndex]
          : null;
      if (!likedUser) {
        Alert.alert('Error', 'No profile selected');
        return;
      }
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/match/send_note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ recipient_id: likedUser.id, note })
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
        let message = 'Failed to send note';
        try {
          const data = await res.json();
          if (data?.message) message = data.message;
        } catch (_) {
          // Keep default message if response body isn't JSON
        }
        Alert.alert('Error', message);
        return;
      }

      const data = await res.json();
      setShowNoteModal(false);
      // Remove the user from profiles after sending note (note creates a pending match)
      setProfiles((prevProfiles) => {
        const nextProfiles = prevProfiles.filter((profile) => profile.id !== likedUser.id);
        setCurrentIndex((prevIndex) =>
          adjustCurrentIndexAfterRemoval(prevProfiles, likedUser.id, prevIndex, nextProfiles)
        );
        return nextProfiles;
      });

      if (data.match?.status === 'matched' || data.match?.status === 'pending_approval') {
        const firstImage = likedUser?.images?.[0]?.image_url || null;
        setMatchModalData({
          matchId: data.match.id,
          firstName: likedUser?.first_name || 'someone',
          imageUrl: firstImage ? getImageUrl(firstImage, API_BASE_URL) : null,
          isPendingApproval: data.match.status === 'pending_approval',
        });
        setShowMatchModal(true);
      }
    } catch (err) {
      console.error('Error sending note:', err);
      Alert.alert('Error', 'Failed to send note');
    }
  };

  if (loading || refreshing) {
    const loadingRole = userInfo?.role || roleHint || 'user';
    const loadingColor = getRoleAccentColor(loadingRole);
    const loadingBackgroundTint = getRoleBackgroundTint(loadingRole);
    return (
      <View style={[styles.loadingContainer, { backgroundColor: loadingBackgroundTint }]}>
        <ActivityIndicator size="large" color={loadingColor} />
        <Text style={styles.loadingText}>Loading profiles...</Text>
      </View>
    );
  }

  const currentProfile =
    filteredProfiles.length > 0 && currentIndex < filteredProfiles.length
      ? filteredProfiles[currentIndex]
      : null;
  const accentColor = getRoleAccentColor(userInfo?.role || 'matchmaker');
  const backgroundTint = getRoleBackgroundTint(userInfo?.role || 'matchmaker');
  const overlayTopPadding = userInfo?.role === 'matchmaker' ? 150 : 56;
  const isProfilesEmptyState = !currentProfile;
  const hasProfilesButFilteredOut = profiles.length > 0 && filteredProfiles.length === 0;
  const heightLabelUnit = userInfo?.unit || contextUser?.unit || 'Imperial';

  const dismissFilterSidebar = () => {
    setFilterDraft({ ...matchFilters });
    setShowFilterSidebar(false);
  };

  const saveMatchFilters = () => {
    const changed =
      matchFilters.heightMinCm !== filterDraft.heightMinCm ||
      matchFilters.heightMaxCm !== filterDraft.heightMaxCm ||
      matchFilters.heightFilterEnabled !== filterDraft.heightFilterEnabled ||
      matchFilters.requireBio !== filterDraft.requireBio ||
      matchFilters.internalMatchmakingOnly !== filterDraft.internalMatchmakingOnly;
    if (changed) {
      setCurrentIndex(0);
    }
    setMatchFilters({ ...filterDraft });
    setShowFilterSidebar(false);
  };

  const filterButtonTop =
    userInfo?.role === 'matchmaker'
      ? insets.top + 6
      : overlayTopPadding + 8;

  return (
    <View style={[styles.container, { backgroundColor: backgroundTint, paddingTop: overlayTopPadding }]}>
      <TouchableOpacity
        style={[styles.filterButton, { top: filterButtonTop }]}
        onPress={() => {
          setFilterDraft({ ...matchFilters });
          setShowFilterSidebar(true);
        }}
        accessibilityLabel="Open match filters"
      >
        <Ionicons name="options-outline" size={24} color="#1f2937" />
        {activeFilterCount > 0 ? (
          <View style={[styles.filterBadge, { backgroundColor: accentColor }]}>
            <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
      <ScrollView
        style={[
          styles.scrollView,
          userInfo?.role === 'matchmaker' && styles.scrollViewWithDropdown,
        ]}
        contentContainerStyle={[
          styles.content,
          userInfo?.role === 'matchmaker' && styles.contentWithDropdown,
          isProfilesEmptyState && styles.contentGrow,
        ]}
      >
        {currentProfile ? (
          <>
            <ProfileCard
              profile={currentProfile}
              userInfo={userInfo}
              preferredViewerUnit={userInfo?.role === 'matchmaker' ? referrer?.unit : undefined}
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
          <View style={styles.loadingContainerInline}>
            <Text style={styles.loadingText}>
              {hasProfilesButFilteredOut
                ? 'No profiles match your filters. Adjust filters to see more people.'
                : 'No profiles to match with currently, come back later!'}
            </Text>
          </View>
        )}
      </ScrollView>
      {currentProfile && (
        <View style={styles.buttonContainer}>
          <View style={styles.leftButtonContainer}>
            {userInfo?.role === 'user' && (
              <View style={styles.actionItem}>
                <TouchableOpacity style={[styles.actionButton, styles.sideActionButton, styles.blockActionButton]} onPress={() => blockUser(currentProfile.id)}>
                  <Ionicons name="ban-outline" size={24} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.actionLabel}>Block</Text>
              </View>
            )}
            {userInfo?.role === 'matchmaker' && !currentProfile.liked_linked_dater && (
              <View style={styles.actionItem}>
                <TouchableOpacity style={[styles.actionButton, styles.sideActionButton, styles.blindActionButton]} onPress={handleBlindMatch}>
                  <Ionicons name="eye-off-outline" size={24} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.actionLabel}>Blind Match</Text>
              </View>
            )}
          </View>
          <View style={styles.centerButtonContainer}>
            {userInfo?.role === 'matchmaker' && currentProfile.liked_linked_dater ? (
              <View style={styles.actionItem}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.likeActionButton, { backgroundColor: accentColor }]}
                  onPress={handleBlindMatch}
                >
                  <Ionicons name="heart" size={34} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.actionLabel}>Like</Text>
              </View>
            ) : (
              <View style={styles.actionItem}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.likeActionButton, { backgroundColor: accentColor }]}
                  onPress={handleLike}
                >
                  <Ionicons name="heart" size={34} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.actionLabel}>Like</Text>
              </View>
            )}
          </View>
          <View style={styles.rightButtonContainer}>
            <View style={styles.actionItem}>
              <TouchableOpacity style={[styles.actionButton, styles.sideActionButton, styles.noteActionButton]} onPress={() => setShowNoteModal(true)}>
                <Ionicons name="create-outline" size={24} color="#ffffff" />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>Send Note</Text>
            </View>
          </View>
        </View>
      )}

      <Modal
        visible={showFilterSidebar}
        transparent
        animationType="none"
        onRequestClose={dismissFilterSidebar}
      >
        <View style={styles.filterModalRoot}>
          <Pressable
            style={styles.filterBackdrop}
            onPress={dismissFilterSidebar}
            accessibilityLabel="Close filters"
          />
          <View style={styles.filterDrawer}>
            <View style={styles.filterDrawerHeader}>
              <Text style={styles.filterDrawerTitle}>Filters</Text>
              <TouchableOpacity onPress={dismissFilterSidebar} hitSlop={12}>
                <Ionicons name="close" size={26} color="#374151" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.filterScroll}
              contentContainerStyle={styles.filterScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.filterSectionLabel}>Height</Text>
              <Text style={styles.filterSectionHint}>
                {formatCmAsHeightLabel(filterDraft.heightMinCm, heightLabelUnit)} –{' '}
                {formatCmAsHeightLabel(filterDraft.heightMaxCm, heightLabelUnit)}
              </Text>
              <Text style={styles.filterSectionSub}>
                Move the handles to filter by height. Leave them at both ends to include all heights.
              </Text>
              <View style={styles.filterSliderWrap}>
                <MultiSlider
                  values={[filterDraft.heightMinCm, filterDraft.heightMaxCm]}
                  min={heightBoundsCm.minCm}
                  max={heightBoundsCm.maxCm}
                  step={1}
                  sliderLength={sliderWidth}
                  onValuesChange={(values) => {
                    const [lo, hi] = values;
                    const atFullRange =
                      lo === heightBoundsCm.minCm && hi === heightBoundsCm.maxCm;
                    setFilterDraft((d) => ({
                      ...d,
                      heightMinCm: lo,
                      heightMaxCm: hi,
                      heightFilterEnabled: !atFullRange,
                    }));
                  }}
                  selectedStyle={{ backgroundColor: accentColor }}
                  unselectedStyle={{ backgroundColor: '#E5E7EB' }}
                  markerStyle={{
                    backgroundColor: accentColor,
                    height: 22,
                    width: 22,
                    borderRadius: 11,
                    borderWidth: 0,
                  }}
                  trackStyle={{ height: 6, borderRadius: 3 }}
                  containerStyle={{ height: 44, justifyContent: 'center' }}
                  snapped
                />
              </View>

              <Text style={[styles.filterSectionLabel, { marginTop: 24 }]}>About me</Text>
              <TouchableOpacity
                style={styles.filterCheckboxRow}
                onPress={() =>
                  setFilterDraft((d) => ({ ...d, requireBio: !d.requireBio }))
                }
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.filterCheckbox,
                    filterDraft.requireBio && {
                      backgroundColor: accentColor,
                      borderColor: accentColor,
                    },
                  ]}
                >
                  {filterDraft.requireBio ? (
                    <Ionicons name="checkmark" size={16} color="#ffffff" />
                  ) : null}
                </View>
                <Text style={styles.filterCheckboxLabel}>
                  Only show profiles with about me filled out
                </Text>
              </TouchableOpacity>

              {showInternalMatchmakingFilter ? (
                <>
                  <Text style={[styles.filterSectionLabel, { marginTop: 24 }]}>
                    Internal matchmaking
                  </Text>
                  <Text style={styles.filterSectionSub}>
                    Limit the deck to people on your roster (other linked daters you work with).
                  </Text>
                  <TouchableOpacity
                    style={styles.filterCheckboxRow}
                    onPress={() =>
                      setFilterDraft((d) => ({
                        ...d,
                        internalMatchmakingOnly: !d.internalMatchmakingOnly,
                      }))
                    }
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.filterCheckbox,
                        filterDraft.internalMatchmakingOnly && {
                          backgroundColor: accentColor,
                          borderColor: accentColor,
                        },
                      ]}
                    >
                      {filterDraft.internalMatchmakingOnly ? (
                        <Ionicons name="checkmark" size={16} color="#ffffff" />
                      ) : null}
                    </View>
                    <Text style={styles.filterCheckboxLabel}>
                      Only show my linked daters
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </ScrollView>
            <View
              style={[
                styles.filterDrawerFooter,
                { paddingBottom: 28 + insets.bottom },
              ]}
            >
              <TouchableOpacity
                style={[styles.filterSaveButton, { backgroundColor: accentColor }]}
                onPress={saveMatchFilters}
              >
                <Text style={styles.filterSaveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMatchModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMatchModal(false)}
      >
        <View style={styles.matchModalOverlay}>
          <View style={styles.matchModalContent}>
            {matchModalData?.imageUrl ? (
              <Image
                source={{ uri: matchModalData.imageUrl }}
                style={[styles.matchModalImage, { borderColor: accentColor }]}
              />
            ) : (
              <View style={[styles.matchModalImagePlaceholder, { borderColor: accentColor }]}>
                <Ionicons name="person" size={48} color="#ccc" />
              </View>
            )}
            <Text style={styles.matchModalTitle}>
              {matchModalData?.isPendingApproval ? 'Match Found!' : "It's a Match!"}
            </Text>
            <Text style={styles.matchModalSubtitle}>
              {matchModalData?.isPendingApproval
                ? `Start the conversation with ${matchModalData?.firstName}`
                : `You and ${matchModalData?.firstName} liked each other`}
            </Text>
            <TouchableOpacity
              style={[styles.matchModalButton, { backgroundColor: accentColor }]}
              onPress={() => {
                setShowMatchModal(false);
                navigation.navigate('MatchConvo', {
                  matchId: matchModalData?.matchId,
                  // Pending approval can come from "send note" and should not imply blind.
                  isBlind: false,
                });
              }}
            >
              <Text style={styles.matchModalButtonText}>
                {matchModalData?.isPendingApproval ? 'Start Conversation' : 'Send a Message'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.matchModalDismiss}
              onPress={() => setShowMatchModal(false)}
            >
              <Text style={styles.matchModalDismissText}>Keep Swiping</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
    paddingTop: 24,
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
  scrollViewWithDropdown: {
    paddingTop: 8,
  },
  content: {
    padding: 20,
    paddingBottom: 100, // Space for buttons at bottom
  },
  contentGrow: {
    flexGrow: 1,
  },
  contentWithDropdown: {
    paddingTop: 4,
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
  loadingContainerInline: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
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
    bottom: 22,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  leftButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  sideActionButton: {
    height: 56,
    width: 56,
    borderRadius: 28,
  },
  likeActionButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ef4d73',
  },
  blindActionButton: {
    backgroundColor: '#4d59b6',
  },
  noteActionButton: {
    backgroundColor: '#c6a03c',
  },
  blockActionButton: {
    backgroundColor: '#e53e3e',
  },
  actionLabel: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#48506a',
  },
  matchModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchModalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  matchModalImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#6c5ce7',
  },
  matchModalImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
    backgroundColor: '#f2f2f2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#6c5ce7',
  },
  matchModalTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  matchModalSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  matchModalButton: {
    backgroundColor: '#6c5ce7',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  matchModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  matchModalDismiss: {
    paddingVertical: 10,
  },
  matchModalDismissText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
  },
  filterButton: {
    position: 'absolute',
    left: 16,
    zIndex: 50,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  filterModalRoot: {
    flex: 1,
  },
  filterBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  filterDrawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '86%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 16,
  },
  filterDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  filterDrawerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  filterScroll: {
    flex: 1,
  },
  filterScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  filterSectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
  },
  filterSectionHint: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 6,
  },
  filterSectionSub: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 18,
  },
  filterSliderWrap: {
    alignItems: 'center',
    marginTop: 4,
  },
  filterCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  filterCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  filterCheckboxLabel: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  filterDrawerFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  filterSaveButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  filterSaveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default Match;
