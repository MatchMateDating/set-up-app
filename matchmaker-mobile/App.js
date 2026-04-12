import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { UserProvider } from './src/context/UserContext';
import {
  NotificationProvider,
  getNotificationRoutingData,
} from './src/context/NotificationContext';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { KeyboardProvider } from 'react-native-keyboard-controller';

// This component handles notification responses (taps)
function NotificationHandler({ navigationRef }) {
  const notificationListener = useRef();
  const responseListener = useRef();
  const handledTapIdsRef = useRef(new Set());

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

      const navigateFromNotification = (notification) => {
        if (!navigationRef.current || !notification) return;
        const reqId = notification.request?.identifier;
        if (reqId && handledTapIdsRef.current.has(reqId)) return;

        const data = getNotificationRoutingData(notification);
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
  }, []);

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
