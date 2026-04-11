// src/context/NotificationContext.js
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from 'react';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../env';
import { UserContext } from './UserContext';

// Safety check for API_BASE_URL
if (!API_BASE_URL) {
  console.error('CRITICAL: API_BASE_URL is not set! App may crash.');
}

// Set up notification handler with error handling
// Wrap in a function that's called lazily to avoid startup crashes
let notificationHandlerSet = false;
const setupNotificationHandler = () => {
  if (notificationHandlerSet) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    notificationHandlerSet = true;
  } catch (error) {
    console.error('Error setting up notification handler:', error);
  }
};

/** Native Firebase (FCM) not wired — see https://docs.expo.dev/push-notifications/fcm-credentials/ */
function logAndroidFcmSetupHint(error) {
  const msg = error?.message != null ? String(error.message) : String(error);
  if (
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    Platform.OS === 'android' &&
    msg.includes('complete the guide')
  ) {
    console.warn(
      '[Android FCM] google-services.json must be applied in the native project. In app.json set expo.android.googleServicesFile to ./google-services.json, then run: npx expo prebuild --clean && npx expo run:android'
    );
  }
}

export const NotificationContext = createContext(null);

const DEFAULT_NOTIFICATION_PREFERENCES = {
  newMatchNotification: false,
  newBlindMatchNotification: false,
  newMessageNotification: false,
  newMatchApprovalNotification: false,
};

const ENABLED_NOTIFICATION_PREFERENCES = {
  newMatchNotification: true,
  newBlindMatchNotification: true,
  newMessageNotification: true,
  newMatchApprovalNotification: true,
};

const buildNotificationPreferenceState = (userData) => {
  const enabled = Boolean(userData?.notifications_enabled ?? false);

  if (!enabled) {
    return {
      enabled: false,
      preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
    };
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
      new_match_approval_notifications: false,
    };
  }

  return {
    enabled: true,
    new_match_notifications: Boolean(preferences?.newMatchNotification),
    new_blind_match_notifications: Boolean(preferences?.newBlindMatchNotification),
    new_message_notifications: Boolean(preferences?.newMessageNotification),
    new_match_approval_notifications: Boolean(preferences?.newMatchApprovalNotification),
  };
};

export const NotificationProvider = ({ children }) => {
  // Set up notification handler on mount (lazy initialization)
  useEffect(() => {
    setupNotificationHandler();
  }, []);

  const userContext = useContext(UserContext);
  const user = userContext?.user || null;

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [expoPushToken, setExpoPushToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // refs to prevent loops
  const isSavingRef = useRef(false);
  const lastSavedPayloadRef = useRef(null);
  const hasLoadedPreferenceRef = useRef(false);
  const registeredTokensRef = useRef(new Set());
  const currentUserIdRef = useRef(null);

  /* -------------------------------------------
   * RESET STATE WHEN USER CHANGES
   * ----------------------------------------- */
  useEffect(() => {
    if (!user?.id) {
      // hard reset when logged out
      hasLoadedPreferenceRef.current = false;
      setNotificationsEnabled(false);
      setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES });
      lastSavedPayloadRef.current = null;
      currentUserIdRef.current = null;
      registeredTokensRef.current.clear();
      setLoading(false);
      return;
    }

    // New user detected - fetch actual preference from backend
    if (currentUserIdRef.current !== user.id) {
      currentUserIdRef.current = user.id;
      hasLoadedPreferenceRef.current = false;
      registeredTokensRef.current.clear();
      setLoading(true);
      
      // Fetch the actual notification preference from backend for this user
      const fetchNotificationPreference = async () => {
        try {
          const token = await AsyncStorage.getItem('token');
          if (!token) {
            // No token means user is not logged in - don't make API calls
            setNotificationsEnabled(false);
            setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES });
            lastSavedPayloadRef.current = JSON.stringify(
              buildNotificationPreferencePayload(false, DEFAULT_NOTIFICATION_PREFERENCES)
            );
            setLoading(false);
            // Clear user from context if no token exists
            if (user?.id) {
              // User object exists but no token - clear it
              await AsyncStorage.removeItem('user');
            }
            return;
          }

          // Double-check user still exists (might have been cleared by another process)
          if (currentUserIdRef.current !== user.id) {
            setLoading(false);
            return;
          }

          // Safety check: Don't make API calls if API_BASE_URL is not set
          if (!API_BASE_URL) {
            console.error('API_BASE_URL is not set, skipping API call');
            setNotificationsEnabled(false);
            setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES });
            lastSavedPayloadRef.current = JSON.stringify(
              buildNotificationPreferencePayload(false, DEFAULT_NOTIFICATION_PREFERENCES)
            );
            setLoading(false);
            return;
          }

          // Fetch user profile to get the actual notifications_enabled value
          const res = await fetch(`${API_BASE_URL}/profile/`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });

          if (res.ok) {
            const data = await res.json();
            // Only update if we're still on the same user
            if (currentUserIdRef.current === user.id && data.user?.id === user.id) {
              const nextState = buildNotificationPreferenceState(data.user);
              const payload = buildNotificationPreferencePayload(
                nextState.enabled,
                nextState.preferences
              );
              setNotificationsEnabled(nextState.enabled);
              setNotificationPreferences(nextState.preferences);
              lastSavedPayloadRef.current = JSON.stringify(payload);
            }
          } else if (res.status === 401) {
            const errorData = await res.json().catch(() => ({}));
            // Clear token and user for any 401 error (TOKEN_EXPIRED, INVALID_TOKEN, etc.)
            if (errorData.error_code === 'TOKEN_EXPIRED' || errorData.error_code === 'INVALID_TOKEN') {
              await AsyncStorage.removeItem('token');
              await AsyncStorage.removeItem('user');
              // Don't log as warning - this is expected when token is invalid
              // Just silently clear and reset state
            } else {
              console.warn('Auth error fetching notification preferences:', errorData);
            }
            // Default to false on auth error
            setNotificationsEnabled(false);
            setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES });
            lastSavedPayloadRef.current = JSON.stringify(
              buildNotificationPreferencePayload(false, DEFAULT_NOTIFICATION_PREFERENCES)
            );
          } else if (res.status === 404) {
            console.warn('User not found, clearing stored data');
            // User not found - clear stored data
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('user');
            setNotificationsEnabled(false);
            setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES });
            lastSavedPayloadRef.current = JSON.stringify(
              buildNotificationPreferencePayload(false, DEFAULT_NOTIFICATION_PREFERENCES)
            );
          } else {
            console.error('Error fetching notification preferences, status:', res.status);
            // Default to false on other errors
            setNotificationsEnabled(false);
            setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES });
            lastSavedPayloadRef.current = JSON.stringify(
              buildNotificationPreferencePayload(false, DEFAULT_NOTIFICATION_PREFERENCES)
            );
          }
        } catch (err) {
          console.error('Error fetching notification preference:', err);
          // Default to false on error
          setNotificationsEnabled(false);
          setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES });
          lastSavedPayloadRef.current = JSON.stringify(
            buildNotificationPreferencePayload(false, DEFAULT_NOTIFICATION_PREFERENCES)
          );
        } finally {
          if (currentUserIdRef.current === user.id) {
            hasLoadedPreferenceRef.current = true;
          }
          setLoading(false);
        }
      };

      fetchNotificationPreference();
    }
  }, [user?.id]);

  /* -------------------------------------------
   * SAVE PREFERENCE TO BACKEND (USER-SCOPED)
   * ----------------------------------------- */
  useEffect(() => {
    const payload = buildNotificationPreferencePayload(
      notificationsEnabled,
      notificationPreferences
    );
    const payloadString = JSON.stringify(payload);

    if (
      !user?.id ||
      loading ||
      isSavingRef.current ||
      !hasLoadedPreferenceRef.current ||
      lastSavedPayloadRef.current === payloadString ||
      currentUserIdRef.current !== user.id  // Don't save if user changed during save
    ) {
      return;
    }

    // Check for token before making API call
    const checkTokenAndSave = async () => {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        // No token - don't make API call
        return;
      }

      isSavingRef.current = true;
      try {
        // Store user ID at the start of the save operation to prevent cross-user contamination
        const userIdAtSaveStart = user.id;
        const refUserIdAtSaveStart = currentUserIdRef.current;

        // Triple-check: user ID, ref, and they match
        if (userIdAtSaveStart !== refUserIdAtSaveStart || !userIdAtSaveStart) {
          console.warn('User mismatch at save start, aborting notification preference save', {
            userId: userIdAtSaveStart,
            refUserId: refUserIdAtSaveStart
          });
          isSavingRef.current = false;
          return;
        }

        // Safety check: Don't make API calls if API_BASE_URL is not set
        if (!API_BASE_URL) {
          console.error('API_BASE_URL is not set, skipping notification preference save');
          isSavingRef.current = false;
          return;
        }

        const res = await fetch(
          `${API_BASE_URL}/notifications/preferences`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          }
        );

        if (res.ok) {
          // Final check: verify user hasn't changed during the async operation
          if (
            user.id === userIdAtSaveStart &&
            currentUserIdRef.current === refUserIdAtSaveStart &&
            currentUserIdRef.current === user.id
          ) {
            lastSavedPayloadRef.current = payloadString;
          } else {
            console.warn('User changed during save operation, not updating local state', {
              userIdAtSaveStart,
              currentUserId: user.id,
              refUserId: currentUserIdRef.current
            });
          }
        } else {
          const errorData = await res.json().catch(() => ({}));
          
          // Handle token errors (expired or invalid)
          if (res.status === 401 && (errorData.error_code === 'TOKEN_EXPIRED' || errorData.error_code === 'INVALID_TOKEN')) {
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('user');
            return;
          } else if (res.status === 404) {
            console.warn('User not found while saving notification preference, clearing stored data');
            // User not found - clear stored data
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('user');
            return;
          }

          console.error('Failed to update notification preference:', res.status, errorData);
        }
      } catch (err) {
        console.error('Notification preference save error:', err);
      } finally {
        isSavingRef.current = false;
      }
    };

    checkTokenAndSave();
  }, [notificationPreferences, notificationsEnabled, user?.id, loading]);

  /* -------------------------------------------
   * REGISTER PUSH TOKEN (PER USER)
   * ----------------------------------------- */
  const registerPushToken = useCallback(
    async (token, platform = 'expo', options = {}) => {
      const { skipDedupe = false } = options;
      const key = `${platform}:${token}`;
      if (!user?.id) {
        console.warn('registerPushToken: no user id, skipping');
        return;
      }
      if (!skipDedupe && registeredTokensRef.current.has(key)) {
        return;
      }

      try {
        const authToken = await AsyncStorage.getItem('token');
        if (!authToken) {
          console.warn('registerPushToken: no auth token, skipping');
          return;
        }

        if (!API_BASE_URL) {
          console.error('API_BASE_URL is not set, skipping token registration');
          return;
        }

        const body = { push_token: token, platform };

        const res = await fetch(
          `${API_BASE_URL}/notifications/register_token`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify(body),
          }
        );

        if (res.ok) {
          registeredTokensRef.current.add(key);
          if (__DEV__) {
            console.log('Push token registered:', platform);
          }
        } else {
          const text = await res.text().catch(() => '');
          console.warn('registerPushToken failed:', res.status, text);
          if (res.status === 401) {
            try {
              const err = JSON.parse(text);
              if (err.error_code === 'TOKEN_EXPIRED') {
                await AsyncStorage.removeItem('token');
              }
            } catch (_) {
              /* ignore */
            }
          }
        }
      } catch (err) {
        console.error('Push token registration failed:', err);
      }
    },
    [user?.id]
  );

  /* Prefer native device token (APNs / FCM), else Expo — shared by permission flow and refresh */
  const fetchPushTokenAndRegister = useCallback(
    async (options = {}) => {
      const { skipDedupe = false } = options;
      if (Platform.OS === 'web') return;

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.manifest2?.extra?.eas?.projectId;

      let nativeOk = false;
      try {
        const device = await Notifications.getDevicePushTokenAsync();
        if (device?.data) {
          const nativePlatform = Platform.OS === 'ios' ? 'ios' : 'android';
          await registerPushToken(device.data, nativePlatform, { skipDedupe });
          nativeOk = true;
        }
      } catch (_) {
        /* simulator / missing entitlements — fall back to Expo */
      }
      if (!nativeOk) {
        if (!projectId) {
          console.warn(
            'Missing EAS projectId: cannot get Expo push token; add extra.eas.projectId in app config or use a dev build with native push.'
          );
        } else {
          const token = await Notifications.getExpoPushTokenAsync({ projectId });
          setExpoPushToken(token.data);
          await registerPushToken(token.data, 'expo', { skipDedupe });
        }
      } else {
        setExpoPushToken(null);
      }
    },
    [registerPushToken]
  );

  const refreshPushTokenRegistration = useCallback(async () => {
    if (Platform.OS === 'web' || !user?.id) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    try {
      await fetchPushTokenAndRegister({ skipDedupe: true });
    } catch (error) {
      console.error('Push token refresh failed:', error);
      logAndroidFcmSetupHint(error);
    }
  }, [user?.id, fetchPushTokenAndRegister]);

  /*
   * Store update / migration: once per app version (per user), re-register after a short delay.
   * Fixes FCM/APNs readiness races where toggling notifications off/on used to be the workaround.
   * Bump "version" in app.json each release you need to force token refresh for opted-in users.
   */
  useEffect(() => {
    if (Platform.OS === 'web' || !user?.id || loading || !notificationsEnabled) return;

    let cancelled = false;
    const run = async () => {
      const appVersion = Constants.expoConfig?.version || '0';
      const storageKey = `push_token_registered_for_app_version_${user.id}`;
      const lastSynced = await AsyncStorage.getItem(storageKey);
      if (lastSynced === appVersion) return;

      await new Promise((r) => setTimeout(r, 1500));
      if (cancelled) return;

      await refreshPushTokenRegistration();
      await AsyncStorage.setItem(storageKey, appVersion);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [loading, notificationsEnabled, user?.id, refreshPushTokenRegistration]);

  /* Cold start + foreground: keep server token in sync after updates / rotation */
  useEffect(() => {
    if (Platform.OS === 'web' || !user?.id || loading) return;

    const run = () => {
      if (!notificationsEnabled) return;
      refreshPushTokenRegistration();
    };

    run();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') run();
    });
    return () => sub.remove();
  }, [
    notificationsEnabled,
    loading,
    user?.id,
    refreshPushTokenRegistration,
  ]);

  /* -------------------------------------------
   * PERMISSIONS
   * ----------------------------------------- */
  const requestPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    let finalStatus = status;

    if (status !== 'granted') {
      const result = await Notifications.requestPermissionsAsync();
      finalStatus = result.status;
    }

    setPermissionStatus(finalStatus);

    if (finalStatus !== 'granted') return false;

    if (Platform.OS !== 'web') {
      try {
        await fetchPushTokenAndRegister({ skipDedupe: false });
      } catch (error) {
        console.error('Push token registration failed:', error);
        logAndroidFcmSetupHint(error);
        // On simulators, this often fails - but permissions were granted
        return true;
      }
    }

    return true;
  };

  /* -------------------------------------------
   * PUBLIC API
   * ----------------------------------------- */
  const enableNotifications = async () => {
    // Ensure we have a valid user before enabling
    if (!user?.id) {
      console.warn('Cannot enable notifications: no user logged in');
      return false;
    }

    // Allow re-POST to /register_token on every enable (toggle off/on or retry after failed save).
    registeredTokensRef.current.clear();

    // Store the user ID at the start to prevent cross-user contamination
    const userIdAtStart = user.id;

    const granted = await requestPermissions();
    
    // Double-check user hasn't changed during permission request
    if (granted && user?.id === userIdAtStart && currentUserIdRef.current === userIdAtStart) {
      hasLoadedPreferenceRef.current = true;
      setNotificationPreferences({ ...ENABLED_NOTIFICATION_PREFERENCES });
      setNotificationsEnabled(true);
      return true;
    } else if (granted && user?.id !== userIdAtStart) {
      console.warn('User changed during notification enable, aborting');
      return false;
    }
    
    return granted;
  };

  const disableNotifications = () => {
    // Ensure we have a valid user before disabling
    if (!user?.id) {
      console.warn('Cannot disable notifications: no user logged in');
      return;
    }
    
    // Only disable if we're still on the same user
    if (currentUserIdRef.current === user.id) {
      hasLoadedPreferenceRef.current = true;
      setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES });
      setNotificationsEnabled(false);
      registeredTokensRef.current.clear();
    } else {
      console.warn('User changed, cannot disable notifications for different user');
    }
  };

  const setNotificationPreference = useCallback((key, value) => {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_NOTIFICATION_PREFERENCES, key)) {
      return;
    }

    hasLoadedPreferenceRef.current = true;
    setNotificationPreferences((prev) => ({
      ...prev,
      [key]: Boolean(value),
    }));
  }, []);

  const notificationTypeEnabled = useCallback((type) => {
    if (!notificationsEnabled) return false;

    switch (type) {
      case 'match':
        return notificationPreferences.newMatchNotification;
      case 'blind_match':
        return notificationPreferences.newBlindMatchNotification;
      case 'message':
        return notificationPreferences.newMessageNotification;
      case 'match_approval':
        return notificationPreferences.newMatchApprovalNotification;
      default:
        return true;
    }
  }, [notificationPreferences, notificationsEnabled]);

  const sendNotification = async (title, body, data = {}) => {
    if (!notificationTypeEnabled(data?.type)) return;

    await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: true },
      trigger: null,
    });
  };

  return (
    <NotificationContext.Provider
      value={{
        notificationsEnabled,
        notificationPreferences,
        enableNotifications,
        disableNotifications,
        setNotificationPreference,
        sendNotification,
        permissionStatus,
        loading,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      'useNotifications must be used within NotificationProvider'
    );
  }
  return ctx;
};
