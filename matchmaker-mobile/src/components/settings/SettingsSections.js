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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { API_BASE_URL, FRONTEND_URL } from '../../env';
import FormField from '../profile/components/formField';
import MultiSelectGender from '../profile/components/multiSelectGender';
import { useNotifications } from '../../context/NotificationContext';
import { getRoleAccentColor, getRoleBackgroundTint } from '../layout/components/RoleHeaderBanner';
import { UserContext } from '../../context/UserContext';

const SECTION_KEYS = {
  PERSONAL: 'personal',
  MANAGE_ACCOUNTS: 'manageAccounts',
  REFERRAL: 'referral',
  DATING_PREFERENCES: 'datingPreferences',
  NOTIFICATIONS: 'notifications',
};

const getPasswordChecks = (value) => ({
  minLength: (value || '').length >= 8,
  hasUppercase: /[A-Z]/.test(value || ''),
  hasLowercase: /[a-z]/.test(value || ''),
  hasSpecial: /[^A-Za-z0-9]/.test(value || ''),
});

const buildDaterInviteSignupUrl = (inviteToken) => {
  const frontendUrl = (FRONTEND_URL || 'https://matchmatedating.com').replace(/\/+$/, '');
  const baseUrl = `${frontendUrl}/dater-signup.html`;
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}invite_token=${encodeURIComponent(String(inviteToken))}`;
};

const SettingsSections = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { setUser: setContextUser } = useContext(UserContext);
  const { notificationsEnabled, enableNotifications, disableNotifications, permissionStatus } = useNotifications();

  const [activeSection, setActiveSection] = useState(null);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [savedReferrals, setSavedReferrals] = useState([]);
  const [referralCode, setReferralCode] = useState('');
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralInput, setReferralInput] = useState('');
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [showEmailVerificationModal, setShowEmailVerificationModal] = useState(false);
  const [emailVerificationCode, setEmailVerificationCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [showEmailInviteModal, setShowEmailInviteModal] = useState(false);
  const [emailInviteInput, setEmailInviteInput] = useState('');
  const [showLinkedDatersOnboarding, setShowLinkedDatersOnboarding] = useState(false);
  const [cachedDaterInviteUrl, setCachedDaterInviteUrl] = useState('');
  const [daterInviteLinkLoading, setDaterInviteLinkLoading] = useState(false);
  const [showDaterInviteEmailModal, setShowDaterInviteEmailModal] = useState(false);
  const [daterInviteEmailInput, setDaterInviteEmailInput] = useState('');

  const [currentEmail, setCurrentEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [confirmNewEmail, setConfirmNewEmail] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isNewPasswordFocused, setIsNewPasswordFocused] = useState(false);
  const newEmailInputRef = useRef(null);
  const confirmNewEmailInputRef = useRef(null);
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
  const overlayTopPadding = role === 'matchmaker' ? 120 : 56;
  const accentColor = getRoleAccentColor(role || 'matchmaker');
  const backgroundTint = getRoleBackgroundTint(role || 'matchmaker');

  const sectionItems = useMemo(() => {
    const base = [
      {
        key: SECTION_KEYS.PERSONAL,
        label: 'Personal Information',
        description: 'Update your email and password.',
        icon: 'person-outline',
      },
      {
        key: SECTION_KEYS.MANAGE_ACCOUNTS,
        label: 'Manage Accounts',
        description: 'Add, switch, or remove linked account types.',
        icon: 'people-outline',
      },
      {
        key: SECTION_KEYS.REFERRAL,
        label: role === 'matchmaker' ? 'Manage Linked Daters' : 'Referral Code',
        description: role === 'matchmaker'
          ? 'Link and manage your connected daters.'
          : 'Copy, share, or email your referral code.',
        icon: 'gift-outline',
      },
      {
        key: SECTION_KEYS.NOTIFICATIONS,
        label: 'Notifications',
        description: 'Control push notification preferences.',
        icon: 'notifications-outline',
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
  }, [role]);

  const fetchUserProfile = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
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
          Alert.alert('Session expired', 'Please log in again.');
          navigation.navigate('Login');
          return;
        }
      }

      if (!res.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const data = await res.json();
      setUser(data.user);
      setContextUser(data.user);
      setRole(data.user.role);
      setCurrentEmail(data.user.email || '');
      setNewEmail('');
      setConfirmNewEmail('');
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
        const linkedRes = await fetch(`${API_BASE_URL}/referral/referrals/${data.user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (linkedRes.ok) {
          const linkedData = await linkedRes.json();
          setSavedReferrals(linkedData.linked_daters || []);
        }
      } else {
        setSavedReferrals([]);
      }

      await AsyncStorage.setItem('user', JSON.stringify(data.user));
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load settings');
    }
  }, [navigation, setContextUser]);

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

  const handleSaveEmail = async () => {
    try {
      const nextEmail = newEmail.trim().toLowerCase();
      if (!nextEmail) {
        Alert.alert('Error', 'Please enter a new email');
        return;
      }
      if (!confirmNewEmail.trim()) {
        Alert.alert('Error', 'Please confirm your new email');
        return;
      }
      if (nextEmail !== confirmNewEmail.trim().toLowerCase()) {
        Alert.alert('Error', 'New email and confirmation email must match');
        return;
      }
      if (nextEmail === (currentEmail || '').trim().toLowerCase()) {
        Alert.alert('Error', 'Please enter an email different from your current email');
        return;
      }

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/profile/request_email_change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ new_email: nextEmail }),
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
        const errorData = await res.json().catch(() => ({}));
        Alert.alert('Error', errorData.error || 'Failed to send verification code');
        return;
      }

      setPendingEmail(nextEmail);
      setEmailVerificationCode('');
      setShowEmailVerificationModal(true);
      Alert.alert('Verification Required', 'A verification code was sent to your new email.');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to send verification code');
    }
  };

  const handleVerifyEmailChange = async () => {
    try {
      const code = emailVerificationCode.trim();
      if (!code) {
        Alert.alert('Error', 'Please enter the verification code');
        return;
      }
      if (!pendingEmail) {
        Alert.alert('Error', 'No pending email change found');
        return;
      }

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/profile/verify_email_change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          new_email: pendingEmail,
          code,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        Alert.alert('Error', errorData.error || 'Failed to verify code');
        return;
      }

      setCurrentEmail(pendingEmail);
      setNewEmail('');
      setConfirmNewEmail('');
      setPendingEmail('');
      setEmailVerificationCode('');
      setShowEmailVerificationModal(false);
      Alert.alert('Success', 'Email updated successfully');
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
          Alert.alert('Session expired', 'Please log in again.');
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

  const handleCreateDaterAccount = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/profile/create_linked_dater`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        Alert.alert('Error', data.error || 'Failed to create dater account');
        return;
      }

      const data = await res.json();
      if (data.token) {
        await AsyncStorage.setItem('token', data.token);
      }
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      setContextUser(data.user);
      Alert.alert('Success', 'Dater account created successfully');
      navigation.navigate('CompleteProfile');
      fetchUserProfile();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to create dater account');
    }
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
      Alert.alert('Success', 'Matchmaker account created successfully');
      fetchUserProfile();
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
      Alert.alert('Success', `Switched to ${data.user.role} account`);
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

              Alert.alert('Success', data.message || `${roleLabel} account deleted successfully`);
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
      Alert.alert('Error', 'Please log in');
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
        Alert.alert('Session expired', 'Please log in again.');
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
      Alert.alert('Copied', 'Invite link copied to clipboard.');
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
          Alert.alert('Session expired', 'Please log in again.');
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
      await Share.share({ message: String(referralCode || '') });
    } catch (err) {
      console.error('Error sharing referral code:', err);
      Alert.alert('Error', 'Failed to share referral code');
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
    const code = referralCode.trim();
    if (!code) {
      Alert.alert('Error', 'Please enter a referral code');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/referral/link_referral`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ referral_code: code }),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Error', data.error || 'Failed to link referral');
        return;
      }

      let name = data.message.split(' linked')[0];
      name = name.replace(/^Dater\s*/i, '').trim();
      const newDater = { id: data.linked_dater_id, name, referral_code: code };
      setSavedReferrals((prev) => [...prev, newDater]);
      setReferralCode('');
      await fetchUserProfile();
      Alert.alert('Success', 'Referral code linked successfully');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to link referral');
    }
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
            try {
              const token = await AsyncStorage.getItem('token');
              if (!token) {
                Alert.alert('Error', 'Please log in');
                navigation.navigate('Login');
                return;
              }

              const res = await fetch(`${API_BASE_URL}/referral/unlink_dater`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ linked_dater_id: linkedDater.id }),
              });

              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                Alert.alert('Error', data.error || 'Failed to remove linked dater');
                return;
              }

              setSavedReferrals(data.linked_daters || []);
              Alert.alert('Success', 'Linked dater removed successfully');
              fetchUserProfile();
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'Failed to remove linked dater');
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

      Alert.alert('Success', 'Dating preferences updated successfully');
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
          'Please enable notifications in your device settings to receive notifications for new messages and matches.'
        );
      }
    } else {
      disableNotifications();
    }
  };

  const handleSignOut = async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('staySignedIn');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', style: 'destructive', onPress: () => setShowDeleteAccountModal(true) },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
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
        const errorData = await res.json().catch(() => ({}));
        Alert.alert('Error', errorData.error || 'Failed to delete account');
        return;
      }

      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('staySignedIn');
      setShowDeleteAccountModal(false);
      Alert.alert('Account Deleted', 'Your account has been permanently deleted.', [
        {
          text: 'OK',
          onPress: () =>
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            }),
        },
      ]);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to delete account');
    }
  };

  const renderSectionList = () => (
    <View>
      <View style={styles.titleSpacer} />
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

      <TouchableOpacity style={styles.deleteAccountBtn} onPress={handleDeleteAccount}>
        <Text style={styles.deleteAccountBtnText}>Delete Account</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPersonalInfo = () => (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Personal Information</Text>
        <Text style={styles.cardDescription}>
          Update your email and password in separate sections below.
        </Text>
      </View>

      <View style={styles.subCard}>
        <Text style={styles.subCardHeader}>Change Email</Text>
        <Text style={styles.currentValueLabel}>Current Email</Text>
        <Text style={styles.currentValue}>{currentEmail || 'Not available'}</Text>
        <TextInput
          ref={newEmailInputRef}
          style={styles.input}
          value={newEmail}
          onChangeText={setNewEmail}
          placeholder="New Email"
          placeholderTextColor="#111827"
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => confirmNewEmailInputRef.current?.focus()}
        />
        <TextInput
          ref={confirmNewEmailInputRef}
          style={styles.input}
          value={confirmNewEmail}
          onChangeText={setConfirmNewEmail}
          placeholder="Confirm New Email"
          placeholderTextColor="#111827"
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={handleSaveEmail}
        />
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: accentColor }]} onPress={handleSaveEmail}>
          <Text style={styles.primaryBtnText}>Save New Email</Text>
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

          <Text style={styles.secondarySectionTitle}>Delete Account Type</Text>
          <TouchableOpacity
            style={styles.dangerOutlineBtn}
            onPress={() => handleDeleteAccountByRole('user')}
          >
            <Text style={styles.dangerOutlineBtnText}>Delete Dater Account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dangerOutlineBtn}
            onPress={() => handleDeleteAccountByRole('matchmaker')}
          >
            <Text style={styles.dangerOutlineBtnText}>Delete Matchmaker Account</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderReferral = () => {
    if (role === 'user') {
      return (
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Referral Code</Text>
          <Text style={styles.cardDescription}>Share your referral code with your matchmaker.</Text>
          <View style={[styles.referralCodeBox, { borderColor: accentColor }]}>
            <Text style={[styles.referralCodeText, { color: accentColor }]}>{referralCode || 'No code available'}</Text>
          </View>
          <View style={styles.actionButtonGroup}>
            <TouchableOpacity style={styles.iconActionBtn} onPress={handleCopyReferralCode}>
              <Ionicons name="copy-outline" size={20} color={accentColor} />
              <Text style={[styles.iconActionText, { color: accentColor }]}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconActionBtn} onPress={handleShareReferralCode}>
              <Ionicons name="share-outline" size={20} color={accentColor} />
              <Text style={[styles.iconActionText, { color: accentColor }]}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconActionBtn} onPress={handleOpenEmailInvite}>
              <Ionicons name="mail-outline" size={20} color={accentColor} />
              <Text style={[styles.iconActionText, { color: accentColor }]}>Email</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.matchmakerReferralStack}>
        <View style={styles.daterInviteOutlineCard}>
          <Text style={styles.outlineSectionTitle}>Invite a dater</Text>
          <Text style={styles.inviteDaterHint}>
            Share your personal signup link. When they join (or link an existing dater account), they appear in your
            linked daters list.
          </Text>
          <View style={[styles.referralCodeBox, styles.daterInviteLinkBox, { borderColor: accentColor }]}>
            <Text
              style={[styles.daterInviteLinkPreview, { color: accentColor }]}
              selectable
              numberOfLines={4}
            >
              {cachedDaterInviteUrl ||
                (daterInviteLinkLoading ? 'Preparing your link…' : 'Your invite link will load here')}
            </Text>
          </View>
          <View style={styles.actionButtonGroup}>
            <TouchableOpacity
              style={[styles.iconActionBtn, daterInviteLinkLoading && styles.iconActionBtnDisabled]}
              onPress={handleCopyDaterInviteLink}
              disabled={daterInviteLinkLoading}
            >
              <Ionicons name="copy-outline" size={20} color={accentColor} />
              <Text style={[styles.iconActionText, { color: accentColor }]}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconActionBtn, daterInviteLinkLoading && styles.iconActionBtnDisabled]}
              onPress={handleTextDaterInviteLink}
              disabled={daterInviteLinkLoading}
            >
              <Ionicons name="chatbubble-outline" size={20} color={accentColor} />
              <Text style={[styles.iconActionText, { color: accentColor }]}>Text</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconActionBtn} onPress={handleOpenDaterInviteEmailModal}>
              <Ionicons name="mail-outline" size={20} color={accentColor} />
              <Text style={[styles.iconActionText, { color: accentColor }]}>Email</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.linkedDatersOutlineCard}>
          <Text style={styles.outlineSectionTitle}>Manage linked daters</Text>
          <Text style={styles.cardDescription}>
            Add an existing dater by entering their referral code.
          </Text>
          <View style={styles.referralInputRow}>
            <TextInput
              style={[styles.input, styles.referralInput]}
              value={referralCode}
              onChangeText={setReferralCode}
              placeholder="Enter referral code"
            />
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: accentColor }]} onPress={handleLinkReferral}>
              <Text style={styles.saveBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          {savedReferrals.length > 0 ? (
            savedReferrals.map((ref, idx) => (
              <View key={`${ref.referral_code}-${idx}`} style={styles.referralItem}>
                <View style={styles.referralInfo}>
                  <Text style={styles.referralName}>{ref.name}</Text>
                  <Text style={styles.referralTag}>{ref.referral_code}</Text>
                </View>
                <TouchableOpacity
                  style={styles.linkedDaterDeleteBtn}
                  onPress={() => handleDeleteLinkedDater(ref)}
                >
                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.emptyState}>No linked daters yet.</Text>
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
            <Ionicons name="create-outline" size={24} color={accentColor} />
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
                selectedStyle={{ backgroundColor: accentColor }}
                unselectedStyle={{ backgroundColor: '#E5E7EB' }}
                markerStyle={[styles.sliderMarker, { backgroundColor: accentColor }]}
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
                  selectedStyle={{ backgroundColor: accentColor }}
                  unselectedStyle={{ backgroundColor: '#E5E7EB' }}
                  markerStyle={[styles.sliderMarker, { backgroundColor: accentColor }]}
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
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: accentColor }]} onPress={handleSavePreferences}>
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
        Manage push notifications for new messages and matches.
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
      default:
        return renderSectionList();
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: backgroundTint }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          ref={settingsScrollRef}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.content, { paddingTop: overlayTopPadding }]}>
            {activeSection ? (
              <TouchableOpacity style={styles.backRow} onPress={() => setActiveSection(null)}>
                <Ionicons name="chevron-back-outline" size={20} color={accentColor} />
                <Text style={[styles.backText, { color: accentColor }]}>Back to Settings</Text>
              </TouchableOpacity>
            ) : null}
            {renderActiveSection()}
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>

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
        onRequestClose={() => setShowDeleteAccountModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Account Deletion</Text>
            <Text style={styles.modalDescription}>
              This action cannot be undone. All your data will be permanently deleted.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDeleteAccountModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={confirmDeleteAccount}>
                <Text style={styles.deleteBtnText}>Delete Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEmailVerificationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmailVerificationModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Verify New Email</Text>
            <Text style={styles.modalDescription}>
              Enter the verification code sent to {pendingEmail || 'your new email'}.
            </Text>
            <TextInput
              style={styles.input}
              value={emailVerificationCode}
              onChangeText={setEmailVerificationCode}
              placeholder="Enter verification code"
              placeholderTextColor="#111827"
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowEmailVerificationModal(false);
                  setEmailVerificationCode('');
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: accentColor }]} onPress={handleVerifyEmailChange}>
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
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 40,
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
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backText: {
    color: '#6c5ce7',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
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
  matchmakerReferralStack: {},
  daterInviteOutlineCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  linkedDatersOutlineCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  outlineSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  daterInviteLinkBox: {
    marginBottom: 14,
  },
  daterInviteLinkPreview: {
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
  },
  iconActionBtnDisabled: {
    opacity: 0.55,
  },
  inviteDaterHint: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
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
    backgroundColor: '#6c5ce7',
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
    borderColor: '#6c5ce7',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6c5ce7',
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
  deleteAccountBtn: {
    marginTop: 16,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  deleteAccountBtnText: {
    color: '#DC2626',
    fontWeight: '600',
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
});

export default SettingsSections;
