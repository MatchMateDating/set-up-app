const EARTH_RADIUS_MILES = 3958.8;

/** Haversine distance in miles; returns null when coords are missing. */
export const haversineDistanceMiles = (lat1, lon1, lat2, lon2) => {
  if ([lat1, lon1, lat2, lon2].some((v) => v == null || Number.isNaN(Number(v)))) {
    return null;
  }
  const toRad = (deg) => (deg * Math.PI) / 180;
  const rLat1 = toRad(Number(lat1));
  const rLon1 = toRad(Number(lon1));
  const rLat2 = toRad(Number(lat2));
  const rLon2 = toRad(Number(lon2));
  const dLat = rLat2 - rLat1;
  const dLon = rLon2 - rLon1;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** Viewer coords for distance: linked dater when matchmaking, else the signed-in user. */
export const getViewerCoords = (userInfo, referrer) => {
  if (userInfo?.role === 'matchmaker') {
    return { lat: referrer?.latitude, lon: referrer?.longitude };
  }
  return { lat: userInfo?.latitude, lon: userInfo?.longitude };
};

/**
 * Closest profiles first; ties and unknown-distance profiles are shuffled randomly.
 */
export const sortProfilesByDistanceRandom = (profiles, viewerLat, viewerLon) => {
  if (!Array.isArray(profiles) || profiles.length === 0) {
    return profiles;
  }

  const hasViewerCoords =
    viewerLat != null &&
    viewerLon != null &&
    !Number.isNaN(Number(viewerLat)) &&
    !Number.isNaN(Number(viewerLon));

  const withMeta = profiles.map((profile) => ({
    profile,
    distance: hasViewerCoords
      ? haversineDistanceMiles(
          viewerLat,
          viewerLon,
          profile.latitude,
          profile.longitude
        )
      : null,
    tieBreak: Math.random(),
  }));

  withMeta.sort((a, b) => {
    const distA = a.distance ?? Infinity;
    const distB = b.distance ?? Infinity;
    if (distA !== distB) {
      return distA - distB;
    }
    return a.tieBreak - b.tieBreak;
  });

  if (!hasViewerCoords) {
    // No viewer location — fall back to a fully random deck.
    for (let i = withMeta.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [withMeta[i], withMeta[j]] = [withMeta[j], withMeta[i]];
    }
  }

  return withMeta.map(({ profile }) => profile);
};
