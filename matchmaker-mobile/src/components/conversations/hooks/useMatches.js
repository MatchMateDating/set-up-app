import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import {
  seedMatchPreviewsFromMatches,
  applyCachedPreviewsToMatches,
} from '../utils/matchMessagePreview';

export const useMatches = (API_BASE_URL) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMatches = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/match/matches?_=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          await AsyncStorage.removeItem('token');
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
        const nextMatches = { matched: data, pending_approval: [] };
        seedMatchPreviewsFromMatches(nextMatches);
        setMatches(applyCachedPreviewsToMatches(nextMatches));
      } else {
        // New structure
        const nextMatches = {
          matched: data.matched || [],
          pending_approval: data.pending_approval || [],
        };
        seedMatchPreviewsFromMatches(nextMatches);
        setMatches(applyCachedPreviewsToMatches(nextMatches));
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
      Alert.alert('Error', 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  return { matches, setMatches, loading, fetchMatches };
};
