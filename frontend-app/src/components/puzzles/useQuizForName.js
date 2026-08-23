import { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

export function useQuizForName() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const fromQuery = searchParams.get('forName');
  const fromState = location.state?.forName || null;
  const initialName = fromQuery || fromState || null;

  const [forName, setForName] = useState(initialName);

  useEffect(() => {
    if (fromQuery || fromState) {
      setForName(fromQuery || fromState);
      return;
    }

    let cancelled = false;

    const loadName = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const apiBase = process.env.REACT_APP_API_BASE_URL;
        const res = await fetch(`${apiBase}/profile/`, {
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
  }, [fromQuery, fromState]);

  return forName;
}
