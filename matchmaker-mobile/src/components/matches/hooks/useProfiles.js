import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import {
  getViewerCoords,
  sortProfilesByDistanceRandom,
} from '../utils/profileOrder';

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

        const headers = { Authorization: `Bearer ${token}` };

        const [profileRes, matchRes] = await Promise.all([
          fetch(`${API_BASE_URL}/profile/`, { headers }),
          fetch(`${API_BASE_URL}/match/users_to_match`, { headers }),
        ]);

        if (profileRes.status === 401 || matchRes.status === 401) {
          const data = await (profileRes.status === 401 ? profileRes : matchRes).json();
          if (data.error_code === 'TOKEN_EXPIRED') {
            await AsyncStorage.removeItem('token');
          }
          setLoading(false);
          return;
        }

        if (!matchRes.ok) {
          throw new Error('Failed to fetch profiles');
        }

        const profileData = profileRes.ok ? await profileRes.json() : null;
        const matchData = await matchRes.json();
        const viewerCoords = profileData
          ? getViewerCoords(profileData.user, profileData.referrer)
          : null;
        setProfiles(
          sortProfilesByDistanceRandom(
            matchData,
            viewerCoords?.lat,
            viewerCoords?.lon
          )
        );
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
