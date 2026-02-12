import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export const useMatches = (API_BASE_URL) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMatches = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/match/matches`, {
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
        throw new Error('Failed to fetch matches');
      }

      const data = await res.json();
      // Handle new structure: {matched: [], pending_approval: []} or old structure: []
      if (Array.isArray(data)) {
        // Old structure - backward compatibility
        setMatches({ matched: data, pending_approval: [] });
      } else {
        // New structure
        setMatches({ matched: data.matched || [], pending_approval: data.pending_approval || [] });
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
      Alert.alert('Error', 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [API_BASE_URL]);

  return { matches, setMatches, loading, fetchMatches };
};
