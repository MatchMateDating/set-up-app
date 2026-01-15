// src/components/conversations/hooks/useNotificationPolling.js
// This polling hook serves as a fallback for when push notifications fail
// or when the app is in the foreground. Backend push notifications are the primary method.
import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotifications } from '../../../context/NotificationContext';
import { API_BASE_URL } from '../../../env';

const POLLING_INTERVAL = 30000; // 30 seconds

export const useNotificationPolling = () => {
  const { notificationsEnabled, sendNotification } = useNotifications();
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

          // If there are new messages and we've already initialized (don't notify on first load)
          if (currentMessageCount > lastCount && isInitializedRef.current && lastCount > 0) {
            const newMessages = messages.slice(lastCount);
            const latestMessage = newMessages[newMessages.length - 1];

            // Get sender name
            let senderName = 'Someone';
            try {
              const senderRes = await fetch(`${API_BASE_URL}/profile/${latestMessage.sender_id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (senderRes.ok) {
                const senderData = await senderRes.json();
                senderName = senderData.user?.first_name || senderData.first_name || 'Someone';
              }
            } catch (err) {
              console.error('Error fetching sender name:', err);
            }

            // Get match user name for context
            let matchUserName = '';
            if (match.match_user) {
              matchUserName = match.match_user.first_name || '';
            }

            const notificationTitle = matchUserName
              ? `New message from ${senderName}`
              : `New message from ${senderName}`;
            const notificationBody = latestMessage.text
              ? latestMessage.text.substring(0, 100)
              : 'You have a new message';

            sendNotification(notificationTitle, notificationBody, {
              type: 'message',
              matchId: matchId.toString(),
            });
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

      // Find new matches (only if initialized, to avoid notifying for existing matches on first load)
      const newMatchIds = isInitializedRef.current
        ? [...currentMatchIds].filter((id) => !lastMatchIdsRef.current.has(id))
        : [];

      // Send notifications for new matches
      for (const matchId of newMatchIds) {
        const match = allMatches.find((m) => m.match_id === matchId);
        if (!match) continue;

        let matchUserName = 'Someone';
        if (match.match_user) {
          matchUserName = match.match_user.first_name || 'Someone';
        }

        const notificationTitle = 'New Match!';
        const notificationBody = `You have a new match with ${matchUserName}`;

        sendNotification(notificationTitle, notificationBody, {
          type: 'match',
          matchId: matchId.toString(),
        });
      }

      // Update last known match IDs
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

