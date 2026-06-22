import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute } from '@react-navigation/native';
import { API_BASE_URL } from '../../env';

export function useQuizForName() {
  const route = useRoute();
  const [forName, setForName] = useState(route.params?.forName || null);

  useEffect(() => {
    if (route.params?.forName) {
      setForName(route.params.forName);
      return;
    }

    let cancelled = false;

    const loadName = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) return;

        const res = await fetch(`${API_BASE_URL}/profile/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;

        const data = await res.json();
        const name = data?.user?.first_name;
        if (name && !cancelled) {
          setForName(name);
        }
      } catch {
        // optional personalization — ignore failures
      }
    };

    loadName();
    return () => {
      cancelled = true;
    };
  }, [route.params?.forName]);

  return forName;
}
