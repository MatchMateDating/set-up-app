import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FaArrowLeft,
  FaChevronRight,
  FaCopy,
  FaShare,
  FaEnvelope,
  FaUser,
  FaUsers,
  FaGift,
  FaHeart,
  FaBell,
  FaTrash,
  FaEdit,
  FaEye,
  FaEyeSlash,
  FaTimes,
  FaPuzzlePiece,
} from 'react-icons/fa';
import Select from 'react-select';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../layout/AppShell';
import { useUser } from '../../context/UserContext';
import AgeRangeSlider from '../preferences/ageRangeSlider';
import './settings.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
const FRONTEND_URL = (
  process.env.REACT_APP_FRONTEND_URL ||
  process.env.REACT_APP_SIGNUP_URL ||
  'https://matchmatedating.com'
).replace(/\/+$/, '');

const SECTION_KEYS = {
  PERSONAL: 'personal',
  MANAGE_ACCOUNTS: 'manageAccounts',
  REFERRAL: 'referral',
  DATING_PREFERENCES: 'datingPreferences',
  NOTIFICATIONS: 'notifications',
  DELETE_ACCOUNT: 'deleteAccount',
};

const DEFAULT_NOTIFICATION_PREFERENCES = {
  newMatchNotification: false,
  newBlindMatchNotification: false,
  newMessageNotification: false,
  approvedMatchMessageNotification: false,
  newMatchApprovalNotification: false,
};

const ENABLED_NOTIFICATION_PREFERENCES = {
  newMatchNotification: true,
  newBlindMatchNotification: true,
  newMessageNotification: true,
  approvedMatchMessageNotification: true,
  newMatchApprovalNotification: true,
};

const NOTIFICATION_PREFERENCE_ITEMS = [
  { key: 'newMatchNotification', label: 'New Match' },
  { key: 'newBlindMatchNotification', label: 'New Blind Match', daterOnly: true },
  { key: 'newMessageNotification', label: 'New Message' },
  {
    key: 'approvedMatchMessageNotification',
    label: 'Approved Match Messages',
    description:
      'When off, you will still get message alerts while a match is waiting for approval.',
    matchmakerOnly: true,
  },
  { key: 'newMatchApprovalNotification', label: 'Approved Match' },
];

const getPasswordChecks = (value) => ({
  minLength: (value || '').length >= 8,
  hasUppercase: /[A-Z]/.test(value || ''),
  hasLowercase: /[a-z]/.test(value || ''),
  hasSpecial: /[^A-Za-z0-9]/.test(value || ''),
});

const phoneDigitsOnly = (value) => (value || '').replace(/\D/g, '');
const isValidPhone = (value) => phoneDigitsOnly(value).length >= 10;
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || '').trim());

const normalizeUsPhoneToE164 = (value) => {
  let digits = phoneDigitsOnly(value);
  if (!digits.startsWith('1') && digits.length === 10) {
    digits = `1${digits}`;
  }
  return `+${digits}`;
};

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
  const baseUrl = `${FRONTEND_URL}/dater-signup.html`;
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}invite_token=${encodeURIComponent(String(inviteToken))}`;
};

const buildNotificationPreferenceState = (userData) => {
  const enabled = Boolean(userData?.notifications_enabled ?? false);
  if (!enabled) {
    return { enabled: false, preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES } };
  }
  const readPreference = (fieldName) => {
    const rawValue = userData?.[fieldName];
    return rawValue == null ? true : Boolean(rawValue);
  };
  return {
    enabled: true,
    preferences: {
      newMatchNotification: readPreference('new_match_notifications'),
      newBlindMatchNotification: readPreference('new_blind_match_notifications'),
      newMessageNotification: readPreference('new_message_notifications'),
      approvedMatchMessageNotification: readPreference('approved_match_message_notifications'),
      newMatchApprovalNotification: readPreference('new_match_approval_notifications'),
    },
  };
};

const buildNotificationPreferencePayload = (enabled, preferences) => {
  if (!enabled) {
    return {
      enabled: false,
      new_match_notifications: false,
      new_blind_match_notifications: false,
      new_message_notifications: false,
      approved_match_message_notifications: false,
      new_match_approval_notifications: false,
    };
  }
  return {
    enabled: true,
    new_match_notifications: Boolean(preferences?.newMatchNotification),
    new_blind_match_notifications: Boolean(preferences?.newBlindMatchNotification),
    new_message_notifications: Boolean(preferences?.newMessageNotification),
    approved_match_message_notifications: Boolean(
      preferences?.approvedMatchMessageNotification
    ),
    new_match_approval_notifications: Boolean(preferences?.newMatchApprovalNotification),
  };
};

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

const SettingsSections = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: contextUser, setUser: setContextUser } = useUser();

  const [activeSection, setActiveSection] = useState(null);
  const [user, setUser] = useState(() => contextUser || null);
  const [role, setRole] = useState(() => contextUser?.role || null);
  const [savedReferrals, setSavedReferrals] = useState([]);
  const [linkedMatchmakers, setLinkedMatchmakers] = useState([]);
  const [referralCode, setReferralCode] = useState('');
  const [linkDaterReferralInput, setLinkDaterReferralInput] = useState('');
  const [linkReferralLoading, setLinkReferralLoading] = useState(false);
  const [unlinkingDaterId, setUnlinkingDaterId] = useState(null);
  const [cachedDaterInviteUrl, setCachedDaterInviteUrl] = useState('');
  const [daterInviteLinkLoading, setDaterInviteLinkLoading] = useState(false);

  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralInput, setReferralInput] = useState('');
  const [showEmailInviteModal, setShowEmailInviteModal] = useState(false);
  const [emailInviteInput, setEmailInviteInput] = useState('');
  const [showDaterInviteEmailModal, setShowDaterInviteEmailModal] = useState(false);
  const [daterInviteEmailInput, setDaterInviteEmailInput] = useState('');
  const [showIdentifierVerificationModal, setShowIdentifierVerificationModal] = useState(false);
  const [identifierVerificationCode, setIdentifierVerificationCode] = useState('');
  const [pendingIdentifier, setPendingIdentifier] = useState('');
  const [pendingIdentifierKind, setPendingIdentifierKind] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteForBothRoles, setDeleteForBothRoles] = useState(false);

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

  const [editingPreferences, setEditingPreferences] = useState(false);
  const editingPreferencesRef = useRef(false);
  const [formData, setFormData] = useState({
    preferredAgeMin: '18',
    preferredAgeMax: '60',
    preferredGenders: [],
    matchRadius: 50,
    matchWithAll: false,
  });

  const setPreferencesEditing = (next) => {
    editingPreferencesRef.current = next;
    setEditingPreferences(next);
  };

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  const [notificationSaving, setNotificationSaving] = useState(false);

  const passwordChecks = getPasswordChecks(newPassword);
  const isPasswordStrong = Object.values(passwordChecks).every(Boolean);

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

  const effectiveRole = role || contextUser?.role || null;

  const sectionItems = useMemo(() => {
    const base = [
      {
        key: SECTION_KEYS.PERSONAL,
        label: 'Personal Information',
        description: 'Update your email, phone number, and password.',
        Icon: FaUser,
      },
      {
        key: SECTION_KEYS.MANAGE_ACCOUNTS,
        label: 'Manage Accounts',
        description: 'Add or switch between linked account types.',
        Icon: FaUsers,
      },
      {
        key: SECTION_KEYS.REFERRAL,
        label: effectiveRole === 'matchmaker' ? 'Manage Linked Daters' : 'Referral Code',
        description:
          effectiveRole === 'matchmaker'
            ? 'Link and manage your connected daters.'
            : 'Share your code and manage who can matchmake for you.',
        Icon: FaGift,
      },
      {
        key: SECTION_KEYS.NOTIFICATIONS,
        label: 'Notifications',
        description: 'Control notification preferences.',
        Icon: FaBell,
      },
      {
        key: 'puzzles',
        label: 'Puzzles Hub',
        description: 'Spirit animal, zodiac, and trivia with matches.',
        Icon: FaPuzzlePiece,
        href: '/puzzles',
      },
      {
        key: SECTION_KEYS.DELETE_ACCOUNT,
        label: 'Delete Account',
        description: user?.linked_account || contextUser?.linked_account
          ? 'Remove an account type or delete all data permanently.'
          : 'Permanently delete your account and data.',
        Icon: FaTrash,
      },
    ];

    // Daters see Dating Preferences between Referral and Notifications.
    if (effectiveRole === 'user') {
      base.splice(3, 0, {
        key: SECTION_KEYS.DATING_PREFERENCES,
        label: 'Dating Preferences',
        description: 'Set preferred age, gender, and match distance.',
        Icon: FaHeart,
      });
    }
    return base;
  }, [effectiveRole, user?.linked_account, contextUser?.linked_account]);

  useEffect(() => {
    const openReferral = searchParams.get('openReferral');
    const requireMatchmaker = searchParams.get('requireMatchmaker');
    if (openReferral === '1' || requireMatchmaker === '1') {
      setActiveSection(SECTION_KEYS.REFERRAL);
      const next = new URLSearchParams(searchParams);
      next.delete('openReferral');
      next.delete('requireMatchmaker');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const visibleNotificationPreferenceItems = useMemo(
    () =>
      NOTIFICATION_PREFERENCE_ITEMS.filter((item) => {
        if (item.daterOnly && role === 'matchmaker') return false;
        if (item.matchmakerOnly && role === 'user') return false;
        return true;
      }),
    [role]
  );

  const clearSessionAndGoLogin = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('selectedDater');
    localStorage.removeItem('activeMatchId');
    setContextUser(null);
    navigate('/', { replace: true });
  }, [navigate, setContextUser]);

  const handleUnauthorized = useCallback(
    async (res) => {
      if (res.status !== 401) return false;
      const data = await res.json().catch(() => ({}));
      if (data.error_code === 'TOKEN_EXPIRED' || data.error_code === 'INVALID_TOKEN') {
        clearSessionAndGoLogin();
        return true;
      }
      return false;
    },
    [clearSessionAndGoLogin]
  );

  const saveNotificationPreferences = useCallback(
    async (enabled, preferences) => {
      const token = localStorage.getItem('token');
      if (!token) return;
      setNotificationSaving(true);
      try {
        const res = await fetch(`${API_BASE_URL}/notifications/preferences`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(buildNotificationPreferencePayload(enabled, preferences)),
        });
        if (await handleUnauthorized(res)) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.error('Failed to save notification preferences', data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setNotificationSaving(false);
      }
    },
    [handleUnauthorized]
  );

  const fetchUserProfile = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/profile/`, {
        headers: authHeaders(),
      });
      if (await handleUnauthorized(res)) return;
      if (!res.ok) throw new Error('Failed to fetch user profile');

      const data = await res.json();
      const nextUser = data.user;
      setUser(nextUser);
      setContextUser(nextUser);
      setRole(nextUser.role);
      setCurrentEmail(nextUser.email || '');
      setCurrentPhone(nextUser.phone_number || '');
      setNewIdentifier('');
      setConfirmNewIdentifier('');
      setReferralCode(nextUser.role === 'user' ? nextUser?.referral_code || '' : '');

      if (!editingPreferencesRef.current) {
        const radiusMiles = Number(nextUser.match_radius);
        const matchWithAll = Number.isFinite(radiusMiles) && radiusMiles >= 9999;
        const safeRadius = Number.isFinite(radiusMiles) && radiusMiles > 0 ? radiusMiles : 50;
        setFormData({
          preferredAgeMin: String(nextUser.preferredAgeMin ?? 18),
          preferredAgeMax: String(nextUser.preferredAgeMax ?? 60),
          preferredGenders: Array.isArray(nextUser.preferredGenders)
            ? nextUser.preferredGenders
            : [],
          matchRadius: matchWithAll ? 500 : safeRadius,
          matchWithAll,
        });
      }

      const notifState = buildNotificationPreferenceState(nextUser);
      setNotificationsEnabled(notifState.enabled);
      setNotificationPreferences(notifState.preferences);

      if (nextUser.role === 'matchmaker') {
        setLinkedMatchmakers([]);
        const linkedRes = await fetch(
          `${API_BASE_URL}/referral/referrals/${nextUser.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (linkedRes.ok) {
          const linkedData = await linkedRes.json();
          setSavedReferrals(linkedData.linked_daters || []);
        }
      } else if (nextUser.role === 'user') {
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

      localStorage.setItem('user', JSON.stringify(nextUser));
    } catch (err) {
      console.error(err);
      alert('Failed to load settings');
    }
  }, [handleUnauthorized, setContextUser]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  // Keep local role/user in sync if context already knows the signed-in account.
  useEffect(() => {
    if (!contextUser) return;
    setUser((prev) => prev || contextUser);
    setRole((prev) => prev || contextUser.role || null);
  }, [contextUser]);

  useEffect(() => {
    if (activeSection !== SECTION_KEYS.REFERRAL || role !== 'matchmaker') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token || cancelled) return;
        const res = await fetch(`${API_BASE_URL}/referral/dater_invite_token`, {
          method: 'POST',
          headers: authHeaders(),
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data.invite_token && !cancelled) {
          setCachedDaterInviteUrl(buildDaterInviteSignupUrl(data.invite_token));
        }
      } catch (err) {
        console.error('Dater invite link prefetch:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSection, role]);

  const handleSaveIdentifier = async () => {
    const trimmedNew = newIdentifier.trim();
    const trimmedConfirm = confirmNewIdentifier.trim();
    if (!trimmedNew) return alert('Please enter a new email or phone number');
    if (!trimmedConfirm) return alert('Please confirm your new email or phone number');

    const newKind = getIdentifierKind(trimmedNew);
    const confirmKind = getIdentifierKind(trimmedConfirm);
    if (!newKind) return alert('Please enter a valid email address or phone number');
    if (!confirmKind) return alert('Please enter a valid confirmation email or phone number');
    if (newKind !== confirmKind) {
      return alert('New email/phone number and confirmation must be the same type');
    }

    const nextIdentifier = normalizeIdentifier(trimmedNew, newKind);
    const confirmIdentifier = normalizeIdentifier(trimmedConfirm, confirmKind);
    if (nextIdentifier !== confirmIdentifier) {
      return alert('New email/phone number and confirmation must match');
    }
    if (nextIdentifier === currentIdentifier) {
      return alert('Please enter an email or phone number different from your current one');
    }

    try {
      const endpoint =
        newKind === 'email' ? '/profile/request_email_change' : '/profile/request_phone_change';
      const body =
        newKind === 'email'
          ? { new_email: nextIdentifier }
          : { new_phone: nextIdentifier };
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (await handleUnauthorized(res)) return;
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return alert(errorData.error || 'Failed to send verification code');
      }
      setPendingIdentifier(nextIdentifier);
      setPendingIdentifierKind(newKind);
      setIdentifierVerificationCode('');
      setShowIdentifierVerificationModal(true);
    } catch (err) {
      console.error(err);
      alert('Failed to send verification code');
    }
  };

  const handleVerifyIdentifierChange = async () => {
    const code = identifierVerificationCode.trim();
    if (!code) return alert('Please enter the verification code');
    if (!pendingIdentifier || !pendingIdentifierKind) {
      return alert('No pending email or phone number change found');
    }

    try {
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
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (await handleUnauthorized(res)) return;
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return alert(errorData.error || 'Failed to verify code');
      }
      if (pendingIdentifierKind === 'email') setCurrentEmail(pendingIdentifier);
      else setCurrentPhone(pendingIdentifier);
      setNewIdentifier('');
      setConfirmNewIdentifier('');
      setPendingIdentifier('');
      setPendingIdentifierKind(null);
      setIdentifierVerificationCode('');
      setShowIdentifierVerificationModal(false);
      alert(
        pendingIdentifierKind === 'email'
          ? 'Email updated successfully'
          : 'Phone number updated successfully'
      );
      fetchUserProfile();
    } catch (err) {
      console.error(err);
      alert('Failed to verify code');
    }
  };

  const handleSavePassword = async () => {
    if (!oldPassword.trim()) return alert('Please enter your current password');
    if (!newPassword.trim()) return alert('Please enter a new password');
    if (!confirmNewPassword.trim()) return alert('Please confirm your new password');
    if (newPassword !== confirmNewPassword) {
      return alert('New password and confirmation must match');
    }
    if (!isPasswordStrong) {
      return alert(
        'Password must be at least 8 characters and include 1 uppercase letter, 1 lowercase letter, and 1 special character.'
      );
    }

    try {
      const res = await fetch(`${API_BASE_URL}/profile/change_password`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      });
      if (await handleUnauthorized(res)) return;
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return alert(errorData.error || 'Failed to update password');
      }
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowOldPassword(false);
      setShowNewPassword(false);
      setShowConfirmNewPassword(false);
      alert('Password updated successfully');
    } catch (err) {
      console.error(err);
      alert('Failed to update password');
    }
  };

  const submitCreateDaterAccount = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/profile/create_linked_dater`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (await handleUnauthorized(res)) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return alert(data.error || 'Failed to create dater account');
      }
      const data = await res.json();
      if (data.token) localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setContextUser(data.user);
      alert('Dater account created successfully');
      navigate('/complete-profile');
      fetchUserProfile();
    } catch (err) {
      console.error(err);
      alert('Failed to create dater account');
    }
  };

  const handleCreateDaterAccount = () => {
    const ok = window.confirm(
      [
        'Create a dater account?',
        '',
        'You are about to create a second profile (dater) that uses the same email and password as your matchmaker account.',
        'After you confirm, you will complete profile setup.',
        '',
        'You can switch between your matchmaker and dater accounts later from Settings.',
      ].join('\n')
    );
    if (ok) void submitCreateDaterAccount();
  };

  const submitCreateMatchmaker = async () => {
    const trimmedReferralCode = referralInput.trim();
    if (!trimmedReferralCode) return alert('Please enter a referral code');

    const daterFirstName = String(user?.first_name || '').trim();
    const daterLastName = String(user?.last_name || '').trim();
    const daterBirthdate = user?.birthdate;
    if (!daterFirstName || !daterLastName || !daterBirthdate) {
      return alert(
        'Finish your dater profile (name and birthdate) before creating a matchmaker account.'
      );
    }

    const ownReferralCode = String(user?.referral_code || '').trim();
    if (ownReferralCode && trimmedReferralCode.toLowerCase() === ownReferralCode.toLowerCase()) {
      return alert("You can't use your own referral code to create a matchmaker account");
    }

    try {
      const res = await fetch(`${API_BASE_URL}/profile/create_linked_matchmaker`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ referral_code: trimmedReferralCode }),
      });
      if (await handleUnauthorized(res)) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return alert(data.error || 'Failed to create matchmaker account');
      }
      const data = await res.json();
      if (data.token) localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setContextUser(data.user);
      setShowReferralModal(false);
      setReferralInput('');
      if (data.user?.profile_completion_step) {
        navigate('/complete-profile');
      } else {
        fetchUserProfile();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to create matchmaker account');
    }
  };

  const handleSwitchAccount = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/profile/switch_account`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (await handleUnauthorized(res)) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return alert(data.error || 'Failed to switch account');
      }
      const data = await res.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setContextUser(data.user);
      setActiveSection(null);
      fetchUserProfile();
    } catch (err) {
      console.error(err);
      alert('Failed to switch account');
    }
  };

  const handleDeleteAccountByRole = async (targetRole) => {
    const roleLabel = targetRole === 'user' ? 'Dater' : 'Matchmaker';
    const deletingCurrent = role === targetRole;
    const confirmationMessage = deletingCurrent
      ? `Delete your ${roleLabel} account? You will be switched to your other linked account.`
      : `Delete your linked ${roleLabel} account?`;
    if (!window.confirm(confirmationMessage)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/profile/delete_account_by_role`, {
        method: 'DELETE',
        headers: authHeaders(),
        body: JSON.stringify({ role: targetRole }),
      });
      if (await handleUnauthorized(res)) return;
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return alert(errorData.error || `Failed to delete ${roleLabel} account`);
      }
      const data = await res.json();
      if (data.token) localStorage.setItem('token', data.token);
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        setContextUser(data.user);
      }
      setActiveSection(null);
      fetchUserProfile();
    } catch (err) {
      console.error(err);
      alert(`Failed to delete ${roleLabel} account`);
    }
  };

  const confirmDeleteAccount = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/profile/delete_account`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (await handleUnauthorized(res)) return;
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return alert(errorData.error || 'Failed to delete account');
      }
      setShowDeleteConfirm(false);
      clearSessionAndGoLogin();
    } catch (err) {
      console.error(err);
      alert('Failed to delete account');
    }
  };

  const handleCopyReferralCode = async () => {
    try {
      await navigator.clipboard.writeText(String(referralCode || ''));
      alert('Referral code copied to clipboard.');
    } catch (err) {
      console.error(err);
      alert('Failed to copy referral code');
    }
  };

  const handleShareReferralCode = async () => {
    const baseSignupUrl = `${FRONTEND_URL}/matchmaker-signup.html`;
    const separator = baseSignupUrl.includes('?') ? '&' : '?';
    const shareUrl = `${baseSignupUrl}${separator}referral_code=${encodeURIComponent(
      String(referralCode || '')
    )}`;
    const shareData = {
      title: 'Join MatchMate as my matchmaker',
      text: `Join MatchMate as my matchmaker:\n${shareUrl}`,
      url: shareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert('Invite link copied to clipboard.');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error(err);
        alert('Failed to share referral code');
      }
    }
  };

  const fetchFreshDaterInviteUrl = async () => {
    const res = await fetch(`${API_BASE_URL}/referral/dater_invite_token`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (await handleUnauthorized(res)) return null;
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Could not create invite link');
      return null;
    }
    const data = await res.json();
    if (!data.invite_token) {
      alert('Could not create invite link');
      return null;
    }
    return buildDaterInviteSignupUrl(data.invite_token);
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
      await navigator.clipboard.writeText(url);
      alert('Invite link copied to clipboard.');
    } catch (err) {
      console.error(err);
      alert('Failed to copy invite link');
    }
  };

  const handleShareDaterInviteLink = async () => {
    if (daterInviteLinkLoading) return;
    try {
      const url = await ensureDaterInviteUrl();
      if (!url) return;
      if (navigator.share) {
        await navigator.share({
          title: 'Join MatchMate',
          text: `Join MatchMate as a dater I'm matching for:\n${url}`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Invite link copied to clipboard.');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error(err);
        alert('Failed to share invite link');
      }
    }
  };

  const sendEmailInvite = async () => {
    if (!emailInviteInput.trim()) return alert('Please enter an email address');
    try {
      const res = await fetch(`${API_BASE_URL}/invite/email`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          email: emailInviteInput.trim(),
          referralCode: String(referralCode || user?.referral_code || ''),
        }),
      });
      if (await handleUnauthorized(res)) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return alert(data.error || 'Failed to send invite');
      }
      alert('Email invite sent');
      setEmailInviteInput('');
      setShowEmailInviteModal(false);
    } catch (err) {
      console.error(err);
      alert('Failed to send invite');
    }
  };

  const sendDaterInviteEmail = async () => {
    if (!daterInviteEmailInput.trim()) return alert('Please enter an email address');
    try {
      const res = await fetch(`${API_BASE_URL}/invite/dater-signup-email`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ email: daterInviteEmailInput.trim() }),
      });
      if (await handleUnauthorized(res)) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return alert(data.error || 'Failed to send invite');
      }
      alert('Email invite sent');
      setDaterInviteEmailInput('');
      setShowDaterInviteEmailModal(false);
    } catch (err) {
      console.error(err);
      alert('Failed to send invite');
    }
  };

  const handleLinkReferral = async () => {
    const code = linkDaterReferralInput.trim();
    if (!code) return alert('Please enter a referral code');
    if (linkReferralLoading) return;

    setLinkReferralLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/referral/link_referral`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ referral_code: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (await handleUnauthorized(res)) return;
      if (!res.ok) {
        return alert(data.error || 'Failed to link referral');
      }
      let name = (data.message || '').split(' linked')[0];
      name = name.replace(/^Dater\s*/i, '').trim();
      setSavedReferrals((prev) => [
        ...prev,
        { id: data.linked_dater_id, name, referral_code: code },
      ]);
      setLinkDaterReferralInput('');
      await fetchUserProfile();
    } catch (err) {
      console.error(err);
      alert('Failed to link referral');
    } finally {
      setLinkReferralLoading(false);
    }
  };

  const handleDeleteLinkedMatchmaker = async (linkedMm) => {
    if (
      !window.confirm(
        `Remove ${linkedMm.name || 'this matchmaker'}? They will no longer be able to matchmake for you.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/referral/dater_unlink_matchmaker`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ matchmaker_id: linkedMm.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (await handleUnauthorized(res)) return;
      if (!res.ok) return alert(data.error || 'Failed to remove matchmaker');
      setLinkedMatchmakers(data.linked_matchmakers || []);
      alert('Matchmaker removed');
      fetchUserProfile();
    } catch (err) {
      console.error(err);
      alert('Failed to remove matchmaker');
    }
  };

  const handleDeleteLinkedDater = async (linkedDater) => {
    if (
      !window.confirm(
        `Are you sure you want to remove ${linkedDater.name || 'this dater'}?`
      )
    ) {
      return;
    }
    if (unlinkingDaterId != null) return;
    setUnlinkingDaterId(linkedDater.id);
    try {
      const res = await fetch(`${API_BASE_URL}/referral/unlink_dater`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ linked_dater_id: linkedDater.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (await handleUnauthorized(res)) return;
      if (!res.ok) return alert(data.error || 'Failed to remove linked dater');
      setSavedReferrals(data.linked_daters || []);
      fetchUserProfile();
    } catch (err) {
      console.error(err);
      alert('Failed to remove linked dater');
    } finally {
      setUnlinkingDaterId(null);
    }
  };

  const updatePreferences = (patch) => {
    setFormData((prev) => ({ ...prev, ...patch }));
  };

  const resetPreferencesFromUser = () => {
    if (!user) {
      fetchUserProfile();
      return;
    }
    const radiusMiles = Number(user.match_radius);
    const matchWithAll = Number.isFinite(radiusMiles) && radiusMiles >= 9999;
    const safeRadius = Number.isFinite(radiusMiles) && radiusMiles > 0 ? radiusMiles : 50;
    setFormData({
      preferredAgeMin: String(user.preferredAgeMin ?? 18),
      preferredAgeMax: String(user.preferredAgeMax ?? 60),
      preferredGenders: Array.isArray(user.preferredGenders) ? user.preferredGenders : [],
      matchRadius: matchWithAll ? 500 : safeRadius,
      matchWithAll,
    });
  };

  const cancelEditingPreferences = () => {
    resetPreferencesFromUser();
    setPreferencesEditing(false);
  };

  const handleSavePreferences = async (e) => {
    e?.preventDefault?.();
    try {
      const payload = {
        preferredAgeMin: Number(formData.preferredAgeMin),
        preferredAgeMax: Number(formData.preferredAgeMax),
        preferredGenders: formData.preferredGenders,
        match_radius: formData.matchWithAll ? 9999 : Number(formData.matchRadius),
      };
      const res = await fetch(`${API_BASE_URL}/profile/update`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (await handleUnauthorized(res)) return;
      if (!res.ok) throw new Error('Failed to update dating preferences');
      setPreferencesEditing(false);
      fetchUserProfile();
    } catch (err) {
      console.error(err);
      alert('Failed to update dating preferences');
    }
  };

  const handleNotificationMasterToggle = async (enabled) => {
    if (enabled) {
      setNotificationsEnabled(true);
      setNotificationPreferences({ ...ENABLED_NOTIFICATION_PREFERENCES });
      await saveNotificationPreferences(true, ENABLED_NOTIFICATION_PREFERENCES);
    } else {
      setNotificationsEnabled(false);
      setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES });
      await saveNotificationPreferences(false, DEFAULT_NOTIFICATION_PREFERENCES);
    }
  };

  const handleNotificationPreferenceToggle = async (key, value) => {
    const next = { ...notificationPreferences, [key]: Boolean(value) };
    setNotificationPreferences(next);
    if (!notificationsEnabled && value) {
      setNotificationsEnabled(true);
      await saveNotificationPreferences(true, next);
      return;
    }
    await saveNotificationPreferences(notificationsEnabled, next);
  };

  const handleSignOut = () => {
    clearSessionAndGoLogin();
  };

  const openFullAccountDeletion = (forBothLinkedRoles) => {
    const message = forBothLinkedRoles
      ? 'Are you sure you want to permanently delete both your Dater and Matchmaker accounts? This cannot be undone.'
      : 'Are you sure you want to delete your account? This action cannot be undone.';
    if (!window.confirm(message)) return;
    setDeleteForBothRoles(Boolean(forBothLinkedRoles));
    setShowDeleteConfirm(true);
  };

  const sectionTitle = useMemo(() => {
    if (!activeSection) return 'Settings';
    const item = sectionItems.find((s) => s.key === activeSection);
    return item?.label || 'Settings';
  }, [activeSection, sectionItems]);

  const renderSectionList = () => (
    <>
      <div className="settings-nav-list fade-in">
        {sectionItems.map(({ key, label, description, Icon, href }) => (
          <button
            key={key}
            type="button"
            className="settings-nav-item settings-nav-item--detailed"
            onClick={() => {
              if (href) navigate(href);
              else setActiveSection(key);
            }}
          >
            <span className="settings-nav-left">
              <Icon className="settings-nav-icon" />
              <span className="settings-nav-text">
                <span className="settings-nav-label">{label}</span>
                <span className="settings-nav-desc">{description}</span>
              </span>
            </span>
            <FaChevronRight className="settings-nav-chevron" />
          </button>
        ))}
      </div>
      <button type="button" className="settings-sign-out-btn" onClick={handleSignOut}>
        Sign Out
      </button>
    </>
  );

  const renderPersonalInfo = () => (
    <div className="fade-in">
      <div className="settings-card">
        <h3 className="card-header">Personal Information</h3>
        <p className="card-description">
          Update your login email or phone number and password below.
        </p>
      </div>

      <div className="settings-card">
        <h4 className="sub-card-header">Change Email/Phone Number</h4>
        <p className="current-value-label">
          Current {currentIdentifierKind === 'phone' ? 'Phone Number' : 'Email'}
        </p>
        <p className="current-value">{currentIdentifier || 'Not available'}</p>
        <input
          className="settings-input"
          value={newIdentifier}
          onChange={(e) => setNewIdentifier(e.target.value)}
          placeholder="New Email/Phone Number"
          autoCapitalize="none"
        />
        <input
          className="settings-input"
          value={confirmNewIdentifier}
          onChange={(e) => setConfirmNewIdentifier(e.target.value)}
          placeholder="Confirm New Email/Phone Number"
          autoCapitalize="none"
        />
        <button type="button" className="primary-btn" onClick={handleSaveIdentifier}>
          Save
        </button>
      </div>

      <div className="settings-card">
        <h4 className="sub-card-header">Change Password</h4>
        <div className="password-field">
          <input
            className="settings-input"
            type={showOldPassword ? 'text' : 'password'}
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder="Current Password"
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowOldPassword((p) => !p)}
          >
            {showOldPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
        <div className="password-field">
          <input
            className="settings-input"
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New Password"
            onFocus={() => setIsNewPasswordFocused(true)}
            onBlur={() => setIsNewPasswordFocused(false)}
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowNewPassword((p) => !p)}
          >
            {showNewPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
        {isNewPasswordFocused && (
          <div className="password-rules">
            <p>Password requirements:</p>
            <ul>
              <li className={passwordChecks.minLength ? 'passed' : ''}>At least 8 characters</li>
              <li className={passwordChecks.hasUppercase ? 'passed' : ''}>1 uppercase letter</li>
              <li className={passwordChecks.hasLowercase ? 'passed' : ''}>1 lowercase letter</li>
              <li className={passwordChecks.hasSpecial ? 'passed' : ''}>1 special character</li>
            </ul>
          </div>
        )}
        <div className="password-field">
          <input
            className="settings-input"
            type={showConfirmNewPassword ? 'text' : 'password'}
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            placeholder="Confirm New Password"
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowConfirmNewPassword((p) => !p)}
          >
            {showConfirmNewPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
        {confirmNewPassword.length > 0 && newPassword !== confirmNewPassword && (
          <p className="input-error">Passwords do not match</p>
        )}
        <button type="button" className="primary-btn" onClick={handleSavePassword}>
          Save New Password
        </button>
      </div>
    </div>
  );

  const renderManageAccounts = () => (
    <div className="settings-card fade-in">
      <h3 className="card-header">Manage Accounts</h3>
      <p className="card-description">
        Add a different account type and switch between your two linked accounts.
      </p>
      <div className="info-row">
        <span className="info-label">Current account type:</span>
        <span className="info-value">{role === 'user' ? 'Dater' : 'Matchmaker'}</span>
      </div>
      {!user?.linked_account ? (
        <button
          type="button"
          className="primary-btn"
          onClick={
            role === 'user'
              ? () => setShowReferralModal(true)
              : handleCreateDaterAccount
          }
        >
          Add {role === 'user' ? 'Matchmaker' : 'Dater'} Account
        </button>
      ) : (
        <button type="button" className="primary-btn" onClick={handleSwitchAccount}>
          Switch to{' '}
          {user.linked_account.role === 'matchmaker' ? 'Matchmaker' : 'Dater'} Account
        </button>
      )}
    </div>
  );

  const renderReferral = () => {
    if (role === 'user') {
      return (
        <div className="fade-in">
          <div className="settings-card">
            <h3 className="card-header">Referral Code</h3>
            <p className="card-description">
              Share your referral code so a matchmaker can link to you and set up matches.
            </p>
            <div className="referral-code-box">{referralCode || 'No code available'}</div>
            <div className="action-button-group">
              <button type="button" className="icon-action-btn" onClick={handleCopyReferralCode}>
                <FaCopy /> Copy Code
              </button>
              <button type="button" className="icon-action-btn" onClick={handleShareReferralCode}>
                <FaShare /> Share Link
              </button>
              <button
                type="button"
                className="icon-action-btn"
                onClick={() => setShowEmailInviteModal(true)}
              >
                <FaEnvelope /> Email Link
              </button>
            </div>
          </div>

          <div className="settings-card">
            <h4 className="sub-card-header">Your matchmakers</h4>
            <p className="card-description">
              Matchmakers who linked using your code. Remove someone if you do not want them
              matchmaking for you anymore.
            </p>
            {linkedMatchmakers.length > 0 ? (
              <ul className="linked-list">
                {linkedMatchmakers.map((mm, idx) => (
                  <li key={`${mm.id || idx}-${idx}`} className="linked-list-item">
                    <span>{mm.name || 'Matchmaker'}</span>
                    <button
                      type="button"
                      className="remove-linked-btn"
                      onClick={() => handleDeleteLinkedMatchmaker(mm)}
                      aria-label="Remove matchmaker"
                    >
                      <FaTimes />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">You must have a matchmaker to start dating.</p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="fade-in">
        <div className="settings-card">
          <h3 className="card-header">Invite a dater</h3>
          <p className="card-description">Share your personal signup link</p>
          <div className="action-button-group">
            <button
              type="button"
              className="icon-action-btn"
              onClick={handleCopyDaterInviteLink}
              disabled={daterInviteLinkLoading}
            >
              <FaCopy /> Copy Link
            </button>
            <button
              type="button"
              className="icon-action-btn"
              onClick={handleShareDaterInviteLink}
              disabled={daterInviteLinkLoading}
            >
              <FaShare /> Share Link
            </button>
            <button
              type="button"
              className="icon-action-btn"
              onClick={() => setShowDaterInviteEmailModal(true)}
            >
              <FaEnvelope /> Email Link
            </button>
          </div>

          <h4 className="sub-card-header" style={{ marginTop: 20 }}>
            Or add by referral code
          </h4>
          <div className="referral-input-group">
            <input
              className="referral-input"
              value={linkDaterReferralInput}
              onChange={(e) => setLinkDaterReferralInput(e.target.value)}
              placeholder="Enter referral code"
              disabled={linkReferralLoading}
            />
            <button
              type="button"
              className="save-btn"
              onClick={handleLinkReferral}
              disabled={linkReferralLoading}
            >
              {linkReferralLoading ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>

        <div className="settings-card">
          <h4 className="sub-card-header">Linked daters</h4>
          {savedReferrals.length > 0 ? (
            <ul className="linked-list">
              {savedReferrals.map((ref, idx) => (
                <li key={`${ref.id || ref.referral_code}-${idx}`} className="linked-list-item">
                  <span>
                    <strong>{ref.name || 'Dater'}</strong>
                    {ref.referral_code ? (
                      <span className="referral-tag">{ref.referral_code}</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className="remove-linked-btn"
                    onClick={() => handleDeleteLinkedDater(ref)}
                    disabled={unlinkingDaterId === ref.id}
                    aria-label="Remove dater"
                  >
                    <FaTimes />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No linked daters yet.</p>
          )}
        </div>
      </div>
    );
  };

  const formatGenderLabel = (g) =>
    g === 'nonbinary' ? 'Non-binary' : g.charAt(0).toUpperCase() + g.slice(1);

  const renderDatingPreferences = () => {
    const genderSummary =
      (formData.preferredGenders || []).map(formatGenderLabel).join(', ') || 'None selected';
    const radiusSummary = formData.matchWithAll
      ? '500+ mi'
      : `${formData.matchRadius} miles`;

    return (
      <div className="settings-card fade-in">
        <div className="inline-header">
          <h3 className="card-header" style={{ marginBottom: 0 }}>
            Dating Preferences
          </h3>
          {!editingPreferences && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => setPreferencesEditing(true)}
              title="Edit Preferences"
            >
              <FaEdit />
            </button>
          )}
        </div>

        {!editingPreferences ? (
          <div className="dating-preferences-form">
            <div className="settings-field">
              <span className="settings-field-label">Preferred Age</span>
              <p className="settings-field-value">
                {formData.preferredAgeMin} - {formData.preferredAgeMax}
              </p>
            </div>
            <div className="settings-field">
              <span className="settings-field-label">Preferred Gender(s)</span>
              <p className="settings-field-value">{genderSummary}</p>
            </div>
            <div className="settings-field">
              <span className="settings-field-label">Match Radius</span>
              <p className="settings-field-value">{radiusSummary}</p>
            </div>
          </div>
        ) : (
          <form className="dating-preferences-form" onSubmit={handleSavePreferences}>
            <div className="settings-field">
              <span className="settings-field-label">
                Preferred Age Range ({formData.preferredAgeMin || 18}–{formData.preferredAgeMax || 60})
              </span>
              <AgeRangeSlider
                minValue={Number(formData.preferredAgeMin) || 18}
                maxValue={Number(formData.preferredAgeMax) || 60}
                min={18}
                max={100}
                onChange={(minAge, maxAge) =>
                  updatePreferences({
                    preferredAgeMin: String(minAge),
                    preferredAgeMax: String(maxAge),
                  })
                }
              />
            </div>

            <div className="settings-field">
              <span className="settings-field-label">Preferred Gender(s)</span>
              <Select
                isMulti
                name="preferredGenders"
                className="preferred-genders-select"
                classNamePrefix="pg"
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                menuPosition="fixed"
                styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                value={(formData.preferredGenders || []).map((g) => ({
                  label: formatGenderLabel(g),
                  value: g,
                }))}
                onChange={(options) =>
                  updatePreferences({
                    preferredGenders: options ? options.map((opt) => opt.value) : [],
                  })
                }
                options={[
                  { value: 'female', label: 'Female' },
                  { value: 'male', label: 'Male' },
                  { value: 'nonbinary', label: 'Non-binary' },
                ]}
              />
            </div>

            <div className="settings-field">
              <span className="settings-field-label">
                Match Radius ({formData.matchWithAll ? '500+' : formData.matchRadius} mi)
              </span>
              <div className="radius-slider">
                <input
                  type="range"
                  name="matchRadius"
                  min="1"
                  max="500"
                  step="1"
                  value={Number(formData.matchWithAll ? 500 : formData.matchRadius) || 50}
                  onInput={(e) =>
                    updatePreferences({
                      matchRadius: Number(e.target.value),
                      matchWithAll: false,
                    })
                  }
                  onChange={(e) =>
                    updatePreferences({
                      matchRadius: Number(e.target.value),
                      matchWithAll: false,
                    })
                  }
                />
                <span>{formData.matchWithAll ? '500+' : formData.matchRadius} mi</span>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={Boolean(formData.matchWithAll)}
                  onChange={(e) =>
                    updatePreferences({
                      matchWithAll: e.target.checked,
                      matchRadius: e.target.checked ? 500 : formData.matchRadius || 50,
                    })
                  }
                />
                <span>No distance limit</span>
              </label>
            </div>

            <div className="preferences-actions">
              <button type="submit" className="primary-btn">
                Save
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={cancelEditingPreferences}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    );
  };

  const renderNotifications = () => (
    <div className="settings-card fade-in">
      <h3 className="card-header">Notifications</h3>
      <p className="card-description">Control which alerts you receive.</p>

      <label className="settings-toggle-row">
        <span>
          <strong>Enable notifications</strong>
        </span>
        <input
          type="checkbox"
          checked={notificationsEnabled}
          disabled={notificationSaving}
          onChange={(e) => handleNotificationMasterToggle(e.target.checked)}
        />
      </label>

      <div className="notification-prefs-list">
        {visibleNotificationPreferenceItems.map((item) => (
          <label key={item.key} className="settings-toggle-row">
            <span>
              <strong>{item.label}</strong>
              {item.description ? (
                <span className="settings-nav-desc">{item.description}</span>
              ) : null}
            </span>
            <input
              type="checkbox"
              checked={Boolean(notificationPreferences[item.key])}
              disabled={notificationSaving || !notificationsEnabled}
              onChange={(e) =>
                handleNotificationPreferenceToggle(item.key, e.target.checked)
              }
            />
          </label>
        ))}
      </div>
    </div>
  );

  const renderDeleteAccountSection = () => (
    <div className="settings-card fade-in">
      <h3 className="card-header">Delete Account</h3>
      <p className="card-description">
        {user?.linked_account
          ? 'Remove one account type only, or delete both linked accounts and all data permanently.'
          : 'Permanently delete your account and all associated data.'}
      </p>
      <div className="delete-account-actions">
        {user?.linked_account ? (
          <>
            <button
              type="button"
              className="danger-btn"
              onClick={() => openFullAccountDeletion(true)}
            >
              Delete Both Accounts
            </button>
            <button
              type="button"
              className="danger-outline-btn"
              onClick={() => handleDeleteAccountByRole('user')}
            >
              Delete Dater Account
            </button>
            <button
              type="button"
              className="danger-outline-btn"
              onClick={() => handleDeleteAccountByRole('matchmaker')}
            >
              Delete Matchmaker Account
            </button>
          </>
        ) : (
          <button
            type="button"
            className="danger-btn"
            onClick={() => openFullAccountDeletion(false)}
          >
            Delete Account
          </button>
        )}
      </div>
    </div>
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
    <AppShell showTabs={!activeSection}>
      <div className="settings-page">
        <div className="settings-page-header">
          {activeSection ? (
            <button
              type="button"
              className="settings-back-btn"
              onClick={() => {
                setActiveSection(null);
                setPreferencesEditing(false);
              }}
            >
              <FaArrowLeft /> Back
            </button>
          ) : null}
          <h2 className="settings-title">{sectionTitle}</h2>
        </div>

        {renderActiveSection()}
      </div>

      {showReferralModal && (
        <div className="settings-modal-backdrop" role="dialog" aria-modal="true">
          <div className="settings-modal">
            <h3>Add Matchmaker Account</h3>
            <p>Enter a dater&apos;s referral code to create your linked matchmaker account.</p>
            <input
              className="settings-input"
              value={referralInput}
              onChange={(e) => setReferralInput(e.target.value)}
              placeholder="Referral code"
            />
            <div className="settings-modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  setShowReferralModal(false);
                  setReferralInput('');
                }}
              >
                Cancel
              </button>
              <button type="button" className="primary-btn" onClick={submitCreateMatchmaker}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showEmailInviteModal && (
        <div className="settings-modal-backdrop" role="dialog" aria-modal="true">
          <div className="settings-modal">
            <h3>Email Invite</h3>
            <input
              className="settings-input"
              type="email"
              value={emailInviteInput}
              onChange={(e) => setEmailInviteInput(e.target.value)}
              placeholder="Email address"
            />
            <div className="settings-modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  setShowEmailInviteModal(false);
                  setEmailInviteInput('');
                }}
              >
                Cancel
              </button>
              <button type="button" className="primary-btn" onClick={sendEmailInvite}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {showDaterInviteEmailModal && (
        <div className="settings-modal-backdrop" role="dialog" aria-modal="true">
          <div className="settings-modal">
            <h3>Email Dater Invite</h3>
            <input
              className="settings-input"
              type="email"
              value={daterInviteEmailInput}
              onChange={(e) => setDaterInviteEmailInput(e.target.value)}
              placeholder="Email address"
            />
            <div className="settings-modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  setShowDaterInviteEmailModal(false);
                  setDaterInviteEmailInput('');
                }}
              >
                Cancel
              </button>
              <button type="button" className="primary-btn" onClick={sendDaterInviteEmail}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {showIdentifierVerificationModal && (
        <div className="settings-modal-backdrop" role="dialog" aria-modal="true">
          <div className="settings-modal">
            <h3>Enter Verification Code</h3>
            <p>
              We sent a code to verify your new{' '}
              {pendingIdentifierKind === 'phone' ? 'phone number' : 'email'}.
            </p>
            <input
              className="settings-input"
              value={identifierVerificationCode}
              onChange={(e) => setIdentifierVerificationCode(e.target.value)}
              placeholder="Verification code"
            />
            <div className="settings-modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  setShowIdentifierVerificationModal(false);
                  setIdentifierVerificationCode('');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={handleVerifyIdentifierChange}
              >
                Verify
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="settings-modal-backdrop" role="dialog" aria-modal="true">
          <div className="settings-modal">
            <h3>{deleteForBothRoles ? 'Delete Both Accounts' : 'Delete Account'}</h3>
            <p>
              This permanently deletes{' '}
              {deleteForBothRoles ? 'both linked accounts' : 'your account'} and cannot be
              undone. Continue?
            </p>
            <div className="settings-modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button type="button" className="danger-btn" onClick={confirmDeleteAccount}>
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default SettingsSections;
