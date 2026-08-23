import { useCallback, useEffect, useRef, useState } from 'react';

const storageKey = (userId) => `match_message_mutes_v1_${userId}`;

/**
 * Per-match message mute state (mirrors matchmaker-mobile NotificationContext).
 */
export function useMatchMessageMutes(userId) {
  const [mutedMatchIds, setMutedMatchIds] = useState([]);
  const loadedRef = useRef(false);
  const lastSavedRef = useRef('[]');
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  useEffect(() => {
    if (!userId) {
      setMutedMatchIds([]);
      loadedRef.current = false;
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      let local = [];
      try {
        const raw = localStorage.getItem(storageKey(userId));
        if (raw) {
          const parsed = JSON.parse(raw);
          local = Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
        }
      } catch {
        local = [];
      }

      if (!cancelled && local.length) {
        setMutedMatchIds(local);
      }

      try {
        const token = localStorage.getItem('token');
        if (!token || !API_BASE_URL) {
          if (!cancelled) {
            setMutedMatchIds(local);
            lastSavedRef.current = JSON.stringify(local);
            loadedRef.current = true;
          }
          return;
        }

        const res = await fetch(`${API_BASE_URL}/notifications/match_mutes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;

        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const remote = Array.isArray(data?.match_ids)
            ? data.match_ids.map((x) => String(x))
            : [];
          const merged = [...new Set([...remote, ...local])];
          setMutedMatchIds(merged);
          localStorage.setItem(storageKey(userId), JSON.stringify(merged));
          lastSavedRef.current = JSON.stringify(merged);
          loadedRef.current = true;

          const remoteSet = new Set(remote);
          const needsSync =
            merged.length !== remote.length ||
            merged.some((id) => !remoteSet.has(id));
          if (needsSync) {
            await fetch(`${API_BASE_URL}/notifications/match_mutes`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ match_ids: merged }),
            });
          }
          return;
        }

        if (!cancelled) {
          setMutedMatchIds(local);
          lastSavedRef.current = JSON.stringify(local);
          loadedRef.current = true;
        }
      } catch (err) {
        console.warn('Failed to load per-match message mutes', err);
        if (!cancelled) {
          setMutedMatchIds(local);
          lastSavedRef.current = JSON.stringify(local);
          loadedRef.current = true;
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [API_BASE_URL, userId]);

  useEffect(() => {
    if (!userId || !loadedRef.current) return undefined;

    const serialized = JSON.stringify(mutedMatchIds);
    if (serialized === lastSavedRef.current) return undefined;

    localStorage.setItem(storageKey(userId), serialized);

    const timer = window.setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token || !API_BASE_URL) {
          lastSavedRef.current = serialized;
          return;
        }
        const res = await fetch(`${API_BASE_URL}/notifications/match_mutes`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ match_ids: mutedMatchIds }),
        });
        if (res.ok) {
          lastSavedRef.current = serialized;
        }
      } catch (err) {
        console.warn('Failed to sync per-match message mutes', err);
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [API_BASE_URL, mutedMatchIds, userId]);

  const isMatchMessageMuted = useCallback(
    (matchId) => {
      if (matchId == null || matchId === '') return false;
      return mutedMatchIds.includes(String(matchId));
    },
    [mutedMatchIds]
  );

  const toggleMatchMessageMuted = useCallback((matchId) => {
    if (matchId == null || matchId === '') return;
    const id = String(matchId);
    setMutedMatchIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  return { isMatchMessageMuted, toggleMatchMessageMuted };
}

export default useMatchMessageMutes;
