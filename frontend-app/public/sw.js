/* Matchmate Web Push service worker (no offline caching). */
/* global self, clients */

function pathForNotificationData(data) {
  if (!data || typeof data !== 'object') return '/conversations';
  const type = data.type;
  const matchId = data.matchId != null && data.matchId !== '' ? String(data.matchId) : null;

  if (matchId && (type === 'message' || type === 'match' || type === 'blind_match' || type === 'match_approval' || type === 'approval')) {
    return `/conversation/${encodeURIComponent(matchId)}`;
  }
  if (type === 'match' || type === 'blind_match' || type === 'match_approval' || type === 'approval') {
    return '/match';
  }
  return '/conversations';
}

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    try {
      payload = { body: event.data ? event.data.text() : '' };
    } catch (__) {
      payload = {};
    }
  }

  const title = payload.title || 'Matchmate';
  const body = payload.body || '';
  const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data,
      icon: '/logo192.png',
      badge: '/favicon.png',
      tag: data.matchId ? `matchmate-${data.matchId}` : 'matchmate',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const path = pathForNotificationData(data);
  const targetUrl = new URL(path, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        if ('focus' in client) {
          try {
            await client.focus();
            if ('navigate' in client) {
              await client.navigate(targetUrl);
              return;
            }
          } catch (_) {
            /* fall through to openWindow */
          }
        }
      }
      if (clients.openWindow) {
        await clients.openWindow(targetUrl);
      }
    })()
  );
});
