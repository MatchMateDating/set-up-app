import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Share,
  Modal,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Switch,
  Image,
  BackHandler,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL, FRONTEND_URL } from '../../env';
import FormField from '../profile/components/formField';
import MultiSelectGender from '../profile/components/multiSelectGender';
import { getImageUrl } from '../profile/utils/profileUtils';
import { useNotifications } from '../../context/NotificationContext';
import { getRoleAccentColor, getRoleBackgroundTint } from '../layout/components/RoleHeaderBanner';
import { UserContext } from '../../context/UserContext';
import { mainTabBackDelegateRef } from '../../navigation/mainTabsBackDelegates';
import { beginAuthSessionClear, clearAuthSession, resumeAuthSession, shouldSuppressAuthErrors } from '../../utils/authSession';
import { fetchWithRetry, isNetworkFailure } from '../../utils/fetchWithRetry';

const SECTION_KEYS = {
  PERSONAL: 'personal',
  MANAGE_ACCOUNTS: 'manageAccounts',
  REFERRAL: 'referral',
  DATING_PREFERENCES: 'datingPreferences',
  NOTIFICATIONS: 'notifications',
  DELETE_ACCOUNT: 'deleteAccount',
};

const getPasswordChecks = (value) => ({
  minLength: (value || '').length >= 8,
  hasUppercase: /[A-Z]/.test(value || ''),
  hasLowercase: /[a-z]/.test(value || ''),
  hasSpecial: /[^A-Za-z0-9]/.test(value || ''),
});

const phoneDigitsOnly = (value) => (value || '').replace(/\D/g, '');
const isValidPhone = (value) => phoneDigitsOnly(value).length >= 10;
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || '').trim());

/** US E.164 (+1xxxxxxxxxx); matches backend normalize_phone_number for Twilio SMS. */
const normalizeUsPhoneToE164 = (value) => {
  let digits = phoneDigitsOnly(value);
  if (!digits.startsWith('1') && digits.length === 10) {
    digits = `1${digits}`;
  }
  return `+${digits}`;
};

/** Prefer email when valid; otherwise phone if valid. */
const getIdentifierKind = (value) => {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  if (isValidEmail(trimmed)) return 'email';
  if (isValidPhone(trimmed)) return 'phone';
  return null;
};

const normalizeIdentifier = (value, kind) => {
  if (kind === 'email') return value.trim().toLowerCase();
  if (kind === 'phone') return normalizeUsPhoneToE164(value);
  return value.trim();
};

const buildDaterInviteSignupUrl = (inviteToken) => {
  const frontendUrl = (FRONTEND_URL || 'https://matchmatedating.com').replace(/\/+$/, '');
  const baseUrl = `${frontendUrl}/dater-signup.html`;
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}invite_token=${encodeURIComponent(String(inviteToken))}`;
};

const MATCHMAKER_SCREEN_BG = '#f3f4f6';

const MM_LINKED_PURPLE = '#5A4FCF';
const MM_LINKED_LIGHT_PURPLE = '#EFEEFF';
const MM_LINKED_BEIGE = '#F5F5F0';
const MM_LINKED_REMOVE_BG = '#FDECEC';

const LINKED_DATER_AVATAR_PALETTES = [
  { bg: '#EFEEFF', fg: '#5A4FCF' },
  { bg: '#E8F5E9', fg: '#2E7D32' },
  { bg: '#E3F2FD', fg: '#1565C0' },
  { bg: '#FFF3E0', fg: '#E65100' },
];

const NOTIFICATION_PREFERENCE_ITEMS = [
  {
    key: 'newMatchNotification',
    label: 'New Match',
  },
  {
    key: 'newBlindMatchNotification',
    label: 'New Blind Match',
    daterOnly: true,
  },
  {
    key: 'newMessageNotification',
    label: 'New Message',
  },
  {
    key: 'approvedMatchMessageNotification',
    label: 'Approved Match Messages',
    description:
      'When off, you will still get message alerts while a match is waiting for approval.',
    matchmakerOnly: true,
  },
  {
    key: 'newMatchApprovalNotification',
    label: 'Approved Match',
  },
];

const formatLinkedDaterIdPreview = (id) => {
  if (id == null || id === '') return '';
  const str = String(id);
  if (str.length >= 10) return `${str.slice(0, 8)}-${str.slice(8, 9)}`;
  return str;
};

const linkedDaterInitial = (name) => {
  const t = String(name || '').trim();
  if (!t) return '?';
  return t.charAt(0).toUpperCase();
};

const LinkedDaterRowAvatar = ({ name, firstImage, palette }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const uri =
    firstImage && !imageFailed ? getImageUrl(firstImage, API_BASE_URL) : null;

  return (
    <View style={[styles.mmLinkedAvatar, { backgroundColor: palette.bg }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.mmLinkedAvatarImage}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Text style={[styles.mmLinkedAvatarLetter, { color: palette.fg }]}>
          {linkedDaterInitial(name)}
        </Text>
      )}
    </View>
  );
};

const SettingsSections = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { setUser: setContextUser, user: contextUser } = useContext(UserContext);
  const {
    notificationsEnabled,
    notificationPreferences,
    enableNotifications,
    disableNotifications,
    setNotificationPreference,
    permissionStatus,
    loading: notificationPrefsLoading,
  } = useNotifications();

  const contextUserIdRef = useRef(contextUser?.id);
  contextUserIdRef.current = contextUser?.id;
  const notificationPrefsLoadingRef = useRef(notificationPrefsLoading);
  notificationPrefsLoadingRef.current = notificationPrefsLoading;

  const waitForNotificationPrefsAfterUserSwitch = useCallback(async (expectedUserId) => {
    await new Promise((r) => setTimeout(r, 50));
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      if (
        contextUserIdRef.current === expectedUserId &&
        !notificationPrefsLoadingRef.current
      ) {
        return;
      }
      await new Promise((r) => setTimeout(r, 40));
    }
  }, []);

  const promptEnableAllNotificationsForNewLinkedRole = useCallback(
    (newRole) =>
      new Promise((resolve) => {
        const roleLabel = newRole === 'user' ? 'dater' : 'matchmaker';
        const capitalized = newRole === 'user' ? 'Dater' : 'Matchmaker';
        Alert.alert(
          `${capitalized} account created`,
          `Your ${roleLabel} account is ready.\n\nEnable all push notifications for it so you do not miss matches, messages, or approvals.`,
          [
            {
              text: 'Not now',
              style: 'cancel',
              onPress: () => resolve(),
            },
            {
              text: 'Enable all',
              onPress: () => {
                void (async () => {
                  const granted = await enableNotifications();
                  if (!granted) {
                    Alert.alert(
                      'Permission required',
                      'To receive notifications, enable them in your device settings for this app.'
                    );
                  }
                  resolve();
                })();
              },
            },
          ],
          { cancelable: true, onDismiss: () => resolve() }
        );
      }),
    [enableNotifications]
  );

  const [activeSection, setActiveSection] = useState(null);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [savedReferrals, setSavedReferrals] = useState([]);
  /** Matchmakers who linked this dater via referral (inverse of savedReferrals). */
  const [linkedMatchmakers, setLinkedMatchmakers] = useState([]);
  const [referralCode, setReferralCode] = useState('');
  const [linkDaterReferralInput, setLinkDaterReferralInput] = useState('');
  const [linkReferralLoading, setLinkReferralLoading] = useState(false);
  const [unlinkingDaterId, setUnlinkingDaterId] = useState(null);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralInput, setReferralInput] = useState('');
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteModalForBothRoles, setDeleteModalForBothRoles] = useState(false);
  const [showIdentifierVerificationModal, setShowIdentifierVerificationModal] = useState(false);
  const [identifierVerificationCode, setIdentifierVerificationCode] = useState('');
  const [pendingIdentifier, setPendingIdentifier] = useState('');
  const [pendingIdentifierKind, setPendingIdentifierKind] = useState(null);
  const [showEmailInviteModal, setShowEmailInviteModal] = useState(false);
  const [emailInviteInput, setEmailInviteInput] = useState('');
  const [showLinkedDatersOnboarding, setShowLinkedDatersOnboarding] = useState(false);
  const [cachedDaterInviteUrl, setCachedDaterInviteUrl] = useState('');
  const [daterInviteLinkLoading, setDaterInviteLinkLoading] = useState(false);
  const [showDaterInviteEmailModal, setShowDaterInviteEmailModal] = useState(false);
  const [daterInviteEmailInput, setDaterInviteEmailInput] = useState('');

  /** Set when a matchmaker taps "Add Dater Account"; cleared on success, confirmed exit, or leaving Settings. */
  const [addDaterAccountFlowActive, setAddDaterAccountFlowActive] = useState(false);

  const [currentEmail, setCurrentEmail] = useState('');
  const [currentPhone, setCurrentPhone] = useState('');
  const [newIdentifier, setNewIdentifier] = useState('');
  const [confirmNewIdentifier, setConfirmNewIdentifier] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isNewPasswordFocused, setIsNewPasswordFocused] = useState(false);
  const newIdentifierInputRef = useRef(null);
  const confirmNewIdentifierInputRef = useRef(null);
  const oldPasswordInputRef = useRef(null);
  const newPasswordInputRef = useRef(null);
  const confirmNewPasswordInputRef = useRef(null);
  const settingsScrollRef = useRef(null);

  const [editingPreferences, setEditingPreferences] = useState(false);
  const [originalFormData, setOriginalFormData] = useState(null);
  const [formData, setFormData] = useState({
    preferredAgeMin: '18',
    preferredAgeMax: '60',
    preferredGenders: [],
    matchRadius: 50,
    matchWithAll: false,
    fontFamily: 'Arial',
    profileStyle: 'classic',
  });

  const radiusUnit = user?.unit === 'imperial' ? 'mi' : 'km';
  const radiusMax = radiusUnit === 'km' ? 800 : 500;
  const displayRadius = formData.matchWithAll ? '500+' : formData.matchRadius;
  const passwordChecks = getPasswordChecks(newPassword);
  const isPasswordStrong = Object.values(passwordChecks).every(Boolean);
  const isMatchmaker = role === 'matchmaker';
  const showScreenLogo = !activeSection;
  const overlayTopPadding = 56;
  const daterSectionListPaddingTop = 12;
  const headerTopPadding = insets.top + (isMatchmaker ? 4 : 12);
  // Match match.js: choosingSection (71) + cardStack paddingTop (32).
  const matchmakerSectionListPaddingTop = 103;
  const accentColor = getRoleAccentColor(role || 'matchmaker');
  const datingPreferencesAccent = getRoleAccentColor('user');
  const settingsBackAccent =
    activeSection === SECTION_KEYS.DATING_PREFERENCES ? datingPreferencesAccent : accentColor;
  const showSettingsBackButton =
    activeSection &&
    !(activeSection === SECTION_KEYS.DATING_PREFERENCES && editingPreferences);
  const daterContainerTopPadding = 40;
  const settingsBackButtonScreenTop = insets.top + 10;
  const settingsBackButtonTop = isMatchmaker
    ? settingsBackButtonScreenTop
    : settingsBackButtonScreenTop - daterContainerTopPadding;
  const settingsBackButtonBg = isMatchmaker
    ? 'rgba(243, 244, 246, 0.3)'
    : 'rgba(255, 245, 247, 0.3)';
  const settingsBackButtonSpacer = 54;
  const backgroundTint = isMatchmaker
    ? MATCHMAKER_SCREEN_BG
    : getRoleBackgroundTint(role || 'matchmaker');

  const visibleNotificationPreferenceItems = useMemo(
    () =>
      NOTIFICATION_PREFERENCE_ITEMS.filter((item) => {
        if (item.daterOnly && role === 'matchmaker') return false;
        if (item.matchmakerOnly && role === 'user') return false;
        return true;
      }),
    [role]
  );

  const currentIdentifierKind = useMemo(() => {
    if (currentEmail?.trim()) return 'email';
    if (currentPhone?.trim()) return 'phone';
    return null;
  }, [currentEmail, currentPhone]);

  const currentIdentifier = useMemo(() => {
    if (currentIdentifierKind === 'email') return currentEmail.trim();
    if (currentIdentifierKind === 'phone') return currentPhone.trim();
    return '';
  }, [currentIdentifierKind, currentEmail, currentPhone]);

  const sectionItems = useMemo(() => {
    const base = [
      {
        key: SECTION_KEYS.PERSONAL,
        label: 'Personal Information',
        description: 'Update your email, phone number, and password.',
        icon: 'person-outline',
      },
      {
        key: SECTION_KEYS.MANAGE_ACCOUNTS,
        label: 'Manage Accounts',
        description: 'Add or switch between linked account types.',
        icon: 'people-outline',
      },
      {
        key: SECTION_KEYS.REFERRAL,
        label: role === 'matchmaker' ? 'Manage Linked Daters' : 'Referral Code',
        description: role === 'matchmaker'
          ? 'Link and manage your connected daters.'
          : 'Share your code and manage who can matchmake for you.',
        icon: 'gift-outline',
      },
      {
        key: SECTION_KEYS.NOTIFICATIONS,
        label: 'Notifications',
        description: 'Control push notification preferences.',
        icon: 'notifications-outline',
      },
      {
        key: SECTION_KEYS.DELETE_ACCOUNT,
        label: 'Delete Account',
        description: user?.linked_account
          ? 'Remove an account type or delete all data permanently.'
          : 'Permanently delete your account and data.',
        icon: 'trash-outline',
      },
    ];

    if (role === 'user') {
      base.splice(3, 0, {
        key: SECTION_KEYS.DATING_PREFERENCES,
        label: 'Dating Preferences',
        description: 'Set preferred age, gender, and match distance.',
        icon: 'heart-outline',
      });
    }
    return base;
  }, [role, user?.linked_account]);

  const fetchUserProfile = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        return;
      }

      const res = await fetch(`${API_BASE_URL}/profile/`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
        throw new Error('Failed to fetch user profile');
      }

      const data = await res.json();
      setUser(data.user);
      setContextUser(data.user);
      setRole(data.user.role);
      setCurrentEmail(data.user.email || '');
      setCurrentPhone(data.user.phone_number || '');
      setNewIdentifier('');
      setConfirmNewIdentifier('');
      setReferralCode(data.user.role === 'user' ? data.user?.referral_code || '' : '');

      const radiusMiles = data.user.match_radius ?? 50;
      const matchWithAll = radiusMiles >= 9999;
      const radiusInUserUnit = matchWithAll ? 500 :
        (data.user?.unit === 'metric' ? Math.round(radiusMiles * 1.60934) : radiusMiles);

      setFormData({
        preferredAgeMin: data.user.preferredAgeMin || '18',
        preferredAgeMax: data.user.preferredAgeMax || '60',
        preferredGenders: data.user.preferredGenders || [],
        matchRadius: radiusInUserUnit,
        matchWithAll,
        fontFamily: data.user.fontFamily || 'Arial',
        profileStyle: data.user.profileStyle || 'classic',
      });

      if (data.user.role === 'matchmaker') {
        setLinkedMatchmakers([]);
        const linkedRes = await fetchWithRetry(
          `${API_BASE_URL}/referral/referrals/${data.user.id}`,
          { headers: { Authorization: `Bearer ${token}` } },
          { retries: 3, baseDelayMs: 400 }
        );
        if (linkedRes.ok) {
          const linkedData = await linkedRes.json();
          setSavedReferrals(linkedData.linked_daters || []);
        }
      } else if (data.user.role === 'user') {
        setSavedReferrals([]);
        const mmRes = await fetch(`${API_BASE_URL}/referral/linked_matchmakers`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (mmRes.ok) {
          const mmData = await mmRes.json();
          setLinkedMatchmakers(mmData.linked_matchmakers || []);
        } else {
          setLinkedMatchmakers([]);
        }
      } else {
        setSavedReferrals([]);
        setLinkedMatchmakers([]);
      }

      await AsyncStorage.setItem('user', JSON.stringify(data.user));
    } catch (err) {
      console.error(err);
      if (await shouldSuppressAuthErrors()) return;
      Alert.alert('Error', 'Failed to load settings');
    }
  }, [navigation, setContextUser]);

  const refreshLinkedDaters = useCallback(async (matchmakerId) => {
    const mmId = matchmakerId ?? user?.id;
    if (!mmId) return null;

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return null;

      const linkedRes = await fetchWithRetry(
        `${API_BASE_URL}/referral/referrals/${mmId}`,
        { headers: { Authorization: `Bearer ${token}` } },
        { retries: 3, baseDelayMs: 400 }
      );
      if (!linkedRes.ok) return null;

      const linkedData = await linkedRes.json();
      const daters = linkedData.linked_daters || [];
      setSavedReferrals(daters);
      return daters;
    } catch (err) {
      console.error('Error refreshing linked daters:', err);
      return null;
    }
  }, [user?.id]);

  const ensureDefaultSelectedDater = useCallback(async (daterId) => {
    const selectedId = user?.referrer_id ?? user?.referred_by_id;
    if (selectedId != null && selectedId !== '') return;

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || !daterId) return;

      const res = await fetchWithRetry(
        `${API_BASE_URL}/referral/set_selected_dater`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ selected_dater_id: daterId }),
        },
        { retries: 3, baseDelayMs: 400 }
      );
      if (!res.ok) return;

      const profRes = await fetchWithRetry(
        `${API_BASE_URL}/profile/`,
        { headers: { Authorization: `Bearer ${token}` } },
        { retries: 3, baseDelayMs: 400 }
      );
      if (!profRes.ok) return;

      const profData = await profRes.json();
      if (profData.user) {
        setUser(profData.user);
        setContextUser(profData.user);
        await AsyncStorage.setItem('user', JSON.stringify(profData.user));
      }
    } catch (err) {
      console.error('Error setting default selected dater:', err);
    }
  }, [user?.referrer_id, user?.referred_by_id, setContextUser]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  useEffect(() => {
    if (activeSection !== SECTION_KEYS.REFERRAL || role !== 'matchmaker') {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token || cancelled) return;
        const res = await fetch(`${API_BASE_URL}/referral/dater_invite_token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const inviteToken = data.invite_token;
        if (!inviteToken || cancelled) return;
        if (!cancelled) setCachedDaterInviteUrl(buildDaterInviteSignupUrl(inviteToken));
      } catch (err) {
        console.error('Dater invite link prefetch:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSection, role]);

  useFocusEffect(
    useCallback(() => {
      fetchUserProfile();
    }, [fetchUserProfile])
  );

  const exitSubsection = useCallback(() => {
    if (
      activeSection === SECTION_KEYS.MANAGE_ACCOUNTS &&
      addDaterAccountFlowActive &&
      role === 'matchmaker'
    ) {
      Alert.alert(
        'Stop creating a dater account?',
        'If you go back now, you will stop creating a dater account.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go back',
            onPress: () => {
              setActiveSection(null);
              setEditingPreferences(false);
              setAddDaterAccountFlowActive(false);
            },
          },
        ],
        { cancelable: true }
      );
      return;
    }
    if (activeSection) {
      if (activeSection === SECTION_KEYS.MANAGE_ACCOUNTS) {
        setAddDaterAccountFlowActive(false);
      }
      setActiveSection(null);
      setEditingPreferences(false);
    }
  }, [activeSection, addDaterAccountFlowActive, role]);

  // Subsections are in-screen state; tab navigator would otherwise treat back / swipe as "leave Settings"
  // (e.g. Android back → first tab, horizontal swipe → adjacent tab). Match the in-screen "Back to Settings" row.
  useEffect(() => {
    if (activeSection) {
      navigation.setOptions({ swipeEnabled: false });
    } else {
      navigation.setOptions({ swipeEnabled: true });
    }
    return () => {
      navigation.setOptions({ swipeEnabled: true });
    };
  }, [navigation, activeSection]);

  // iOS left-edge swipe + Android back: first dismiss an open subsection (same as "Back to Settings").
  useEffect(() => {
    mainTabBackDelegateRef.current = () => {
      if (activeSection) {
        exitSubsection();
        return true;
      }
      return false;
    };
    return () => {
      mainTabBackDelegateRef.current = null;
    };
  }, [activeSection, exitSubsection]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        navigation.setOptions({ swipeEnabled: true });
        setActiveSection(null);
        setEditingPreferences(false);
        setAddDaterAccountFlowActive(false);
      };
    }, [navigation])
  );

  useFocusEffect(
    useCallback(() => {
      if (!activeSection) {
        return undefined;
      }
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        exitSubsection();
        return true;
      });
      return () => sub.remove();
    }, [activeSection, exitSubsection])
  );

  useEffect(() => {
    const shouldShowFromRoute = Boolean(route.params?.showLinkedDatersOnboarding);
    if (!shouldShowFromRoute || role !== 'matchmaker') {
      return;
    }

    setActiveSection(null);
    setShowLinkedDatersOnboarding(true);
  }, [route.params?.showLinkedDatersOnboarding, role]);

  const dismissLinkedDatersOnboarding = () => {
    setShowLinkedDatersOnboarding(false);
    navigation.setParams({ showLinkedDatersOnboarding: false });
  };

  const handleSaveIdentifier = async () => {
    try {
      const trimmedNew = newIdentifier.trim();
      const trimmedConfirm = confirmNewIdentifier.trim();
      if (!trimmedNew) {
        Alert.alert('Error', 'Please enter a new email or phone number');
        return;
      }
      if (!trimmedConfirm) {
        Alert.alert('Error', 'Please confirm your new email or phone number');
        return;
      }

      const newKind = getIdentifierKind(trimmedNew);
      const confirmKind = getIdentifierKind(trimmedConfirm);
      if (!newKind) {
        Alert.alert('Error', 'Please enter a valid email address or phone number');
        return;
      }
      if (!confirmKind) {
        Alert.alert('Error', 'Please enter a valid confirmation email or phone number');
        return;
      }
      if (newKind !== confirmKind) {
        Alert.alert('Error', 'New email/phone number and confirmation must be the same type');
        return;
      }

      const nextIdentifier = normalizeIdentifier(trimmedNew, newKind);
      const confirmIdentifier = normalizeIdentifier(trimmedConfirm, confirmKind);
      if (nextIdentifier !== confirmIdentifier) {
        Alert.alert('Error', 'New email/phone number and confirmation must match');
        return;
      }
      if (nextIdentifier === currentIdentifier) {
        Alert.alert('Error', 'Please enter an email or phone number different from your current one');
        return;
      }

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const endpoint =
        newKind === 'email' ? '/profile/request_email_change' : '/profile/request_phone_change';
      const body =
        newKind === 'email'
          ? { new_email: nextIdentifier }
          : { new_phone: nextIdentifier };

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
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
        const errorData = await res.json().catch(() => ({}));
        Alert.alert('Error', errorData.error || 'Failed to send verification code');
        return;
      }

      setPendingIdentifier(nextIdentifier);
      setPendingIdentifierKind(newKind);
      setIdentifierVerificationCode('');
      setShowIdentifierVerificationModal(true);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to send verification code');
    }
  };

  const handleVerifyIdentifierChange = async () => {
    try {
      const code = identifierVerificationCode.trim();
      if (!code) {
        Alert.alert('Error', 'Please enter the verification code');
        return;
      }
      if (!pendingIdentifier || !pendingIdentifierKind) {
        Alert.alert('Error', 'No pending email or phone number change found');
        return;
      }

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const endpoint =
        pendingIdentifierKind === 'email'
          ? '/profile/verify_email_change'
          : '/profile/verify_phone_change';
      const body =
        pendingIdentifierKind === 'email'
          ? { new_email: pendingIdentifier, code }
          : { new_phone: pendingIdentifier, code };

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        Alert.alert('Error', errorData.error || 'Failed to verify code');
        return;
      }

      if (pendingIdentifierKind === 'email') {
        setCurrentEmail(pendingIdentifier);
      } else {
        setCurrentPhone(pendingIdentifier);
      }
      setNewIdentifier('');
      setConfirmNewIdentifier('');
      setPendingIdentifier('');
      setPendingIdentifierKind(null);
      setIdentifierVerificationCode('');
      setShowIdentifierVerificationModal(false);
      Alert.alert(
        'Success',
        pendingIdentifierKind === 'email'
          ? 'Email updated successfully'
          : 'Phone number updated successfully'
      );
      fetchUserProfile();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to verify code');
    }
  };

  const handleSavePassword = async () => {
    try {
      if (!oldPassword.trim()) {
        Alert.alert('Error', 'Please enter your current password');
        return;
      }
      if (!newPassword.trim()) {
        Alert.alert('Error', 'Please enter a new password');
        return;
      }
      if (!confirmNewPassword.trim()) {
        Alert.alert('Error', 'Please confirm your new password');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        Alert.alert('Error', 'New password and confirmation must match');
        return;
      }
      if (!isPasswordStrong) {
        Alert.alert(
          'Error',
          'Password must be at least 8 characters and include 1 uppercase letter, 1 lowercase letter, and 1 special character.'
        );
        return;
      }

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const payload = {
        old_password: oldPassword,
        new_password: newPassword,
      };

      const res = await fetch(`${API_BASE_URL}/profile/change_password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
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
        const errorData = await res.json().catch(() => ({}));
        Alert.alert('Error', errorData.error || 'Failed to update password');
        return;
      }

      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowOldPassword(false);
      setShowNewPassword(false);
      setShowConfirmNewPassword(false);
      setIsNewPasswordFocused(false);
      Alert.alert('Success', 'Password updated successfully');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update password');
    }
  };

  const submitCreateDaterAccount = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      setAddDaterAccountFlowActive(true);

      const res = await fetch(`${API_BASE_URL}/profile/create_linked_dater`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAddDaterAccountFlowActive(false);
        Alert.alert('Error', data.error || 'Failed to create dater account');
        return;
      }

      const data = await res.json();
      if (data.token) {
        await AsyncStorage.setItem('token', data.token);
      }
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      setContextUser(data.user);
      setAddDaterAccountFlowActive(false);
      Alert.alert('Success', 'Dater account created successfully');
      navigation.navigate('CompleteProfile', { creatingLinkedDater: true });
      fetchUserProfile();
    } catch (err) {
      console.error(err);
      setAddDaterAccountFlowActive(false);
      Alert.alert('Error', 'Failed to create dater account');
    }
  };

  const handleCreateDaterAccount = () => {
    Alert.alert(
      'Create a dater account?',
      [
        'You are about to create a second profile (dater) that uses the same email and password as your matchmaker account. After you confirm, you will complete profile setup in three steps:',
        '',
        '1. Setup — Add photos and enter your name, birthdate, gender, height, and a short bio.',
        '2. Preview — See how your dater profile will look to others.',
        '3. Preferences — Choose age range, who you want to match with, and your match distance.',
        '',
        'You can switch between your matchmaker and dater accounts later from Settings.',
      ].join('\n'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create dater account',
          onPress: () => {
            void submitCreateDaterAccount();
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleCreateMatchmakerAccount = () => {
    setShowReferralModal(true);
  };

  const submitCreateMatchmaker = async () => {
    Keyboard.dismiss();

    const trimmedReferralCode = referralInput.trim();
    if (!trimmedReferralCode) {
      Alert.alert('Error', 'Please enter a referral code');
      return;
    }

    const daterFirstName = String(user?.first_name || '').trim();
    const daterLastName = String(user?.last_name || '').trim();
    const daterBirthdate = user?.birthdate;
    if (!daterFirstName || !daterLastName || !daterBirthdate) {
      Alert.alert(
        'Complete your profile first',
        'Finish your dater profile (name and birthdate) before creating a matchmaker account.'
      );
      return;
    }

    const ownReferralCode = String(user?.referral_code || '').trim();
    if (ownReferralCode && trimmedReferralCode.toLowerCase() === ownReferralCode.toLowerCase()) {
      Alert.alert('Error', "You can't use your own referral code to create a matchmaker account");
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/profile/create_linked_matchmaker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ referral_code: trimmedReferralCode }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        Alert.alert('Error', data.error || 'Failed to create matchmaker account');
        return;
      }

      const data = await res.json();
      if (data.token) {
        await AsyncStorage.setItem('token', data.token);
      }
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      setContextUser(data.user);
      setShowReferralModal(false);
      setReferralInput('');
      await waitForNotificationPrefsAfterUserSwitch(data.user.id);
      await promptEnableAllNotificationsForNewLinkedRole('matchmaker');
      if (data.user?.profile_completion_step) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'CompleteProfile' }],
        });
      } else {
        fetchUserProfile();
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to create matchmaker account');
    }
  };

  const handleSwitchAccount = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/profile/switch_account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        Alert.alert('Error', data.error || 'Failed to switch account');
        return;
      }

      const data = await res.json();
      await AsyncStorage.setItem('token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      setContextUser(data.user);
      fetchUserProfile();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to switch account');
    }
  };

  const handleDeleteAccountByRole = (targetRole) => {
    const roleLabel = targetRole === 'user' ? 'Dater' : 'Matchmaker';
    const deletingCurrent = role === targetRole;
    const confirmationMessage = deletingCurrent
      ? `Delete your ${roleLabel} account? You will be switched to your other linked account.`
      : `Delete your linked ${roleLabel} account?`;

    Alert.alert(
      `Delete ${roleLabel} Account`,
      confirmationMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              if (!token) {
                Alert.alert('Error', 'Please log in');
                navigation.navigate('Login');
                return;
              }

              const res = await fetch(`${API_BASE_URL}/profile/delete_account_by_role`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ role: targetRole }),
              });

              if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                Alert.alert('Error', errorData.error || `Failed to delete ${roleLabel} account`);
                return;
              }

              const data = await res.json();
              if (data.token) {
                await AsyncStorage.setItem('token', data.token);
              }
              if (data.user) {
                await AsyncStorage.setItem('user', JSON.stringify(data.user));
                setContextUser(data.user);
              }
              fetchUserProfile();
            } catch (err) {
              console.error(err);
              Alert.alert('Error', `Failed to delete ${roleLabel} account`);
            }
          },
        },
      ]
    );
  };

  const handleShareReferralCode = async () => {
    try {
      const frontendUrl = (FRONTEND_URL || 'https://matchmatedating.com').replace(/\/+$/, '');
      const baseSignupUrl = `${frontendUrl}/matchmaker-signup.html`;
      const separator = baseSignupUrl.includes('?') ? '&' : '?';
      const shareUrl = `${baseSignupUrl}${separator}referral_code=${encodeURIComponent(
        String(referralCode || '')
      )}`;
      await Share.share({
        message: `Join MatchMate as my matchmaker:\n${shareUrl}`,
        title: 'Join MatchMate as my matchmaker',
      });
    } catch (err) {
      console.error('Error sharing:', err);
      Alert.alert('Error', 'Failed to share referral code');
    }
  };

  const fetchFreshDaterInviteUrl = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      navigation.navigate('Login');
      return null;
    }

    const res = await fetch(`${API_BASE_URL}/referral/dater_invite_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      const data = await res.json().catch(() => ({}));
      if (data.error_code === 'TOKEN_EXPIRED') {
        await AsyncStorage.removeItem('token');
        navigation.navigate('Login');
        return null;
      }
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      Alert.alert('Error', data.error || 'Could not create invite link');
      return null;
    }

    const data = await res.json();
    const inviteToken = data.invite_token;
    if (!inviteToken) {
      Alert.alert('Error', 'Could not create invite link');
      return null;
    }

    return buildDaterInviteSignupUrl(inviteToken);
  };

  const ensureDaterInviteUrl = async () => {
    if (cachedDaterInviteUrl) return cachedDaterInviteUrl;
    setDaterInviteLinkLoading(true);
    try {
      const url = await fetchFreshDaterInviteUrl();
      if (url) setCachedDaterInviteUrl(url);
      return url;
    } finally {
      setDaterInviteLinkLoading(false);
    }
  };

  const handleCopyDaterInviteLink = async () => {
    if (daterInviteLinkLoading) return;
    try {
      const url = await ensureDaterInviteUrl();
      if (!url) return;
      await Clipboard.setStringAsync(url);
    } catch (err) {
      console.error('Error copying dater invite:', err);
      Alert.alert('Error', 'Failed to copy invite link');
    }
  };

  const handleTextDaterInviteLink = async () => {
    if (daterInviteLinkLoading) return;
    try {
      const url = await ensureDaterInviteUrl();
      if (!url) return;
      await Share.share({
        message: `Join MatchMate as a dater I'm matching for:\n${url}`,
        title: 'Join MatchMate',
      });
    } catch (err) {
      console.error('Error sharing dater invite:', err);
      Alert.alert('Error', 'Failed to share invite link');
    }
  };

  const handleOpenDaterInviteEmailModal = () => {
    setShowDaterInviteEmailModal(true);
  };

  const sendDaterInviteEmail = async () => {
    Keyboard.dismiss();

    if (!daterInviteEmailInput.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/invite/dater-signup-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: daterInviteEmailInput.trim() }),
      });

      if (res.status === 401) {
        const data = await res.json().catch(() => ({}));
        if (data.error_code === 'TOKEN_EXPIRED') {
          await AsyncStorage.removeItem('token');
          navigation.navigate('Login');
          return;
        }
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        Alert.alert('Error', data.error || 'Failed to send invite');
        return;
      }

      Alert.alert('Success', 'Email invite sent');
      setDaterInviteEmailInput('');
      setShowDaterInviteEmailModal(false);
    } catch (err) {
      console.error('Error sending dater invite email:', err);
      Alert.alert('Error', 'Failed to send invite');
    }
  };

  const handleCopyReferralCode = async () => {
    try {
      await Clipboard.setStringAsync(String(referralCode || ''));
      Alert.alert('Copied', 'Referral code copied to clipboard.');
    } catch (err) {
      console.error('Error copying referral code:', err);
      Alert.alert('Error', 'Failed to copy referral code');
    }
  };

  const handleOpenEmailInvite = () => {
    setShowEmailInviteModal(true);
  };

  const sendEmailInvite = async () => {
    Keyboard.dismiss();

    if (!emailInviteInput.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/invite/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: emailInviteInput.trim(),
          referralCode: String(referralCode || user?.referral_code || ''),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        Alert.alert('Error', data.error || 'Failed to send invite');
        return;
      }

      Alert.alert('Success', 'Email invite sent');
      setEmailInviteInput('');
      setShowEmailInviteModal(false);
    } catch (err) {
      console.error('Error sending invite:', err);
      Alert.alert('Error', 'Failed to send invite');
    }
  };

  const handleLinkReferral = async () => {
    Keyboard.dismiss();
    const code = linkDaterReferralInput.trim();
    if (!code) {
      Alert.alert('Error', 'Please enter a referral code');
      return;
    }
    if (linkReferralLoading) return;

    setLinkReferralLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetchWithRetry(
        `${API_BASE_URL}/referral/link_referral`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ referral_code: code }),
        },
        { retries: 3, baseDelayMs: 400 }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === 'Dater already linked') {
          const daters = await refreshLinkedDaters();
          if (daters?.some((d) => String(d.referral_code || '').toLowerCase() === code.toLowerCase())) {
            setLinkDaterReferralInput('');
            const linked = daters.find((d) => String(d.referral_code || '').toLowerCase() === code.toLowerCase());
            if (linked?.id) {
              await ensureDefaultSelectedDater(linked.id);
            }
            fetchUserProfile();
            return;
          }
        }
        Alert.alert('Error', data.error || 'Failed to link referral');
        return;
      }

      let name = data.message.split(' linked')[0];
      name = name.replace(/^Dater\s*/i, '').trim();
      const newDater = { id: data.linked_dater_id, name, referral_code: code };
      setSavedReferrals((prev) => [...prev, newDater]);
      setLinkDaterReferralInput('');
      await ensureDefaultSelectedDater(data.linked_dater_id);
      await fetchUserProfile();
    } catch (err) {
      console.error(err);
      const daters = await refreshLinkedDaters();
      if (daters?.some((d) => String(d.referral_code || '').toLowerCase() === code.toLowerCase())) {
        setLinkDaterReferralInput('');
        const linked = daters.find((d) => String(d.referral_code || '').toLowerCase() === code.toLowerCase());
        if (linked?.id) {
          await ensureDefaultSelectedDater(linked.id);
        }
        fetchUserProfile();
        return;
      }
      Alert.alert(
        'Error',
        isNetworkFailure(err)
          ? 'Could not reach the server. Check your connection and try again.'
          : 'Failed to link referral'
      );
    } finally {
      setLinkReferralLoading(false);
    }
  };

  const handleDeleteLinkedMatchmaker = (linkedMm) => {
    Alert.alert(
      'Remove matchmaker',
      `Remove ${linkedMm.name || 'this matchmaker'}? They will no longer be able to matchmake for you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              if (!token) {
                Alert.alert('Error', 'Please log in');
                navigation.navigate('Login');
                return;
              }

              const res = await fetch(`${API_BASE_URL}/referral/dater_unlink_matchmaker`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ matchmaker_id: linkedMm.id }),
              });

              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                Alert.alert('Error', data.error || 'Failed to remove matchmaker');
                return;
              }

              setLinkedMatchmakers(data.linked_matchmakers || []);
              Alert.alert('Success', 'Matchmaker removed');
              fetchUserProfile();
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'Failed to remove matchmaker');
            }
          },
        },
      ]
    );
  };

  const handleDeleteLinkedDater = (linkedDater) => {
    Alert.alert(
      'Remove Linked Dater',
      `Are you sure you want to remove ${linkedDater.name || 'this dater'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (unlinkingDaterId != null) return;

            setUnlinkingDaterId(linkedDater.id);
            try {
              const token = await AsyncStorage.getItem('token');
              if (!token) {
                Alert.alert('Error', 'Please log in');
                navigation.navigate('Login');
                return;
              }

              const res = await fetchWithRetry(
                `${API_BASE_URL}/referral/unlink_dater`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ linked_dater_id: linkedDater.id }),
                },
                { retries: 3, baseDelayMs: 400 }
              );

              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                const daters = await refreshLinkedDaters();
                if (!daters?.some((d) => d.id === linkedDater.id)) {
                  return;
                }
                Alert.alert('Error', data.error || 'Failed to remove linked dater');
                return;
              }

              setSavedReferrals(data.linked_daters || []);
              fetchUserProfile();
            } catch (err) {
              console.error(err);
              const daters = await refreshLinkedDaters();
              if (!daters?.some((d) => d.id === linkedDater.id)) {
                return;
              }
              Alert.alert(
                'Error',
                isNetworkFailure(err)
                  ? 'Could not reach the server. Check your connection and try again.'
                  : 'Failed to remove linked dater'
              );
            } finally {
              setUnlinkingDaterId(null);
            }
          },
        },
      ]
    );
  };

  const handleInputChangeWrapper = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSavePreferences = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const radiusMiles = formData.matchWithAll ? 9999 :
        (user?.unit === 'metric'
          ? Math.round(Number(formData.matchRadius) / 1.60934)
          : Number(formData.matchRadius));

      const payload = {
        preferredAgeMin: Number(formData.preferredAgeMin),
        preferredAgeMax: Number(formData.preferredAgeMax),
        preferredGenders: formData.preferredGenders,
        match_radius: radiusMiles,
        fontFamily: formData.fontFamily,
        profileStyle: formData.profileStyle,
      };

      const res = await fetch(`${API_BASE_URL}/profile/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to update dating preferences');
      }
      setEditingPreferences(false);
      fetchUserProfile();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update dating preferences');
    }
  };

  const handleNotificationToggle = async (value) => {
    if (value) {
      const granted = await enableNotifications();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings to receive notifications for new matches, blind matches, and messages.'
        );
      }
    } else {
      disableNotifications();
    }
  };

  const handleSignOut = async () => {
    try {
      setContextUser(null);
      await clearAuthSession();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const openFullAccountDeletion = (forBothLinkedRoles) => {
    setDeleteModalForBothRoles(Boolean(forBothLinkedRoles));
    Alert.alert(
      forBothLinkedRoles ? 'Delete Both Accounts' : 'Delete Account',
      forBothLinkedRoles
        ? 'Are you sure you want to permanently delete both your Dater and Matchmaker accounts? This cannot be undone.'
        : 'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', style: 'destructive', onPress: () => setShowDeleteAccountModal(true) },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    try {
      beginAuthSessionClear();
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        resumeAuthSession();
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/profile/delete_account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        resumeAuthSession();
        const errorData = await res.json().catch(() => ({}));
        Alert.alert('Error', errorData.error || 'Failed to delete account');
        return;
      }

      setContextUser(null);
      await clearAuthSession();
      setShowDeleteAccountModal(false);
      setDeleteModalForBothRoles(false);
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (err) {
      resumeAuthSession();
      console.error(err);
      Alert.alert('Error', 'Failed to delete account');
    }
  };

  const renderDeleteAccountSection = () => (
    <View style={styles.card}>
      <Text style={styles.cardHeader}>Delete Account</Text>
      <Text style={styles.cardDescription}>
        {user?.linked_account
          ? 'Remove one account type only, or delete both linked accounts and all data permanently.'
          : 'Permanently delete your account and all associated data.'}
      </Text>
      {user?.linked_account ? (
        <View style={styles.deleteAccountActions}>
          <TouchableOpacity
            style={[styles.deleteBothAccountsBtn, styles.deleteAccountBtnInGroup]}
            onPress={() => openFullAccountDeletion(true)}
          >
            <Text style={styles.deleteBothAccountsBtnText}>Delete Both Accounts</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dangerOutlineBtn, styles.deleteAccountBtnInGroup]}
            onPress={() => handleDeleteAccountByRole('user')}
          >
            <Text style={styles.dangerOutlineBtnText}>Delete Dater Account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dangerOutlineBtn, styles.deleteAccountBtnInGroup]}
            onPress={() => handleDeleteAccountByRole('matchmaker')}
          >
            <Text style={styles.dangerOutlineBtnText}>Delete Matchmaker Account</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.deleteAccountActions}>
          <TouchableOpacity
            style={[styles.deleteBothAccountsBtn, styles.deleteAccountBtnInGroup]}
            onPress={() => openFullAccountDeletion(false)}
          >
            <Text style={styles.deleteBothAccountsBtnText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderSectionList = () => (
    <View>
      {sectionItems.map((section) => {
        const isLinkedDatersSection = section.key === SECTION_KEYS.REFERRAL && role === 'matchmaker';
        const shouldHighlightLinkedDaters = isLinkedDatersSection && showLinkedDatersOnboarding;

        return (
          <View key={section.key} style={styles.sectionItemWrap}>
            <TouchableOpacity
              style={[
                styles.sectionButton,
                shouldHighlightLinkedDaters && styles.sectionButtonHighlighted,
              ]}
              onPress={() => setActiveSection(section.key)}
            >
              <View style={styles.sectionLeft}>
                <Ionicons name={section.icon} size={20} color={accentColor} />
                <View style={styles.sectionTextWrap}>
                  <Text style={styles.sectionText}>{section.label}</Text>
                  <Text style={styles.sectionDescription}>{section.description}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward-outline" size={20} color="#9CA3AF" />
            </TouchableOpacity>
            {shouldHighlightLinkedDaters ? (
              <View style={styles.linkedDatersHintBox}>
                <Text style={styles.linkedDatersHintText}>
                  add a linked dater to start matchmaking
                </Text>
                <TouchableOpacity
                  onPress={dismissLinkedDatersOnboarding}
                  style={styles.linkedDatersHintClose}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <Ionicons name="close" size={18} color="#6c5ce7" />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        );
      })}

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutBtnText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPersonalInfo = () => (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Personal Information</Text>
        <Text style={styles.cardDescription}>
          Update your login email or phone number and password below.
        </Text>
      </View>

      <View style={styles.subCard}>
        <Text style={styles.subCardHeader}>Change Email/Phone Number</Text>
        <Text style={styles.currentValueLabel}>
          Current {currentIdentifierKind === 'phone' ? 'Phone Number' : 'Email'}
        </Text>
        <Text style={styles.currentValue}>{currentIdentifier || 'Not available'}</Text>
        <TextInput
          ref={newIdentifierInputRef}
          style={styles.input}
          value={newIdentifier}
          onChangeText={setNewIdentifier}
          placeholder="New Email/Phone Number"
          placeholderTextColor="#111827"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => confirmNewIdentifierInputRef.current?.focus()}
        />
        <TextInput
          ref={confirmNewIdentifierInputRef}
          style={styles.input}
          value={confirmNewIdentifier}
          onChangeText={setConfirmNewIdentifier}
          placeholder="Confirm New Email/Phone Number"
          placeholderTextColor="#111827"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleSaveIdentifier}
        />
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: accentColor }]} onPress={handleSaveIdentifier}>
          <Text style={styles.primaryBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.subCard}>
        <Text style={styles.subCardHeader}>Change Password</Text>
        <View style={styles.passwordInputWrapper}>
          <TextInput
            ref={oldPasswordInputRef}
            style={[styles.input, styles.passwordInput]}
            value={oldPassword}
            onChangeText={setOldPassword}
            placeholder="Current Password"
            placeholderTextColor="#111827"
            secureTextEntry={!showOldPassword}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => newPasswordInputRef.current?.focus()}
          />
          <TouchableOpacity
            style={styles.passwordToggleBtn}
            onPress={() => setShowOldPassword((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showOldPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={accentColor}
            />
            <Text style={[styles.passwordToggleText, { color: accentColor }]}>{showOldPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.passwordInputWrapper}>
          <TextInput
            ref={newPasswordInputRef}
            style={[styles.input, styles.passwordInput]}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="New Password"
            placeholderTextColor="#111827"
            secureTextEntry={!showNewPassword}
            onFocus={() => {
              setIsNewPasswordFocused(true);
              // Keep password requirements visible when keyboard opens.
              setTimeout(() => {
                settingsScrollRef.current?.scrollToEnd({ animated: true });
              }, 120);
            }}
            onBlur={() => setIsNewPasswordFocused(false)}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => confirmNewPasswordInputRef.current?.focus()}
          />
          <TouchableOpacity
            style={styles.passwordToggleBtn}
            onPress={() => setShowNewPassword((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={accentColor}
            />
            <Text style={[styles.passwordToggleText, { color: accentColor }]}>{showNewPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>
        {isNewPasswordFocused ? (
          <View style={styles.passwordRulesContainer}>
            <Text style={styles.passwordRulesTitle}>Password requirements:</Text>
            <Text
              style={[
                styles.passwordRuleText,
                passwordChecks.minLength ? styles.passwordRulePassed : styles.passwordRulePending,
              ]}
            >
              - At least 8 characters
            </Text>
            <Text
              style={[
                styles.passwordRuleText,
                passwordChecks.hasUppercase ? styles.passwordRulePassed : styles.passwordRulePending,
              ]}
            >
              - 1 uppercase letter
            </Text>
            <Text
              style={[
                styles.passwordRuleText,
                passwordChecks.hasLowercase ? styles.passwordRulePassed : styles.passwordRulePending,
              ]}
            >
              - 1 lowercase letter
            </Text>
            <Text
              style={[
                styles.passwordRuleText,
                passwordChecks.hasSpecial ? styles.passwordRulePassed : styles.passwordRulePending,
              ]}
            >
              - 1 special character
            </Text>
          </View>
        ) : null}
        <View style={styles.passwordInputWrapper}>
          <TextInput
            ref={confirmNewPasswordInputRef}
            style={[styles.input, styles.passwordInput]}
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            placeholder="Confirm New Password"
            placeholderTextColor="#111827"
            secureTextEntry={!showConfirmNewPassword}
            returnKeyType="done"
            onSubmitEditing={handleSavePassword}
          />
          <TouchableOpacity
            style={styles.passwordToggleBtn}
            onPress={() => setShowConfirmNewPassword((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showConfirmNewPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={accentColor}
            />
            <Text style={[styles.passwordToggleText, { color: accentColor }]}>
              {showConfirmNewPassword ? 'Hide' : 'Show'}
            </Text>
          </TouchableOpacity>
        </View>
        {confirmNewPassword.length > 0 && newPassword !== confirmNewPassword ? (
          <Text style={styles.inputErrorText}>Passwords do not match</Text>
        ) : null}
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: accentColor }]} onPress={handleSavePassword}>
          <Text style={styles.primaryBtnText}>Save New Password</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderManageAccounts = () => (
    <View style={[styles.card, role === 'matchmaker' && styles.manageAccountsMatchmakerPad]}>
      <Text style={styles.cardHeader}>Manage Accounts</Text>
      <Text style={styles.cardDescription}>
        Add a different account type and switch between your two linked accounts.
      </Text>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Current account type:</Text>
        <Text style={styles.infoValue}>{role === 'user' ? 'Dater' : 'Matchmaker'}</Text>
      </View>

      {!user?.linked_account ? (
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: accentColor }]}
          onPress={role === 'user' ? handleCreateMatchmakerAccount : handleCreateDaterAccount}
        >
          <Text style={styles.primaryBtnText}>
            Add {role === 'user' ? 'Matchmaker' : 'Dater'} Account
          </Text>
        </TouchableOpacity>
      ) : (
        <View>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: accentColor }]} onPress={handleSwitchAccount}>
            <Text style={styles.primaryBtnText}>
              Switch to {user.linked_account.role === 'matchmaker' ? 'Matchmaker' : 'Dater'} Account
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderReferral = () => {
    if (role === 'user') {
      return (
        <View style={styles.matchmakerReferralStack}>
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Referral Code</Text>
            <Text style={styles.cardDescription}>
              Share your referral code so a matchmaker can link to you and set up matches.
            </Text>
            <View style={[styles.referralCodeBox, { borderColor: accentColor }]}>
              <Text style={[styles.referralCodeText, { color: accentColor }]}>{referralCode || 'No code available'}</Text>
            </View>
            <View style={styles.actionButtonGroup}>
              <TouchableOpacity style={styles.iconActionBtn} onPress={handleCopyReferralCode}>
                <Ionicons name="copy-outline" size={20} color={accentColor} />
                <Text style={[styles.iconActionText, { color: accentColor }]}>Copy Code</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconActionBtn} onPress={handleShareReferralCode}>
                <Ionicons name="share-outline" size={20} color={accentColor} />
                <Text style={[styles.iconActionText, { color: accentColor }]}>Share Link</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconActionBtn} onPress={handleOpenEmailInvite}>
                <Ionicons name="mail-outline" size={20} color={accentColor} />
                <Text style={[styles.iconActionText, { color: accentColor }]}>Email Link</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.mmLinkedCard}>
            <Text style={styles.mmLinkedListTitle}>Your matchmakers</Text>
            <Text style={styles.mmInviteSubtitle}>
              Matchmakers who linked using your code. Remove someone if you do not want them matchmaking for you anymore.
            </Text>
            <View style={styles.mmSectionDivider} />
            {linkedMatchmakers.length > 0 ? (
              linkedMatchmakers.map((mm, idx) => {
                const palette = LINKED_DATER_AVATAR_PALETTES[idx % LINKED_DATER_AVATAR_PALETTES.length];
                return (
                  <View
                    key={`${mm.id || idx}-${idx}`}
                    style={[styles.mmLinkedRow, idx > 0 && styles.mmLinkedRowBorder]}
                  >
                    <LinkedDaterRowAvatar name={mm.name} firstImage={mm.first_image} palette={palette} />
                    <View style={styles.mmLinkedRowText}>
                      <Text style={styles.mmLinkedName}>{mm.name || 'Matchmaker'}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.mmLinkedRemove}
                      onPress={() => handleDeleteLinkedMatchmaker(mm)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="close" size={14} color="#B91C1C" />
                    </TouchableOpacity>
                  </View>
                );
              })
            ) : (
              <Text style={styles.mmLinkedEmpty}>No matchmakers linked yet.</Text>
            )}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.matchmakerReferralStack}>
        <View style={styles.mmLinkedCard}>
          <Text style={styles.mmInviteTitle}>Invite a dater</Text>
          <Text style={styles.mmInviteSubtitle}>Share your personal signup link</Text>

          <View style={styles.mmQuickActionsRow}>
            <TouchableOpacity
              style={[
                styles.mmQuickAction,
                styles.mmQuickActionPrimary,
                daterInviteLinkLoading && styles.iconActionBtnDisabled,
              ]}
              onPress={handleCopyDaterInviteLink}
              disabled={daterInviteLinkLoading}
              activeOpacity={0.85}
            >
              <Ionicons name="copy-outline" size={22} color={MM_LINKED_PURPLE} />
              <Text style={styles.mmQuickActionLabelPrimary}>Copy Link</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.mmQuickAction,
                styles.mmQuickActionPrimary,
                daterInviteLinkLoading && styles.iconActionBtnDisabled,
              ]}
              onPress={handleTextDaterInviteLink}
              disabled={daterInviteLinkLoading}
              activeOpacity={0.85}
            >
              <Ionicons name="chatbubble-outline" size={22} color={MM_LINKED_PURPLE} />
              <Text style={styles.mmQuickActionLabelMuted}>Share Link</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mmQuickAction, styles.mmQuickActionPrimary]}
              onPress={handleOpenDaterInviteEmailModal}
              activeOpacity={0.85}
            >
              <Ionicons name="mail-outline" size={22} color={MM_LINKED_PURPLE} />
              <Text style={styles.mmQuickActionLabelMuted}>Email Link</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mmSectionDivider} />

          <Text style={styles.mmReferralByCodeTitle}>Or add by referral code</Text>
          <View style={styles.mmReferralInputRow}>
            <TextInput
              style={styles.mmReferralInput}
              value={linkDaterReferralInput}
              onChangeText={setLinkDaterReferralInput}
              placeholder="Enter referral code"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!linkReferralLoading}
            />
            <TouchableOpacity
              style={[styles.mmAddReferralBtn, linkReferralLoading && styles.iconActionBtnDisabled]}
              onPress={handleLinkReferral}
              disabled={linkReferralLoading}
              activeOpacity={0.9}
            >
              <Text style={styles.mmAddReferralBtnText}>{linkReferralLoading ? 'Adding…' : 'Add'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.mmLinkedCard}>
          <Text style={styles.mmLinkedListTitle}>Linked daters</Text>
          <View style={styles.mmSectionDivider} />
          {savedReferrals.length > 0 ? (
            savedReferrals.map((ref, idx) => {
              const palette = LINKED_DATER_AVATAR_PALETTES[idx % LINKED_DATER_AVATAR_PALETTES.length];
              return (
                <View
                  key={`${ref.id || ref.referral_code}-${idx}`}
                  style={[styles.mmLinkedRow, idx > 0 && styles.mmLinkedRowBorder]}
                >
                  <LinkedDaterRowAvatar name={ref.name} firstImage={ref.first_image} palette={palette} />
                  <View style={styles.mmLinkedRowText}>
                    <Text style={styles.mmLinkedName}>{ref.name || 'Dater'}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.mmLinkedRemove}
                    onPress={() => handleDeleteLinkedDater(ref)}
                    disabled={unlinkingDaterId === ref.id}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="close" size={14} color="#B91C1C" />
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <Text style={styles.mmLinkedEmpty}>No linked daters yet.</Text>
          )}
        </View>
      </View>
    );
  };

  const renderDatingPreferences = () => (
    <View style={styles.card}>
      <View style={styles.inlineHeader}>
        <Text style={styles.cardHeader}>Dating Preferences</Text>
        {!editingPreferences ? (
          <TouchableOpacity
            onPress={() => {
              setOriginalFormData({ ...formData });
              setEditingPreferences(true);
            }}
          >
            <Ionicons name="create-outline" size={24} color={datingPreferencesAccent} />
          </TouchableOpacity>
        ) : null}
      </View>

      <FormField
        label={
          editingPreferences
            ? `Preferred Age (${formData.preferredAgeMin}-${formData.preferredAgeMax})`
            : 'Preferred Age'
        }
        editing={editingPreferences}
        value={`${formData.preferredAgeMin || ''} - ${formData.preferredAgeMax || ''}`}
        input={
          editingPreferences ? (
            <View style={styles.sliderContainer}>
              <MultiSlider
                values={[
                  Number(formData.preferredAgeMin) || 18,
                  Number(formData.preferredAgeMax) || 60,
                ]}
                min={18}
                max={100}
                step={1}
                sliderLength={280}
                onValuesChange={(values) => {
                  handleInputChangeWrapper('preferredAgeMin', values[0].toString());
                  handleInputChangeWrapper('preferredAgeMax', values[1].toString());
                }}
                selectedStyle={{ backgroundColor: datingPreferencesAccent }}
                unselectedStyle={{ backgroundColor: '#E5E7EB' }}
                markerStyle={[styles.sliderMarker, { backgroundColor: datingPreferencesAccent }]}
                trackStyle={styles.sliderTrack}
              />
            </View>
          ) : null
        }
      />

      <FormField
        label="Preferred Gender(s)"
        editing={editingPreferences}
        value={(formData.preferredGenders || []).join(', ')}
        input={
          editingPreferences ? (
            <MultiSelectGender
              selected={formData.preferredGenders || []}
              onChange={(newList) => handleInputChangeWrapper('preferredGenders', newList)}
              accentColor={datingPreferencesAccent}
            />
          ) : null
        }
      />

      <FormField
        label={
          editingPreferences ? `Match Radius (${displayRadius} ${radiusUnit})` : `Match Radius (${radiusUnit})`
        }
        editing={editingPreferences}
        value={ formData.matchWithAll ? '500+' : String(formData.matchRadius)}
        input={
          editingPreferences ? (
            <View style={styles.sliderContainer}>
              <View style={[formData.matchWithAll && { opacity: 0.5 }, { alignItems: 'center', marginTop: 10 }]}>
                <MultiSlider
                  values={[formData.matchRadius]}
                  min={1}
                  max={radiusMax}
                  step={1}
                  sliderLength={280}
                  onValuesChange={(values) => {
                    if (!formData.matchWithAll) {
                      handleInputChangeWrapper('matchRadius', values[0]);
                    }
                  }}
                  selectedStyle={{ backgroundColor: datingPreferencesAccent }}
                  unselectedStyle={{ backgroundColor: '#E5E7EB' }}
                  markerStyle={[styles.sliderMarker, { backgroundColor: datingPreferencesAccent }]}
                  trackStyle={styles.sliderTrack}
                />
              </View>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() =>
                  setFormData((prev) => ({
                    ...prev,
                    matchWithAll: !prev.matchWithAll,
                    matchRadius: !prev.matchWithAll ? 500 : 50,
                  }))
                }
              >
                <View style={[styles.checkbox, formData.matchWithAll && styles.checkboxChecked]}>
                  {formData.matchWithAll && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>No distance limit</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      {editingPreferences ? (
        <View style={styles.formActions}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: datingPreferencesAccent }]}
            onPress={handleSavePreferences}
          >
            <Text style={styles.primaryBtnText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => {
              if (originalFormData) {
                setFormData(originalFormData);
              }
              setEditingPreferences(false);
            }}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  const renderNotifications = () => (
    <View style={styles.card}>
      <Text style={styles.cardHeader}>Notifications</Text>
      <Text style={styles.cardDescription}>
        Turn notifications on first, then choose which alerts you want to receive.
      </Text>
      <View style={styles.notificationToggle}>
        <Text style={styles.notificationLabel}>Enable Notifications</Text>
        <Switch
          value={notificationsEnabled}
          onValueChange={handleNotificationToggle}
          trackColor={{ false: '#E5E7EB', true: accentColor }}
          thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
        />
      </View>
      {notificationsEnabled ? (
        <View style={styles.notificationPreferencesGroup}>
          {visibleNotificationPreferenceItems.map((item) => (
            <View
              key={item.key}
              style={[
                styles.notificationPreferenceRow,
                item.description ? styles.notificationPreferenceRowAlignTop : null,
              ]}
            >
              <View style={styles.notificationLabelBlock}>
                <Text style={styles.notificationLabel}>{item.label}</Text>
                {item.description ? (
                  <Text style={styles.notificationItemHint}>{item.description}</Text>
                ) : null}
              </View>
              <Switch
                value={Boolean(notificationPreferences?.[item.key])}
                onValueChange={(value) => setNotificationPreference(item.key, value)}
                trackColor={{ false: '#E5E7EB', true: accentColor }}
                thumbColor={notificationPreferences?.[item.key] ? '#fff' : '#f4f3f4'}
              />
            </View>
          ))}
        </View>
      ) : null}
      {permissionStatus === 'denied' ? (
        <Text style={styles.permissionWarning}>
          Notifications are disabled in your device settings. Please enable them to receive alerts.
        </Text>
      ) : null}
    </View>
  );

  const renderActiveSection = () => {
    switch (activeSection) {
      case SECTION_KEYS.PERSONAL:
        return renderPersonalInfo();
      case SECTION_KEYS.MANAGE_ACCOUNTS:
        return renderManageAccounts();
      case SECTION_KEYS.REFERRAL:
        return renderReferral();
      case SECTION_KEYS.DATING_PREFERENCES:
        return renderDatingPreferences();
      case SECTION_KEYS.NOTIFICATIONS:
        return renderNotifications();
      case SECTION_KEYS.DELETE_ACCOUNT:
        return renderDeleteAccountSection();
      default:
        return renderSectionList();
    }
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        { backgroundColor: backgroundTint },
        isMatchmaker && styles.containerMatchmaker,
        !isMatchmaker && !activeSection && styles.containerDater,
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {showScreenLogo ? (
        <View style={styles.topArea}>
          <View
            style={[
              styles.screenHeader,
              isMatchmaker && styles.screenHeaderMatchmaker,
              { paddingTop: headerTopPadding },
            ]}
          >
            <Image
              source={require('../../../assets/matchmate_logo.png')}
              style={styles.headerLogo}
              accessibilityLabel="Matchmate logo"
            />
            <View style={styles.headerSpacer} />
          </View>
        </View>
      ) : null}
      <View style={styles.scrollArea}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            ref={settingsScrollRef}
            style={[styles.scrollView, { backgroundColor: backgroundTint }]}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={[
                styles.content,
                isMatchmaker
                  ? activeSection
                    ? { paddingTop: headerTopPadding }
                    : { paddingTop: matchmakerSectionListPaddingTop }
                  : activeSection
                    ? { paddingTop: overlayTopPadding }
                    : { paddingTop: daterSectionListPaddingTop },
              ]}
            >
              {showSettingsBackButton ? (
                <View style={{ height: settingsBackButtonSpacer }} />
              ) : null}
              {renderActiveSection()}
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
        {showSettingsBackButton ? (
          <TouchableOpacity
            style={[
              styles.backRowFixed,
              { top: settingsBackButtonTop, backgroundColor: settingsBackButtonBg },
            ]}
            onPress={exitSubsection}
          >
            <Ionicons name="chevron-back-outline" size={22} color={settingsBackAccent} />
          </TouchableOpacity>
        ) : null}
      </View>

      {Platform.OS === 'ios' && activeSection ? (
        <PanGestureHandler
          enabled
          activeOffsetX={[-9999, 14]}
          failOffsetY={[-32, 32]}
          onHandlerStateChange={({ nativeEvent }) => {
            if (nativeEvent.state === State.END && nativeEvent.translationX > 56) {
              exitSubsection();
            }
          }}
        >
          <View pointerEvents="box-only" style={styles.leftEdgeSwipeHitArea} />
        </PanGestureHandler>
      ) : null}

      <Modal
        visible={showReferralModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReferralModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create Matchmaker Account</Text>
              <Text style={styles.modalSubtitle}>Enter a referral code to continue.</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter referral code"
                value={referralInput}
                onChangeText={setReferralInput}
                autoCapitalize="none"
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setShowReferralModal(false);
                    setReferralInput('');
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: accentColor }]} onPress={submitCreateMatchmaker}>
                  <Text style={styles.primaryBtnText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showDeleteAccountModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteAccountModal(false);
          setDeleteModalForBothRoles(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {deleteModalForBothRoles ? 'Delete Both Accounts' : 'Confirm Account Deletion'}
            </Text>
            <Text style={styles.modalDescription}>
              {deleteModalForBothRoles
                ? 'This will permanently remove your Dater and Matchmaker profiles and all associated data. This cannot be undone.'
                : 'This action cannot be undone. All your data will be permanently deleted.'}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowDeleteAccountModal(false);
                  setDeleteModalForBothRoles(false);
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={confirmDeleteAccount}>
                <Text style={styles.deleteBtnText}>
                  {deleteModalForBothRoles ? 'Delete Both' : 'Delete Account'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showIdentifierVerificationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowIdentifierVerificationModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Verify New {pendingIdentifierKind === 'phone' ? 'Phone Number' : 'Email'}
            </Text>
            <Text style={styles.modalDescription}>
              {pendingIdentifierKind === 'phone'
                ? `Enter the verification code texted to ${pendingIdentifier || 'your new phone number'}.`
                : `Enter the verification code emailed to ${pendingIdentifier || 'your new email'}.`}
            </Text>
            <TextInput
              style={styles.input}
              value={identifierVerificationCode}
              onChangeText={setIdentifierVerificationCode}
              placeholder="Enter verification code"
              placeholderTextColor="#111827"
              autoCapitalize="none"
              keyboardType="number-pad"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowIdentifierVerificationModal(false);
                  setIdentifierVerificationCode('');
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: accentColor }]}
                onPress={handleVerifyIdentifierChange}
              >
                <Text style={styles.primaryBtnText}>Verify</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDaterInviteEmailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDaterInviteEmailModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Email dater invite</Text>
              <Text style={styles.modalDescription}>
                We’ll email them a link to sign up as a dater linked to you.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter email address"
                placeholderTextColor="#111827"
                value={daterInviteEmailInput}
                onChangeText={setDaterInviteEmailInput}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setShowDaterInviteEmailModal(false);
                    setDaterInviteEmailInput('');
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: accentColor }]} onPress={sendDaterInviteEmail}>
                  <Text style={styles.primaryBtnText}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showEmailInviteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEmailInviteModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Invite by Email</Text>
              <Text style={styles.modalDescription}>
                Send your referral code directly to your matchmaker.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter email address"
                placeholderTextColor="#111827"
                value={emailInviteInput}
                onChangeText={setEmailInviteInput}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setShowEmailInviteModal(false);
                    setEmailInviteInput('');
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: accentColor }]} onPress={sendEmailInvite}>
                  <Text style={styles.primaryBtnText}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingTop: 40,
  },
  containerMatchmaker: {
    paddingTop: 0,
  },
  containerDater: {
    paddingTop: 0,
  },
  topArea: {
    backgroundColor: 'transparent',
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  screenHeaderMatchmaker: {
    backgroundColor: 'transparent',
    paddingBottom: 0,
  },
  headerLogo: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
    position: 'relative',
  },
  contentContainer: {
    paddingBottom: 24,
  },
  content: {
    padding: 20,
    paddingTop: 56,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#222',
    marginBottom: 20,
  },
  titleSpacer: {
    height: 33,
    marginBottom: 20,
  },
  backRowFixed: {
    position: 'absolute',
    left: 20,
    zIndex: 2000,
    elevation: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  sectionButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionItemWrap: {
    marginBottom: 12,
  },
  sectionButtonHighlighted: {
    borderWidth: 2,
    borderColor: '#6c5ce7',
    shadowColor: '#6c5ce7',
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionTextWrap: {
    marginLeft: 10,
    flex: 1,
  },
  sectionText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  linkedDatersHintBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#D8B4FE',
    backgroundColor: '#F3E8FF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkedDatersHintText: {
    flex: 1,
    color: '#5B21B6',
    fontSize: 13,
    fontWeight: '600',
  },
  linkedDatersHintClose: {
    marginLeft: 10,
    padding: 2,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  manageAccountsMatchmakerPad: {
    paddingTop: 32,
  },
  subCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  subCardHeader: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  currentValueLabel: {
    color: '#6B7280',
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  currentValue: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  cardHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  cardDescription: {
    color: '#6B7280',
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#111827',
  },
  passwordInputWrapper: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 88,
  },
  passwordToggleBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  passwordToggleText: {
    color: '#6c5ce7',
    fontSize: 12,
    fontWeight: '700',
  },
  passwordRulesContainer: {
    marginTop: -6,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  passwordRulesTitle: {
    fontSize: 13,
    color: '#4A4A68',
    fontWeight: '600',
    marginBottom: 4,
  },
  passwordRuleText: {
    fontSize: 12,
    marginBottom: 2,
  },
  passwordRulePending: {
    color: '#6B7280',
  },
  passwordRulePassed: {
    color: '#16A34A',
  },
  inputErrorText: {
    color: '#E53E3E',
    fontSize: 13,
    marginTop: -8,
    marginBottom: 8,
    marginLeft: 4,
  },
  primaryBtn: {
    backgroundColor: '#6c5ce7',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  matchmakerReferralStack: {
    gap: 14,
  },
  mmLinkedCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  mmInviteTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  mmInviteSubtitle: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 16,
    lineHeight: 20,
  },
  mmQuickActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  mmQuickAction: {
    flex: 1,
    minHeight: 78,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mmQuickActionPrimary: {
    backgroundColor: MM_LINKED_LIGHT_PURPLE,
  },
  mmQuickActionMuted: {
    backgroundColor: MM_LINKED_BEIGE,
  },
  mmQuickActionLabelPrimary: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: MM_LINKED_PURPLE,
    textAlign: 'center',
  },
  mmQuickActionLabelMuted: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: MM_LINKED_PURPLE,
    textAlign: 'center',
  },
  mmSectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginVertical: 18,
  },
  mmReferralByCodeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  mmReferralInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mmReferralInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fff',
  },
  mmAddReferralBtn: {
    backgroundColor: MM_LINKED_PURPLE,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mmAddReferralBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  mmLinkedListTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 0,
  },
  mmLinkedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  mmLinkedRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  mmLinkedAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  mmLinkedAvatarImage: {
    width: 44,
    height: 44,
  },
  mmLinkedAvatarLetter: {
    fontSize: 18,
    fontWeight: '700',
  },
  mmLinkedRowText: {
    flex: 1,
    minWidth: 0,
  },
  mmLinkedName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  mmLinkedRemove: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: MM_LINKED_REMOVE_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mmLinkedEmpty: {
    color: '#9CA3AF',
    fontSize: 14,
    paddingVertical: 8,
    fontStyle: 'italic',
  },
  iconActionBtnDisabled: {
    opacity: 0.55,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoLabel: {
    color: '#6B7280',
    fontSize: 14,
    marginRight: 8,
  },
  infoValue: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  secondarySectionTitle: {
    marginTop: 18,
    marginBottom: 10,
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dangerOutlineBtn: {
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  dangerOutlineBtnText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  referralCodeBox: {
    borderWidth: 2,
    borderColor: '#6c5ce7',
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
  },
  referralCodeText: {
    color: '#6c5ce7',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 1,
    textAlign: 'center',
  },
  actionButtonGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  iconActionBtn: {
    minWidth: 86,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  iconActionText: {
    marginTop: 4,
    color: '#6c5ce7',
    fontSize: 12,
    fontWeight: '700',
  },
  referralInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  referralInput: {
    flex: 1,
    marginBottom: 0,
    marginRight: 8,
  },
  saveBtn: {
    backgroundColor: '#6c5ce7',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  referralItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  referralInfo: {
    flex: 1,
    marginRight: 10,
  },
  referralName: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 14,
  },
  referralTag: {
    color: '#6c5ce7',
    fontWeight: '700',
    fontSize: 12,
  },
  linkedDaterDeleteBtn: {
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 999,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
  },
  emptyState: {
    color: '#6B7280',
    fontStyle: 'italic',
  },
  inlineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  sliderMarker: {
    backgroundColor: '#ef4d73',
    height: 22,
    width: 22,
    borderRadius: 11,
  },
  sliderTrack: {
    height: 6,
    borderRadius: 3,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#ef4d73',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#ef4d73',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  notificationToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  notificationLabel: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '500',
  },
  notificationPreferencesGroup: {
    marginTop: 16,
    gap: 12,
  },
  notificationPreferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  notificationPreferenceRowAlignTop: {
    alignItems: 'flex-start',
  },
  notificationLabelBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  notificationItemHint: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  permissionWarning: {
    marginTop: 10,
    color: '#DC2626',
    fontSize: 12,
    fontStyle: 'italic',
  },
  signOutBtn: {
    marginTop: 24,
    backgroundColor: '#E53E3E',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  deleteAccountActions: {
    marginTop: 16,
    gap: 12,
  },
  deleteAccountBtnInGroup: {
    marginTop: 0,
    marginBottom: 0,
  },
  deleteBothAccountsBtn: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#DC2626',
  },
  deleteBothAccountsBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  modalSubtitle: {
    color: '#6B7280',
    marginBottom: 12,
    fontSize: 14,
  },
  modalDescription: {
    color: '#6B7280',
    marginBottom: 16,
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  deleteBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  leftEdgeSwipeHitArea: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 28,
    zIndex: 1000,
    backgroundColor: 'transparent',
  },
});

export default SettingsSections;
