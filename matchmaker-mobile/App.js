import React, { useEffect, useRef, useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProvider } from './src/context/UserContext';
import {
  NotificationProvider,
  getNotificationRoutingData,
} from './src/context/NotificationContext';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { API_BASE_URL } from './src/env';
import { UserContext } from './src/context/UserContext';

// This component handles notification responses (taps)
function NotificationHandler({ navigationRef }) {
  const notificationListener = useRef();
  const responseListener = useRef();
  const handledTapIdsRef = useRef(new Set());
  const { user, setUser } = useContext(UserContext);

  useEffect(() => {
    try {
      // Handle notifications received while app is in foreground
      notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
        if (__DEV__) {
          const { title, body, data } = notification.request.content;
          console.log('Notification received:', {
            id: notification.request.identifier,
            title,
            body,
            data,
          });
        }
      });

      const normalizeRole = (role) => {
        if (role === 'matchmaker') return 'matchmaker';
        if (role === 'dater') return 'dater';
        if (role === 'user') return 'dater';
        return null;
      };

      const ensureAccountRoleForNotification = async (recipientRole) => {
        const desired = normalizeRole(recipientRole);
        if (!desired) return;
        const current = normalizeRole(user?.role);
        if (!current || current === desired) return;

        try {
          const token = await AsyncStorage.getItem('token');
          if (!token) return;

          const res = await fetch(`${API_BASE_URL}/profile/switch_account`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
          if (!res.ok) return;

          const data = await res.json().catch(() => null);
          if (!data?.token || !data?.user) return;

          // Only accept the switch if it matches what the notification expects.
          const switchedRole = normalizeRole(data.user.role);
          if (switchedRole !== desired) return;

          await AsyncStorage.setItem('token', data.token);
          await AsyncStorage.setItem('user', JSON.stringify(data.user));
          setUser(data.user);
        } catch (err) {
          console.error('Error switching account for notification:', err);
        }
      };

      const navigateFromNotification = async (notification) => {
        if (!navigationRef.current || !notification) return;
        const reqId = notification.request?.identifier;
        if (reqId && handledTapIdsRef.current.has(reqId)) return;

        const data = getNotificationRoutingData(notification);
        await ensureAccountRoleForNotification(data?.recipientRole);

        const raw = data?.matchId;
        if (raw == null || raw === '') return;
        const matchId = parseInt(String(raw), 10);
        if (!Number.isFinite(matchId)) return;

        if (reqId) handledTapIdsRef.current.add(reqId);
        navigationRef.current.navigate('MatchConvo', { matchId });
      };

      responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
        try {
          navigateFromNotification(response.notification);
        } catch (error) {
          console.error('Error handling notification response:', error);
        }
      });

      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response?.notification) {
          navigateFromNotification(response.notification);
        }
      });
    } catch (error) {
      console.error('Error setting up notification listeners:', error);
    }

    return () => {
      try {
        notificationListener.current?.remove?.();
        responseListener.current?.remove?.();
      } catch (error) {
        console.error('Error cleaning up notification listeners:', error);
      }
    };
  }, [user?.role, setUser]);

  return null;
}

export default function App() {
  const navigationRef = React.useRef();

  return (
    <KeyboardProvider>
        <ErrorBoundary>
          <UserProvider>
            <NotificationProvider>
              <NavigationContainer ref={navigationRef}>
                <NotificationHandler navigationRef={navigationRef} />
                <AppNavigator />
              </NavigationContainer>
            </NotificationProvider>
          </UserProvider>
        </ErrorBoundary>
    </KeyboardProvider>
  );
}
