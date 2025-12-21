import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export const useUserInfo = (API_BASE_URL) => {
  const [userInfo, setUserInfo] = useState(null);
  const [referrerInfo, setReferrerInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          setLoading(false);
          return;
        }

        const res = await fetch(`${API_BASE_URL}/profile/`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.status === 401) {
          const data = await res.json();
          if (data.error_code === 'TOKEN_EXPIRED') {
            await AsyncStorage.removeItem('token');
            Alert.alert('Session expired', 'Please log in again.');
          }
          setLoading(false);
          return;
        }

        if (!res.ok) {
          throw new Error('Failed to fetch user info');
        }

        const data = await res.json();
        setUserInfo(data.user);
        setReferrerInfo(data.referrer);
      } catch (err) {
        console.error('Error fetching user info:', err);
        Alert.alert('Error', 'Failed to load user info');
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, [API_BASE_URL]);

  return { userInfo, setUserInfo, referrerInfo, setReferrerInfo, loading };
};
