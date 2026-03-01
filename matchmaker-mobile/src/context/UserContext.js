// src/context/UserContext.js
import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user once on app start
  useEffect(() => {
    const loadUser = async () => {
      try {
        const staySignedIn = await AsyncStorage.getItem('staySignedIn');
        if (staySignedIn === 'false') {
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('user');
          setUser(null);
          return;
        }

        const stored = await AsyncStorage.getItem('user');
        if (stored) {
          try {
            const parsedUser = JSON.parse(stored);
            setUser(parsedUser);
          } catch (parseError) {
            console.error('Error parsing stored user data:', parseError);
            // Clear corrupted data
            await AsyncStorage.removeItem('user');
          }
        }
      } catch (error) {
        console.error('Error loading user from storage:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  // Keep AsyncStorage in sync
  useEffect(() => {
    if (user) {
      try {
        AsyncStorage.setItem('user', JSON.stringify(user));
      } catch (error) {
        console.error('Error saving user to storage:', error);
      }
    }
  }, [user]);

  return (
    <UserContext.Provider value={{ user, setUser, loading }}>
      {children}
    </UserContext.Provider>
  );
};
