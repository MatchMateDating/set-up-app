import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const MATCH_PREVIEW_UPDATED_EVENT = 'matchPreviewUpdated';

const GENERIC_PREVIEW = 'Sent a message';
const previewCache = new Map();
const hydrationInFlight = new Set();

function isUsablePreview(text) {
  const trimmed = (text || '').trim();
  return !!trimmed && trimmed !== GENERIC_PREVIEW;
}

function puzzlePreviewLabel(puzzleType) {
  if (!puzzleType) return GENERIC_PREVIEW;
  return `Sent a ${String(puzzleType).replace(/_/g, ' ')}`;
}

function getLinkedDaterId(userInfo) {
  const raw = userInfo?.referrer_id ?? userInfo?.referred_by_id;
  if (raw == null) return null;
  const parsed = parseInt(String(raw), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveMessageText(msg) {
  if (!msg) return '';
  return String(msg.text ?? msg.message ?? '').trim();
}

function pickPreviewText(apiText, cachedText) {
  const api = (apiText || '').trim();
  const cached = (cachedText || '').trim();
  if (isUsablePreview(api)) return api;
  if (isUsablePreview(cached)) return cached;
  return api || cached;
}

function parseMessageTimestamp(isoString) {
  if (!isoString) return 0;
  const ms = Date.parse(isoString);
  return Number.isFinite(ms) ? ms : 0;
}

function pickNewerPreviewFields(incoming, existing) {
  const incomingTs = parseMessageTimestamp(incoming?.last_message_time);
  const existingTs = parseMessageTimestamp(existing?.last_message_time);

  if (incomingTs > existingTs) {
    return {
      last_message: pickPreviewText(incoming.last_message, existing.last_message),
      last_message_time: incoming.last_message_time ?? existing.last_message_time ?? null,
      last_message_from_self:
        incoming.last_message_from_self ?? existing.last_message_from_self ?? false,
    };
  }
  if (existingTs > incomingTs) {
    return {
      last_message: pickPreviewText(existing.last_message, incoming.last_message),
      last_message_time: existing.last_message_time ?? incoming.last_message_time ?? null,
      last_message_from_self:
        existing.last_message_from_self ?? incoming.last_message_from_self ?? false,
    };
  }

  return {
    last_message: pickPreviewText(incoming.last_message, existing.last_message),
    last_message_time: incoming.last_message_time ?? existing.last_message_time ?? null,
    last_message_from_self:
      incoming.last_message_from_self ?? existing.last_message_from_self ?? false,
  };
}

export function cacheMatchPreview(matchId, fields) {
  const id = Number(matchId);
  if (!Number.isFinite(id) || !fields) return;

  const existing = previewCache.get(id) || {};
  const next = pickNewerPreviewFields(fields, existing);

  if (!next.last_message && !next.last_message_time) {
    previewCache.delete(id);
    return;
  }

  previewCache.set(id, next);
}

export function seedMatchPreviewsFromMatches(matches) {
  const lists = Array.isArray(matches)
    ? matches
    : [...(matches?.matched || []), ...(matches?.pending_approval || [])];

  for (const match of lists) {
    if (!match?.match_id) continue;
    if (!match.last_message && !match.last_message_time) continue;
    cacheMatchPreview(match.match_id, {
      last_message: match.last_message,
      last_message_time: match.last_message_time,
      last_message_from_self: match.last_message_from_self,
    });
  }
}

export function mergeMatchPreviewData(matchObj) {
  if (!matchObj) return null;

  const id = Number(matchObj.match_id);
  const cached = Number.isFinite(id) ? previewCache.get(id) : null;
  if (!cached) return matchObj;

  const preview = pickNewerPreviewFields(
    {
      last_message: matchObj.last_message,
      last_message_time: matchObj.last_message_time,
      last_message_from_self: matchObj.last_message_from_self,
    },
    cached
  );

  return { ...matchObj, ...preview };
}

export function applyCachedPreviewsToMatches(matches) {
  if (Array.isArray(matches)) {
    return matches.map((match) => mergeMatchPreviewData(match) || match);
  }
  return {
    matched: (matches?.matched || []).map((match) => mergeMatchPreviewData(match) || match),
    pending_approval: (matches?.pending_approval || []).map(
      (match) => mergeMatchPreviewData(match) || match
    ),
  };
}

export function isMessageFromViewer(msg, userInfo) {
  if (!msg || !userInfo?.id) return false;
  if (msg.sender_id === userInfo.id) return true;
  const linkedDaterId = getLinkedDaterId(userInfo);
  return (
    userInfo.role === 'matchmaker' &&
    linkedDaterId != null &&
    msg.sender_id === linkedDaterId
  );
}

export function messageToPreviewFields(msg, userInfo) {
  if (!msg) return null;

  const text = resolveMessageText(msg);
  const preview = text || puzzlePreviewLabel(msg.puzzle_type);

  return {
    last_message: preview,
    last_message_time: msg.timestamp || null,
    last_message_from_self: isMessageFromViewer(msg, userInfo),
  };
}

export function getLastMessageFromList(messages, userInfo) {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  return messageToPreviewFields(messages[messages.length - 1], userInfo);
}

export function matchHasConversationMessages(matchObj, userInfo) {
  const merged = mergeMatchPreviewData(matchObj) || matchObj;
  if (!merged) return false;

  const preview = (merged.last_message || '').trim();
  if (preview) return true;
  if (merged.last_message_time) return true;

  const sentCount =
    typeof merged.message_count === 'number' ? merged.message_count : 0;
  return userInfo?.role === 'matchmaker' && sentCount > 0;
}

export function getMatchCardMessagePreview(matchObj, userInfo) {
  const merged = mergeMatchPreviewData(matchObj) || matchObj || {};
  const preview = (merged.last_message || '').trim();
  const hasMessages = matchHasConversationMessages(matchObj, userInfo);
  const sentCount =
    typeof merged.message_count === 'number' ? merged.message_count : 0;
  const fromSelf =
    !!merged.last_message_from_self ||
    (userInfo?.role === 'matchmaker' && sentCount > 0);

  if (!hasMessages) {
    return {
      body: '',
      showYouPrefix: false,
      hasMessages: false,
    };
  }

  const body = preview || GENERIC_PREVIEW;

  return {
    body,
    showYouPrefix: fromSelf && !!preview,
    hasMessages: true,
  };
}

function normalizeConversationMessages(rawMessages) {
  if (!Array.isArray(rawMessages)) return [];
  return rawMessages.map((msg, index) => ({
    ...msg,
    text: typeof msg?.text === 'string' ? msg.text : (msg?.message || ''),
  }));
}

function flattenMatchesList(matches) {
  if (Array.isArray(matches)) return matches;
  return [...(matches?.matched || []), ...(matches?.pending_approval || [])];
}

/** True when the list row lacks real preview text but likely has conversation history. */
export function matchNeedsPreviewHydration(matchObj, userInfo) {
  if (!matchObj?.match_id) return false;

  const merged = mergeMatchPreviewData(matchObj) || matchObj;
  if (isUsablePreview(merged.last_message)) return false;

  if ((merged.unread_count || 0) > 0) return true;
  if (merged.last_message_time) return true;

  const sentCount = typeof merged.message_count === 'number' ? merged.message_count : 0;
  if (userInfo?.role === 'matchmaker' && sentCount > 0) return true;

  return false;
}

async function fetchConversationMessages(apiBaseUrl, matchId, token) {
  const res = await fetch(`${apiBaseUrl}/conversation/${matchId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];

  const data = await res.json();
  const raw = Array.isArray(data) && data[0]?.messages ? data[0].messages : data;
  return normalizeConversationMessages(raw || []);
}

/** Load last-message previews for rows that are missing usable text (e.g. before opening a thread). */
export async function hydrateMissingMatchPreviews(matches, userInfo, apiBaseUrl) {
  if (!userInfo?.id || !apiBaseUrl) return false;

  const token = await AsyncStorage.getItem('token');
  if (!token) return false;

  const toHydrate = flattenMatchesList(matches).filter((match) =>
    matchNeedsPreviewHydration(match, userInfo)
  );
  if (toHydrate.length === 0) return false;

  let didUpdate = false;
  await Promise.all(
    toHydrate.map(async (match) => {
      const matchId = Number(match.match_id);
      if (!Number.isFinite(matchId) || hydrationInFlight.has(matchId)) return;

      hydrationInFlight.add(matchId);
      try {
        const messages = await fetchConversationMessages(
          apiBaseUrl,
          matchId,
          token
        );
        if (messages.length === 0) return;
        syncMatchPreviewFromMessages(matchId, messages, userInfo);
        didUpdate = true;
      } catch (err) {
        console.error(`Failed to hydrate preview for match ${matchId}:`, err);
      } finally {
        hydrationInFlight.delete(matchId);
      }
    })
  );

  return didUpdate;
}

export function emitMatchPreviewUpdate(matchId, fields) {
  const id = Number(matchId);
  if (!Number.isFinite(id) || !fields) return;
  cacheMatchPreview(id, fields);
  DeviceEventEmitter.emit(MATCH_PREVIEW_UPDATED_EVENT, {
    matchId: id,
    ...previewCache.get(id),
  });
}

export function syncMatchPreviewFromMessages(matchId, messages, userInfo) {
  const id = Number(matchId);
  if (!Number.isFinite(id)) return;

  const preview = getLastMessageFromList(messages, userInfo);
  if (preview) {
    emitMatchPreviewUpdate(id, preview);
    return;
  }

  emitMatchPreviewUpdate(id, {
    last_message: null,
    last_message_time: null,
    last_message_from_self: false,
  });
}
