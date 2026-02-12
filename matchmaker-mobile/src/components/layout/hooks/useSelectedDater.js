// hooks/useSelectedDater.js
import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export const useSelectedDater = (API_BASE_URL, userInfo) => {
  const [linkedDaters, setLinkedDaters] = useState([]);
  const [selectedDater, setSelectedDater] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Fetch linked daters ONLY
   */
  const fetchLinkedDaters = useCallback(async () => {
    if (!userInfo || userInfo.role !== 'matchmaker') {
      setLinkedDaters([]);
      setSelectedDater(null);
      setLoading(false);
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const res = await fetch(
        `${API_BASE_URL}/referral/referrals/${userInfo.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          await AsyncStorage.removeItem('token');
          Alert.alert('Session expired', 'Please log in again.');
          return;
        }
      }

      if (!res.ok) {
        throw new Error('Failed to fetch linked daters');
      }

      const data = await res.json();
      setLinkedDaters(data.linked_daters || []);
    } catch (err) {
      console.error('Error fetching linked daters:', err);
      Alert.alert('Error', 'Failed to load linked daters');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, userInfo]);

  /**
   * Sync selected dater from backend truth
   */
  useEffect(() => {
    if (
      !userInfo ||
      userInfo.role !== 'matchmaker' ||
      linkedDaters.length === 0 ||
      !userInfo.referred_by_id
    ) {
      return;
    }

    const match = linkedDaters.find(
      d => d.id === Number(userInfo.referred_by_id)
    );

    if (!match) return;

    setSelectedDater(prev =>
      prev?.id === match.id ? prev : match
    );
  }, [userInfo?.referred_by_id, linkedDaters]);

  /**
   * Change selected dater (persisted)
   */
  const selectDater = useCallback(
    async (daterId) => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) return;

        const res = await fetch(
          `${API_BASE_URL}/referral/set_selected_dater`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ selected_dater_id: daterId }),
          }
        );

        if (res.status === 401) {
          const data = await res.json();
          if (data.error_code === 'TOKEN_EXPIRED') {
            await AsyncStorage.removeItem('token');
            Alert.alert('Session expired', 'Please log in again.');
            return;
          }
        }

        if (!res.ok) {
          throw new Error('Failed to set selected dater');
        }
      } catch (err) {
        console.error('Error selecting dater:', err);
        Alert.alert('Error', 'Failed to select dater');
      }
    },
    [API_BASE_URL]
  );

  useEffect(() => {
    fetchLinkedDaters();
  }, [fetchLinkedDaters]);

  return {
    linkedDaters,
    selectedDater,
    loading,
    selectDater,
    refresh: fetchLinkedDaters,
  };
};
