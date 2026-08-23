const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

export function isSecurePushContext() {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext === true;
}

export function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  const standaloneMq =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  return Boolean(standaloneMq || window.navigator.standalone === true);
}

function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * @returns {{ supported: boolean, reason?: string }}
 */
export function getWebPushSupport() {
  if (typeof window === 'undefined') {
    return { supported: false, reason: 'unavailable' };
  }
  if (!isSecurePushContext()) {
    return {
      supported: false,
      reason:
        'Web Push needs HTTPS (or localhost). Use a secure URL or Add to Home Screen from a deployed site.',
    };
  }
  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return { supported: false, reason: 'This browser does not support Web Push.' };
  }
  if (isIosDevice() && !isStandalonePwa()) {
    return {
      supported: false,
      reason:
        'On iPhone, add Matchmate to your Home Screen, open it from the icon, then enable notifications.',
    };
  }
  return { supported: true };
}

export function isWebPushSupported() {
  return getWebPushSupport().supported;
}

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Match backend json.dumps(..., sort_keys=True) shape for PushSubscription storage.
 * Returns a subscription object (not string) for the API body.
 */
export function subscriptionToApiPayload(subscription) {
  const json =
    typeof subscription.toJSON === 'function' ? subscription.toJSON() : subscription;
  if (!json?.endpoint || !json?.keys?.p256dh || !json?.keys?.auth) return null;
  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: {
      auth: json.keys.auth,
      p256dh: json.keys.p256dh,
    },
  };
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  if (!isSecurePushContext()) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

async function fetchVapidPublicKey() {
  const fromEnv = (process.env.REACT_APP_VAPID_PUBLIC_KEY || '').trim();
  if (fromEnv) return fromEnv;
  if (!API_BASE_URL) return null;
  const res = await fetch(`${API_BASE_URL}/notifications/vapid_public_key`);
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return (data.publicKey || '').trim() || null;
}

async function registerTokenWithApi(pushToken) {
  const authToken = localStorage.getItem('token');
  if (!authToken || !API_BASE_URL) {
    return { ok: false, error: 'Not signed in' };
  }
  const res = await fetch(`${API_BASE_URL}/notifications/register_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      platform: 'web',
      push_token: pushToken,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error || `Register failed (${res.status})` };
  }
  return { ok: true };
}

async function unregisterTokenWithApi(pushToken) {
  const authToken = localStorage.getItem('token');
  if (!authToken || !API_BASE_URL || !pushToken) return { ok: true };
  try {
    await fetch(`${API_BASE_URL}/notifications/unregister_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ push_token: pushToken }),
    });
  } catch (_) {
    /* ignore */
  }
  return { ok: true };
}

/**
 * Request permission, subscribe, and register with the API.
 * @returns {{ ok: boolean, status: string, message?: string }}
 */
export async function subscribeWebPush() {
  const support = getWebPushSupport();
  if (!support.supported) {
    return { ok: false, status: 'unsupported', message: support.reason };
  }

  await registerServiceWorker();
  const registration = await navigator.serviceWorker.ready;

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return {
      ok: false,
      status: 'denied',
      message:
        'Browser blocked notifications. Allow them in browser settings, then try again.',
    };
  }

  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) {
    return {
      ok: false,
      status: 'misconfigured',
      message:
        'Web Push is not configured on the server yet (missing VAPID public key).',
    };
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    } catch (err) {
      console.warn('Push subscribe failed:', err);
      return {
        ok: false,
        status: 'error',
        message: 'Could not subscribe to Web Push in this browser.',
      };
    }
  }

  const payload = subscriptionToApiPayload(subscription);
  if (!payload) {
    return { ok: false, status: 'error', message: 'Invalid push subscription.' };
  }

  const registered = await registerTokenWithApi(payload);
  if (!registered.ok) {
    return {
      ok: false,
      status: 'error',
      message: registered.error || 'Failed to save push subscription.',
    };
  }

  return { ok: true, status: 'subscribed' };
}

/** Unsubscribe locally and remove token from API. */
export async function unsubscribeWebPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: true, status: 'unsupported' };
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const payload = subscriptionToApiPayload(subscription);
      if (payload) {
        await unregisterTokenWithApi(payload);
      }
      await subscription.unsubscribe();
    }
  } catch (err) {
    console.warn('Web Push unsubscribe failed:', err);
  }
  return { ok: true, status: 'unsubscribed' };
}

export async function getWebPushStatus() {
  const support = getWebPushSupport();
  if (!support.supported) {
    return { status: 'unsupported', message: support.reason };
  }
  if (Notification.permission === 'denied') {
    return {
      status: 'denied',
      message:
        'Browser blocked notifications. Allow them in browser settings, then try again.',
    };
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = registration
      ? await registration.pushManager.getSubscription()
      : null;
    if (subscription) {
      return {
        status: 'subscribed',
        message: 'This browser is subscribed for Web Push.',
      };
    }
  } catch (_) {
    /* ignore */
  }
  if (Notification.permission === 'granted') {
    return {
      status: 'ready',
      message: 'Permission granted — enable notifications to subscribe.',
    };
  }
  return {
    status: 'prompt',
    message: 'Enable notifications to allow browser alerts.',
  };
}
