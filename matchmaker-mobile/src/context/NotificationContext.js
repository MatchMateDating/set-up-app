// src/context/NotificationContext.js
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useRef,
} from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../env';
import { UserContext } from './UserContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user } = useContext(UserContext);

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [expoPushToken, setExpoPushToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // refs to prevent loops
  const isSavingRef = useRef(false);
  const lastSavedValueRef = useRef(null);
  const registeredTokensRef = useRef(new Set());
  const currentUserIdRef = useRef(null);

  /* -------------------------------------------
   * RESET STATE WHEN USER CHANGES
   * ----------------------------------------- */
  useEffect(() => {
    if (!user?.id) {
      // hard reset when logged out
      setNotificationsEnabled(false);
      lastSavedValueRef.current = null;
      currentUserIdRef.current = null;
      registeredTokensRef.current.clear();
      setLoading(false);
      return;
    }

    // New user detected - fetch actual preference from backend
    if (currentUserIdRef.current !== user.id) {
      currentUserIdRef.current = user.id;
      registeredTokensRef.current.clear();
      setLoading(true);
      
      // Fetch the actual notification preference from backend for this user
      const fetchNotificationPreference = async () => {
        try {
          const token = await AsyncStorage.getItem('token');
          if (!token) {
            setNotificationsEnabled(false);
            lastSavedValueRef.current = false;
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
              const enabled = Boolean(data.user?.notifications_enabled ?? false);
              setNotificationsEnabled(enabled);
              lastSavedValueRef.current = enabled;
            }
          } else if (res.status === 401) {
            const errorData = await res.json().catch(() => ({}));
            console.warn('Auth error fetching notification preferences:', errorData);
            if (errorData.error_code === 'TOKEN_EXPIRED') {
              await AsyncStorage.removeItem('token');
              await AsyncStorage.removeItem('user');
            }
            // Default to false on auth error
            setNotificationsEnabled(false);
            lastSavedValueRef.current = false;
          } else if (res.status === 404) {
            console.warn('User not found, clearing stored data');
            // User not found - clear stored data
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('user');
            setNotificationsEnabled(false);
            lastSavedValueRef.current = false;
          } else {
            console.error('Error fetching notification preferences, status:', res.status);
            // Default to false on other errors
            setNotificationsEnabled(false);
            lastSavedValueRef.current = false;
          }
        } catch (err) {
          console.error('Error fetching notification preference:', err);
          // Default to false on error
          setNotificationsEnabled(false);
          lastSavedValueRef.current = false;
        } finally {
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
    if (
      !user?.id ||
      loading ||
      isSavingRef.current ||
      lastSavedValueRef.current === notificationsEnabled ||
      currentUserIdRef.current !== user.id  // Don't save if user changed during save
    ) {
      return;
    }

    const savePreference = async () => {
      isSavingRef.current = true;
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) return;

        // Store user ID at the start of the save operation to prevent cross-user contamination
        const userIdAtSaveStart = user.id;
        const refUserIdAtSaveStart = currentUserIdRef.current;

        // Triple-check: user ID, ref, and they match
        if (userIdAtSaveStart !== refUserIdAtSaveStart || !userIdAtSaveStart) {
          console.warn('User mismatch at save start, aborting notification preference save', {
            userId: userIdAtSaveStart,
            refUserId: refUserIdAtSaveStart
          });
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
            body: JSON.stringify({ enabled: notificationsEnabled }),
          }
        );

        if (res.ok) {
          // Final check: verify user hasn't changed during the async operation
          if (
            user.id === userIdAtSaveStart &&
            currentUserIdRef.current === refUserIdAtSaveStart &&
            currentUserIdRef.current === user.id
          ) {
            lastSavedValueRef.current = notificationsEnabled;
          } else {
            console.warn('User changed during save operation, not updating local state', {
              userIdAtSaveStart,
              currentUserId: user.id,
              refUserId: currentUserIdRef.current
            });
          }
        } else {
          const errorData = await res.json().catch(() => ({}));
          
          // Handle token expiration
          if (res.status === 401 && errorData.error_code === 'TOKEN_EXPIRED') {
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('user');
            console.warn('Token expired while saving notification preference. User needs to log in again.');
            // Don't try to save again - user needs to re-authenticate
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

    savePreference();
  }, [notificationsEnabled, user?.id, loading]);

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
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.manifest2?.extra?.eas?.projectId;

      if (!projectId) {
        console.warn('Missing projectId for push notifications');
        return true;
      }

      try {
        const token = await Notifications.getExpoPushTokenAsync({ projectId });
        setExpoPushToken(token.data);
        await registerPushToken(token.data);
      } catch (error) {
        // On simulators, this often fails - but permissions were granted
        // So we still return true to allow the toggle to work
        return true; // Return true because permissions were granted, even if token failed
      }
    }

    return true;
  };

  /* -------------------------------------------
   * REGISTER PUSH TOKEN (PER USER)
   * ----------------------------------------- */
  const registerPushToken = async (token) => {
    if (!user?.id || registeredTokensRef.current.has(token)) return;

    try {
      const authToken = await AsyncStorage.getItem('token');
      if (!authToken) return;

      const res = await fetch(
        `${API_BASE_URL}/notifications/register_token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ push_token: token }),
        }
      );

      if (res.ok) {
        registeredTokensRef.current.add(token);
      } else if (res.status === 401) {
        const errorData = await res.json().catch(() => ({}));
        if (errorData.error_code === 'TOKEN_EXPIRED') {
          await AsyncStorage.removeItem('token');
          console.warn('Token expired while registering push token. User needs to log in again.');
        }
      }
    } catch (err) {
      console.error('Push token registration failed:', err);
    }
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
    
    // Store the user ID at the start to prevent cross-user contamination
    const userIdAtStart = user.id;
    
    const granted = await requestPermissions();
    
    // Double-check user hasn't changed during permission request
    if (granted && user?.id === userIdAtStart && currentUserIdRef.current === userIdAtStart) {
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
      setNotificationsEnabled(false);
    } else {
      console.warn('User changed, cannot disable notifications for different user');
    }
  };

  const sendNotification = async (title, body, data = {}) => {
    if (!notificationsEnabled) return;

    await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: true },
      trigger: null,
    });
  };

  return (
    <NotificationContext.Provider
      value={{
        notificationsEnabled,
        enableNotifications,
        disableNotifications,
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
