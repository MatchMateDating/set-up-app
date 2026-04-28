// src/components/conversations/hooks/useNotificationPolling.js
// Polls matches/conversations for UI freshness. Backend push is the only channel for
// new-match and new-message alerts (local notifications duplicated FCM/APNs and used wrong copy).
import { useEffect, useRef, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotifications } from '../../../context/NotificationContext';
import { UserContext } from '../../../context/UserContext';
import { API_BASE_URL } from '../../../env';

const POLLING_INTERVAL = 30000; // 30 seconds

export const useNotificationPolling = () => {
  const { notificationsEnabled } = useNotifications();
  const { user } = useContext(UserContext);
  const currentUserId = user?.referred_by_id ?? user?.id ?? null;
  const lastMessageCountsRef = useRef({}); // { matchId: messageCount }
  const lastMatchIdsRef = useRef(new Set());
  const pollingIntervalRef = useRef(null);
  const isInitializedRef = useRef(false);

  // Check for new messages in all conversations
  const checkNewMessages = async () => {
    if (!notificationsEnabled) return;

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      // Get all matches
      const matchesRes = await fetch(`${API_BASE_URL}/match/matches`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!matchesRes.ok) return;

      const matchesData = await matchesRes.json();
      const allMatches = Array.isArray(matchesData)
        ? matchesData
        : [...(matchesData.matched || []), ...(matchesData.pending_approval || [])];

      // Check each match for new messages
      for (const match of allMatches) {
        const matchId = match.match_id;
        if (!matchId) continue;

        try {
          const convRes = await fetch(`${API_BASE_URL}/conversation/${matchId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!convRes.ok) continue;

          const convData = await convRes.json();
          const messages = convData.length > 0 ? convData[0].messages : [];
          const currentMessageCount = messages.length;

          // Get the last known message count
          const lastCount = lastMessageCountsRef.current[matchId] || 0;

          // Track counts only; do not schedule local message notifications (duplicates server push).
          if (currentMessageCount > lastCount && isInitializedRef.current && lastCount > 0) {
            const newMessages = messages.slice(lastCount);
            const latestMessage = newMessages[newMessages.length - 1];

            if (currentUserId == null || latestMessage.receiver_id !== currentUserId) {
              lastMessageCountsRef.current[matchId] = currentMessageCount;
              continue;
            }
          }

          // Update last known count
          lastMessageCountsRef.current[matchId] = currentMessageCount;
        } catch (err) {
          console.error(`Error checking messages for match ${matchId}:`, err);
        }
      }
    } catch (err) {
      console.error('Error checking for new messages:', err);
    }
  };

  // Check for new matches
  const checkNewMatches = async () => {
    if (!notificationsEnabled) return;

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const matchesRes = await fetch(`${API_BASE_URL}/match/matches`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!matchesRes.ok) return;

      const matchesData = await matchesRes.json();
      const allMatches = Array.isArray(matchesData)
        ? matchesData
        : [...(matchesData.matched || []), ...(matchesData.pending_approval || [])];

      const currentMatchIds = new Set(
        allMatches.map((m) => m.match_id).filter((id) => id != null)
      );

      // Track match id set only; do not schedule local match notifications — server push carries
      // role-specific copy (dater vs matchmaker). Polling used wrong names for matchmakers.
      lastMatchIdsRef.current = currentMatchIds;
    } catch (err) {
      console.error('Error checking for new matches:', err);
    }
  };

  // Initialize polling
  useEffect(() => {
    if (!notificationsEnabled) {
      // Clear polling if notifications are disabled
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Initial check - this sets up the baseline without sending notifications
    const initializeBaseline = async () => {
      await checkNewMessages();
      await checkNewMatches();
      // Mark as initialized after first check completes
      setTimeout(() => {
        isInitializedRef.current = true;
      }, 1000); // Small delay to ensure baseline is set
    };

    initializeBaseline();

    // Set up polling interval
    pollingIntervalRef.current = setInterval(() => {
      checkNewMessages();
      checkNewMatches();
    }, POLLING_INTERVAL);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [notificationsEnabled]);

  // Reset state when notifications are disabled
  useEffect(() => {
    if (!notificationsEnabled) {
      lastMessageCountsRef.current = {};
      lastMatchIdsRef.current = new Set();
      isInitializedRef.current = false;
    }
  }, [notificationsEnabled]);

  return {
    checkNewMessages,
    checkNewMatches,
  };
};

