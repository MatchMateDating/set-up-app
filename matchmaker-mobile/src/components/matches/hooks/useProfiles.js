import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export const useProfiles = (API_BASE_URL) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          setLoading(false);
          return;
        }

        const res = await fetch(`${API_BASE_URL}/match/users_to_match`, {
          headers: { Authorization: `Bearer ${token}` },
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
          throw new Error('Failed to fetch profiles');
        }

        const data = await res.json();
        setProfiles(data);
      } catch (err) {
        console.error('Error fetching profiles:', err);
        Alert.alert('Error', 'Failed to load profiles');
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, [API_BASE_URL]);

  return { profiles, setProfiles, loading };
};
