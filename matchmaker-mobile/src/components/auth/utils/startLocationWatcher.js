// Mobile location watcher - requests permission, fetches position, sends to backend
import * as Location from 'expo-location';

let watchSubscription = null;
let currentToken = null;

const locationUpdatedListeners = new Set();
export function subscribeToLocationUpdated(callback) {
  locationUpdatedListeners.add(callback);
  return () => locationUpdatedListeners.delete(callback);
}
function notifyLocationUpdated() {
  locationUpdatedListeners.forEach((cb) => cb());
}

function extractCityState(place) {
  if (!place) return { city: null, state: null };
  // Expo LocationGeocodedAddress: city, region (state), subregion, district, name, formattedAddress
  let city = place.city || place.subregion || place.district || place.name || null;
  let state = place.region || null;

  // iOS often returns null for city; try parsing from formattedAddress
  if ((!city || !state) && place.formattedAddress) {
    const parts = place.formattedAddress.split(',').map((s) => s.trim());
    if (parts.length >= 2) {
      // "123 Main St, Brooklyn, NY 11201, USA" (4) or "Brooklyn, NY 11201, USA" (3) or "Brooklyn, NY, USA" (3)
      const last = parts[parts.length - 1];
      const isCountry = last && last.length <= 3; // USA, UK, etc
      const stateIdx = isCountry ? parts.length - 2 : parts.length - 1;
      if (!city) city = parts.length >= 4 ? parts[1] : parts[0];
      if (!state && stateIdx >= 0) {
        const statePart = parts[stateIdx];
        const match = statePart.match(/^([A-Za-z]{2})\s*\d/);
        state = match ? match[1] : (statePart.length <= 3 ? statePart : statePart.replace(/\s*\d{5}(-\d{4})?/, '').trim());
      }
    }
  }
  return { city, state };
}

async function sendLocationUpdate(apiBaseUrl, token, latitude, longitude) {
  let city = null;
  let state = null;
  try {
    const places = await Location.reverseGeocodeAsync({ latitude, longitude });
    const place = places && places[0];
    if (place) {
      ({ city, state } = extractCityState(place));
    }
  } catch (e) {
    if (__DEV__) console.warn('Reverse geocode failed:', e.message);
  }

  const res = await fetch(`${apiBaseUrl}/location/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ latitude, longitude, city, state }),
  });
  if (res.ok && (city || state)) {
    notifyLocationUpdated();
  }
  if (!res.ok && __DEV__) {
    console.warn('[Location] update failed:', res.status, await res.text());
  }
}

/**
 * Start watching location and sending updates to the backend.
 * Requests permission if needed, then posts to /location/update when position changes.
 * @param {string} apiBaseUrl - e.g. from API_BASE_URL
 * @param {string} token - JWT auth token
 */
export const startLocationWatcher = async (apiBaseUrl, token) => {
  if (!token) return;
  if (!apiBaseUrl) return;

  // If already watching with same token, do nothing
  if (watchSubscription != null && currentToken === token) return;

  // If token changed, stop existing watcher
  if (watchSubscription != null && currentToken !== token) {
    stopLocationWatcher();
  }

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Location permission denied');
      return;
    }

    currentToken = token;

    // Immediate fetch: get position and city/state right away (don't wait for watch callback)
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = location.coords;
      await sendLocationUpdate(apiBaseUrl, token, latitude, longitude);
    } catch (e) {
      if (__DEV__) console.warn('Initial location fetch failed:', e.message);
    }

    watchSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 15000,
        distanceInterval: 50,
      },
      async (location) => {
        const { latitude, longitude } = location.coords;
        try {
          await sendLocationUpdate(apiBaseUrl, currentToken, latitude, longitude);
        } catch (err) {
          console.error('Failed to update location:', err);
        }
      }
    );
  } catch (err) {
    console.error('Location watcher error:', err);
  }
};

/**
 * Stop watching location and clear the subscription.
 */
export const stopLocationWatcher = () => {
  if (watchSubscription) {
    watchSubscription.remove();
    watchSubscription = null;
  }
  currentToken = null;
};
