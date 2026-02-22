import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { UserProvider } from './src/context/UserContext';
import { NotificationProvider } from './src/context/NotificationContext';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';

// This component handles notification responses (taps)
function NotificationHandler({ navigationRef }) {
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    try {
      // Handle notifications received while app is in foreground
      notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
        // You can handle foreground notifications here if needed
        console.log('Notification received:', notification);
      });

      // Handle notification taps
      responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
        try {
          const data = response.notification.request.content.data;
          
          if (data?.matchId && navigationRef.current) {
            // Navigate to the conversation
            navigationRef.current.navigate('MatchConvo', {
              matchId: parseInt(data.matchId),
            });
          } else if (data?.type === 'match' && navigationRef.current) {
            // Navigate to conversations list for new matches
            navigationRef.current.navigate('Main', {
              screen: 'Conversations',
            });
          }
        } catch (error) {
          console.error('Error handling notification response:', error);
        }
      });
    } catch (error) {
      console.error('Error setting up notification listeners:', error);
    }

    return () => {
      try {
        if (notificationListener.current) {
          Notifications.removeNotificationSubscription(notificationListener.current);
        }
        if (responseListener.current) {
          Notifications.removeNotificationSubscription(responseListener.current);
        }
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
  );
}
