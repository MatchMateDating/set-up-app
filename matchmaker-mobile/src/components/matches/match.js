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
import { fetchWithRetry } from '../../utils/fetchWithRetry';
import SendNoteModal from './sendNoteModal';
import ProfileCard from './profileCard';
import { useProfiles } from './hooks/useProfiles';
import { useUserInfo } from './hooks/useUserInfo';
import { startLocationWatcher, stopLocationWatcher } from '../auth/utils/startLocationWatcher';
import { getImageUrl, heightStringToCm, convertHeightForViewer, normalizeHeightUnit } from '../profile/utils/profileUtils';
import { getRoleAccentColor } from '../layout/components/RoleHeaderBanner';
import DaterDropdown from '../layout/daterDropdown';
import { UserContext } from '../../context/UserContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MATCH_SCREEN_BG = '#fff5f7';
const MATCHMAKER_SCREEN_BG = '#f3f4f6';
const CARD_STACK_PADDING_TOP = 14;
const MATCHMAKER_CARD_STACK_PADDING_TOP = 6;
const STACK_PREVIEW_PEEK = 12;
const STACK_PREVIEW_PEEK_WITH_NOTE = 16;
const STACK_PREVIEW_PEEK_OFFSET = -2;
const STACK_PREVIEW_ALIGNED_LIFT = 8;
/** Minimal space above cards so a both-notes preview clears the dater dropdown. */
const MATCHMAKER_BOTH_NOTES_PREVIEW_PADDING = STACK_PREVIEW_ALIGNED_LIFT + 12;
const STACK_PREVIEW_SCALE = 0.96;
const STACK_PREVIEW_INSET = 10;
const HEIGHT_SLIDER_MIN_CM = 0;
/** 7'11" in centimeters */
const HEIGHT_SLIDER_MAX_CM_IMPERIAL = Math.round(7 * 30.48 + 11 * 2.54);
/** 2m 99cm */
const HEIGHT_SLIDER_MAX_CM_METRIC = 299;

const getHeightSliderBoundsCm = (viewerUnit) => {
  const unit = normalizeHeightUnit(viewerUnit);
  if (unit === 'metric') {
    return { minCm: HEIGHT_SLIDER_MIN_CM, maxCm: HEIGHT_SLIDER_MAX_CM_METRIC };
  }
  return { minCm: HEIGHT_SLIDER_MIN_CM, maxCm: HEIGHT_SLIDER_MAX_CM_IMPERIAL };
};

const getInitialMatchFilters = (viewerUnit) => {
  const { minCm, maxCm } = getHeightSliderBoundsCm(viewerUnit);
  return {
    heightMinCm: minCm,
    heightMaxCm: maxCm,
    requireBio: false,
    internalMatchmakingOnly: false,
    /** Off until the user moves the height slider — avoids treating full range as an active filter. */
    heightFilterEnabled: false,
  };
};

const formatCmAsHeightLabel = (cm, viewerUnit) => {
  const m = Math.floor(cm / 100);
  const centimeters = Math.round(cm - m * 100);
  return convertHeightForViewer(`${m}m ${centimeters}cm`, 'metric', viewerUnit);
};

const FILTER_SHEET_BG = '#f3f4f6';

const Match = () => {
  const insets = useSafeAreaInsets();
  const { profiles, setProfiles, loading } = useProfiles(API_BASE_URL);
  const { userInfo, setUserInfo } = useUserInfo(API_BASE_URL);
  const { user: contextUser, setUser: setContextUser } = useContext(UserContext);
  const [refreshing, setRefreshing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchModalData, setMatchModalData] = useState(null);
  const [referrer, setReferrer] = useState(null);
  const [roleHint, setRoleHint] = useState(null);
  const [showFilterSidebar, setShowFilterSidebar] = useState(false);
  const [matchFilters, setMatchFilters] = useState(() => getInitialMatchFilters('Imperial'));
  const [filterDraft, setFilterDraft] = useState(() => getInitialMatchFilters('Imperial'));
  const navigation = useNavigation();
  const selectedDaterId = userInfo?.referrer_id || userInfo?.referred_by_id || null;

  const sliderWidth = Dimensions.get('window').width - 56;

  const linkedDaterIdSet = useMemo(() => {
    const ids = userInfo?.linked_daters;
    if (!Array.isArray(ids)) return new Set();
    return new Set(ids.map((id) => Number(id)));
  }, [userInfo?.linked_daters]);

  const showInternalMatchmakingFilter =
    userInfo?.role === 'matchmaker' && linkedDaterIdSet.size >= 2;

  const viewerHeightUnit = userInfo?.unit || contextUser?.unit || 'Imperial';
  const heightBoundsCm = useMemo(
    () => getHeightSliderBoundsCm(viewerHeightUnit),
    [viewerHeightUnit]
  );

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
      // Reset filters to the fixed full height range for the user's unit.
      const initialFilters = getInitialMatchFilters(contextUser?.unit || 'Imperial');
      setMatchFilters(initialFilters);
      setFilterDraft(initialFilters);

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

      const res = await fetchWithRetry(`${API_BASE_URL}/match/like`, {
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

      const res = await fetchWithRetry(`${API_BASE_URL}/match/blind_match`, {
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
    const loadingBg =
      loadingRole === 'matchmaker' ? MATCHMAKER_SCREEN_BG : MATCH_SCREEN_BG;
    return (
      <View style={[styles.loadingContainer, { backgroundColor: loadingBg }]}>
        <ActivityIndicator size="large" color={loadingColor} />
        <Text style={styles.loadingText}>Loading profiles...</Text>
      </View>
    );
  }

  const currentProfile =
    filteredProfiles.length > 0 && currentIndex < filteredProfiles.length
      ? filteredProfiles[currentIndex]
      : null;
  const upcomingProfile =
    filteredProfiles.length > 0 && currentIndex + 1 < filteredProfiles.length
      ? filteredProfiles[currentIndex + 1]
      : null;
  const accentColor = getRoleAccentColor(userInfo?.role || 'matchmaker');
  const isMatchmaker = userInfo?.role === 'matchmaker';
  const isDater = userInfo?.role === 'user';
  const screenBackground = isMatchmaker ? MATCHMAKER_SCREEN_BG : MATCH_SCREEN_BG;
  const headerTopPadding = isMatchmaker ? insets.top + 4 : insets.top + 8;
  const actionBarBottom = 12;
  const isProfilesEmptyState = !currentProfile;
  const hasProfilesButFilteredOut = profiles.length > 0 && filteredProfiles.length === 0;
  const heightLabelUnit = viewerHeightUnit;
  const upcomingHasNote = Boolean(upcomingProfile?.note?.trim());
  const currentHasNote = Boolean(currentProfile?.note?.trim());
  const bothNotesPreview = currentHasNote && upcomingHasNote;
  const cardStackPreviewPadding = isMatchmaker
    ? MATCHMAKER_CARD_STACK_PADDING_TOP
    : CARD_STACK_PADDING_TOP;
  const stackPreviewHeight = upcomingHasNote ? STACK_PREVIEW_PEEK_WITH_NOTE : STACK_PREVIEW_PEEK;
  const stackPreviewTop = bothNotesPreview
    ? -STACK_PREVIEW_ALIGNED_LIFT
    : cardStackPreviewPadding - stackPreviewHeight + STACK_PREVIEW_PEEK_OFFSET;

  const dismissFilterSheet = () => {
    setFilterDraft({ ...matchFilters });
    setShowFilterSidebar(false);
  };

  const saveFilterSheet = () => {
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
        setContextUser(data.user);
        setUserInfo(data.user);
      }
      if (data?.referrer) {
        setReferrer(data.referrer);
      }
    } catch (err) {
      console.error('Error refreshing user after dater change:', err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: screenBackground }]}>
      <View
        style={[
          styles.screenHeader,
          isDater && styles.screenHeaderDater,
          isMatchmaker && styles.screenHeaderMatchmaker,
          { paddingTop: headerTopPadding },
        ]}
      >
        <Image
          source={require('../../../assets/matchmate_logo.png')}
          style={styles.headerLogo}
          accessibilityLabel="Matchmate logo"
        />
        <TouchableOpacity
          style={[
            styles.filterButton,
            isDater && styles.filterButtonDater,
            isMatchmaker && styles.filterButtonMatchmaker,
          ]}
          onPress={() => {
            setFilterDraft({ ...matchFilters });
            setShowFilterSidebar(true);
          }}
          accessibilityLabel="Open match filters"
        >
          <Ionicons name="options-outline" size={22} color="#374151" />
          {activeFilterCount > 0 ? (
            <View style={[styles.filterBadge, { backgroundColor: accentColor }]}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>
      {isMatchmaker ? (
        <View style={styles.choosingSection}>
          <DaterDropdown
            userInfo={userInfo || contextUser}
            onDaterChange={handleDaterChange}
            showLabel
          />
        </View>
      ) : null}
      <ScrollView
        style={[
          styles.scrollView,
          userInfo?.role === 'matchmaker' && styles.scrollViewWithDropdown,
        ]}
        contentContainerStyle={[
          styles.content,
          isDater && styles.contentDater,
          isMatchmaker && styles.contentMatchmaker,
          isMatchmaker &&
            bothNotesPreview &&
            upcomingProfile &&
            styles.contentMatchmakerBothNotesPreview,
          isProfilesEmptyState && styles.contentGrow,
        ]}
        removeClippedSubviews={!(isMatchmaker && bothNotesPreview && upcomingProfile)}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {currentProfile ? (
          <>
            <View
              style={[
                styles.cardStack,
                upcomingProfile &&
                  !bothNotesPreview && {
                    paddingTop: cardStackPreviewPadding,
                  },
                bothNotesPreview && styles.cardStackBothNotesPreview,
              ]}
            >
              {upcomingProfile ? (
                <>
                  <View
                    style={[
                      styles.stackPreviewLayer,
                      bothNotesPreview
                        ? { top: stackPreviewTop }
                        : {
                            top: stackPreviewTop,
                            height: stackPreviewHeight,
                            overflow: 'hidden',
                          },
                    ]}
                    pointerEvents="none"
                  >
                    <View style={styles.stackPreviewScaled}>
                      <ProfileCard
                        profile={upcomingProfile}
                        userInfo={userInfo}
                        preferredViewerUnit={
                          userInfo?.role === 'matchmaker' ? referrer?.unit : undefined
                        }
                        isStackPreview
                        stackPreviewAligned={bothNotesPreview}
                      />
                    </View>
                  </View>
                </>
              ) : null}
              <View style={styles.currentCard}>
                <ProfileCard
                  profile={currentProfile}
                  userInfo={userInfo}
                  preferredViewerUnit={
                    userInfo?.role === 'matchmaker' ? referrer?.unit : undefined
                  }
                  onSkip={nextProfile}
                />
              </View>
            </View>
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
        <View style={[styles.buttonContainer, { bottom: actionBarBottom }]}>
          <View style={styles.leftButtonContainer}>
            {isDater && (
              <TouchableOpacity
                style={[styles.actionButton, styles.sideActionButton]}
                onPress={() => blockUser(currentProfile.id)}
                accessibilityLabel="Block user"
              >
                <Ionicons name="ban-outline" size={26} color="#ef4444" />
              </TouchableOpacity>
            )}
            {userInfo?.role === 'matchmaker' && !currentProfile.liked_linked_dater && (
              <TouchableOpacity
                style={[styles.actionButton, styles.sideActionButton]}
                onPress={handleBlindMatch}
                accessibilityLabel="Blind match"
              >
                <Ionicons name="eye-off-outline" size={24} color="#6c5ce7" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.centerButtonContainer}>
            {userInfo?.role === 'matchmaker' && currentProfile.liked_linked_dater ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.likeActionButton]}
                onPress={handleBlindMatch}
                accessibilityLabel="Like"
              >
                <Ionicons name="heart" size={32} color="#ef4d73" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, styles.likeActionButton]}
                onPress={handleLike}
                accessibilityLabel="Like"
              >
                <Ionicons name="heart" size={32} color="#ef4d73" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.rightButtonContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.sideActionButton]}
              onPress={() => setShowNoteModal(true)}
              accessibilityLabel="Send note"
            >
              <Ionicons
                name="create-outline"
                size={24}
                color={isMatchmaker ? '#6c5ce7' : '#374151'}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal
        visible={showFilterSidebar}
        transparent
        animationType="slide"
        onRequestClose={dismissFilterSheet}
      >
        <View style={styles.filterModalRoot}>
          <Pressable
            style={styles.filterBackdrop}
            onPress={dismissFilterSheet}
            accessibilityLabel="Close filters"
          />
          <View
            style={[
              styles.filterBottomSheet,
              { maxHeight: Dimensions.get('window').height * 0.72 },
            ]}
          >
            <View style={styles.filterSheetHeader}>
              <Text style={styles.filterSheetTitle}>Filter</Text>
              <TouchableOpacity
                style={styles.filterSheetClose}
                onPress={dismissFilterSheet}
                hitSlop={12}
                accessibilityLabel="Close filter"
              >
                <Ionicons name="close" size={22} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.filterScroll}
              contentContainerStyle={styles.filterScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.filterSectionLabel}>HEIGHT</Text>
              <Text style={styles.filterSectionHint}>
                Select a height range you're looking for
              </Text>
              <View style={styles.filterHeightValuesRow}>
                <View style={[styles.filterHeightValueBox, { borderColor: accentColor }]}>
                  <Text style={[styles.filterHeightValueText, { color: accentColor }]}>
                    {formatCmAsHeightLabel(filterDraft.heightMinCm, heightLabelUnit)}
                  </Text>
                </View>
                <Text style={styles.filterHeightDash}>–</Text>
                <View style={[styles.filterHeightValueBox, { borderColor: accentColor }]}>
                  <Text style={[styles.filterHeightValueText, { color: accentColor }]}>
                    {formatCmAsHeightLabel(filterDraft.heightMaxCm, heightLabelUnit)}
                  </Text>
                </View>
              </View>
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
                    height: 24,
                    width: 24,
                    borderRadius: 12,
                    borderWidth: 0,
                    shadowColor: accentColor,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                  trackStyle={{ height: 4, borderRadius: 2 }}
                  containerStyle={{ height: 40, justifyContent: 'center' }}
                  snapped
                />
              </View>

              <View style={styles.filterSectionDivider} />

              <Text style={styles.filterSectionLabel}>ABOUT ME</Text>
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
                    { borderColor: accentColor },
                    filterDraft.requireBio && styles.filterCheckboxChecked,
                  ]}
                >
                  {filterDraft.requireBio ? (
                    <Ionicons name="checkmark" size={16} color={accentColor} />
                  ) : null}
                </View>
                <Text style={styles.filterCheckboxLabel}>About Me Filled Out</Text>
              </TouchableOpacity>

              {showInternalMatchmakingFilter ? (
                <>
                  <View style={styles.filterSectionDivider} />
                  <Text style={styles.filterSectionLabel}>INTERNAL MATCHMAKING</Text>
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
                        { borderColor: accentColor },
                        filterDraft.internalMatchmakingOnly && {
                          backgroundColor: '#ffffff',
                        },
                      ]}
                    >
                      {filterDraft.internalMatchmakingOnly ? (
                        <Ionicons name="checkmark" size={16} color={accentColor} />
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
                styles.filterSheetFooter,
                { paddingBottom: 20 + insets.bottom },
              ]}
            >
              <TouchableOpacity
                style={[styles.filterSaveButton, { backgroundColor: accentColor }]}
                onPress={saveFilterSheet}
                accessibilityLabel="Save filters"
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
    backgroundColor: MATCH_SCREEN_BG,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3e8ee',
  },
  screenHeaderDater: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    paddingBottom: 4,
  },
  screenHeaderMatchmaker: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  choosingSection: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  headerLogo: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
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
  },
  scrollViewWithDropdown: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  contentDater: {
    paddingTop: 8,
    paddingBottom: 110,
  },
  contentMatchmaker: {
    paddingTop: 0,
    paddingBottom: 120,
  },
  contentMatchmakerBothNotesPreview: {
    paddingTop: MATCHMAKER_BOTH_NOTES_PREVIEW_PADDING,
  },
  contentGrow: {
    flexGrow: 1,
  },
  contentWithDropdown: {
    paddingTop: 4,
  },
  cardStack: {
    position: 'relative',
  },
  cardStackBothNotesPreview: {
    overflow: 'visible',
  },
  stackPreviewLayer: {
    position: 'absolute',
    left: STACK_PREVIEW_INSET,
    right: STACK_PREVIEW_INSET,
    overflow: 'visible',
    zIndex: 0,
  },
  stackPreviewScaled: {
    transform: [{ scale: STACK_PREVIEW_SCALE }],
    transformOrigin: 'top center',
  },
  currentCard: {
    position: 'relative',
    zIndex: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: MATCH_SCREEN_BG,
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
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 36,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  leftButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 68,
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
    minHeight: 68,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 6,
  },
  sideActionButton: {
    height: 56,
    width: 56,
    borderRadius: 28,
  },
  likeActionButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
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
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#f3e8ee',
  },
  filterButtonDater: {
    borderRadius: 14,
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  filterButtonMatchmaker: {
    borderRadius: 12,
    borderWidth: 0,
    shadowOpacity: 0.06,
    shadowRadius: 8,
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
    justifyContent: 'flex-end',
  },
  filterBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  filterBottomSheet: {
    backgroundColor: FILTER_SHEET_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  filterSheetHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  filterSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 0.2,
  },
  filterSheetClose: {
    position: 'absolute',
    right: 20,
    top: 18,
    padding: 4,
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  filterSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  filterSectionHint: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 14,
    lineHeight: 18,
  },
  filterSectionSub: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 12,
    lineHeight: 18,
  },
  filterSectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e7eb',
    marginVertical: 20,
  },
  filterHeightValuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  filterHeightValueBox: {
    minWidth: 88,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  filterHeightValueText: {
    fontSize: 15,
    fontWeight: '600',
  },
  filterHeightDash: {
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: '500',
    marginHorizontal: 10,
  },
  filterSliderWrap: {
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  filterCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  filterCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  filterCheckboxChecked: {
    backgroundColor: '#ffffff',
  },
  filterCheckboxLabel: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  filterSheetFooter: {
    paddingHorizontal: 24,
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
