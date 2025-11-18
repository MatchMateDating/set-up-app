// utils/startLocationWatcher.js
let watchId = null;
let currentToken = null;

export const startLocationWatcher = (API_BASE_URL, token) => {
  if (!token) return;
  if (!navigator.geolocation) {
    console.warn("Geolocation not supported");
    return;
  }

  // If there's an existing watcher but token changed, restart it
  if (watchId !== null && currentToken !== token) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    currentToken = null;
  }

  // already tracking with same token? do nothing
  if (watchId !== null && currentToken === token) return;

  currentToken = token;

  watchId = navigator.geolocation.watchPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        await fetch(`${API_BASE_URL}/location/update`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`,
          },
          body: JSON.stringify({ latitude, longitude }),
        });

        window.dispatchEvent(new Event("locationUpdated"));
        console.log("Location updated:", latitude, longitude);
      } catch (err) {
        console.error("Failed to update location:", err);
      }
    },
    (error) => console.warn("Geolocation error:", error),
    {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 20000,
    }
  );
};

export const stopLocationWatcher = () => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    currentToken = null;
  }
};
