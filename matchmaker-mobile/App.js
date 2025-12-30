import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { UserProvider } from './src/context/UserContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <UserProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
    </UserProvider>
  );
}
