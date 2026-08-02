// utils/profileUtils.js
export const PROFILE_THEME_STYLES = {
  pixelCloud: { backgroundColor: '#87CEEB' },
  pixelClouds: { backgroundColor: '#87CEEB' },
  pixelFlower: { backgroundColor: '#F2F6FF' },
  pixelCactus: { backgroundColor: '#FFEBF3' },
  classic: { backgroundColor: '#FFFFFF' },
  minimal: { backgroundColor: '#FFFFFF' },
  bold: { backgroundColor: '#F5F3FF' },
  constitution: { backgroundColor: '#FDF5D9' },
};

export const getProfileThemeBackground = (profileStyle) =>
  (PROFILE_THEME_STYLES[profileStyle] || PROFILE_THEME_STYLES.classic).backgroundColor;

export const normalizeImageLayout = (layout) => {
  if (!layout || layout === 'grid') return 'topRow';
  return layout;
};

export const normalizeProfileStyle = (profileStyle) => {
  if (profileStyle === 'pixelClouds') return 'pixelCloud';
  return profileStyle || 'classic';
};

export const calculateAge = (birthdate) => {
  if (!birthdate) return '';
  const birthDateObj = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birthDateObj.getFullYear();
  const m = today.getMonth() - birthDateObj.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
    age--;
  }
  return age;
};

export const normalizeHeightUnit = (unit) => {
  const normalized = (unit || '').toString().trim().toLowerCase();
  if (normalized === 'imperial' || normalized === 'ft') return 'imperial';
  if (normalized === 'metric' || normalized === 'm') return 'metric';
  return null;
};

const parseHeightToCm = (heightString, sourceUnit) => {
  if (!heightString) return null;
  const text = heightString.toString().trim();
  if (!text) return null;

  const normalizedSourceUnit = normalizeHeightUnit(sourceUnit);

  if (normalizedSourceUnit === 'imperial' || text.includes("'")) {
    const imperialMatch = text.match(/(\d+)\s*'\s*(\d+)?\s*"?/);
    if (!imperialMatch) return null;
    const feet = Number(imperialMatch[1] || 0);
    const inches = Number(imperialMatch[2] || 0);
    return feet * 30.48 + inches * 2.54;
  }

  const metricCmMatch = text.match(/(\d+)\s*m\s*(\d+)?\s*cm?/i);
  if (metricCmMatch) {
    const meters = Number(metricCmMatch[1] || 0);
    const centimeters = Number(metricCmMatch[2] || 0);
    return meters * 100 + centimeters;
  }

  const metricDecimalMatch = text.match(/(\d+(?:\.\d+)?)\s*m/i);
  if (metricDecimalMatch) {
    return Number(metricDecimalMatch[1]) * 100;
  }

  return null;
};

export const convertHeightForViewer = (heightString, sourceUnit, viewerUnit) => {
  const preferredUnit = normalizeHeightUnit(viewerUnit);
  if (!heightString) return '';
  if (!preferredUnit) return heightString;

  const totalCm = parseHeightToCm(heightString, sourceUnit);
  if (totalCm == null || Number.isNaN(totalCm)) return heightString;

  if (preferredUnit === 'imperial') {
    const totalInches = Math.round(totalCm / 2.54);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet}'${inches}"`;
  }

  const roundedCm = Math.round(totalCm);
  const meters = Math.floor(roundedCm / 100);
  const centimeters = roundedCm % 100;
  return `${meters}m ${centimeters}cm`;
};

export const convertFtInToMetersCm = (feet, inches) => {
  const totalInches = parseInt(feet || '0') * 12 + parseInt(inches || '0');
  const totalCm = totalInches * 2.54;
  return {
    meters: Math.floor(totalCm / 100).toString(),
    centimeters: Math.round(totalCm % 100).toString(),
  };
};

export const convertMetersCmToFtIn = (meters, centimeters) => {
  const totalCm = parseInt(meters || '0') * 100 + parseInt(centimeters || '0');
  const totalInches = totalCm / 2.54;
  return {
    feet: Math.floor(totalInches / 12).toString(),
    inches: Math.round(totalInches % 12).toString(),
  };
};

export const formatHeight = (formData, heightUnit) => {
  if (heightUnit === 'ft') {
    return `${formData.heightFeet}'${formData.heightInches}"`;
  }
  return `${formData.heightMeters}m ${formData.heightCentimeters}cm`;
};

/**
 * Get the full image URL, handling both Cloudflare R2 full URLs and local relative paths
 * @param {string} imageUrl - The image URL from the database (can be full URL or relative path)
 * @param {string} apiBaseUrl - The API base URL (for relative paths)
 * @returns {string} - The complete image URL
 */
export const getImageUrl = (imageUrl, apiBaseUrl) => {
  if (!imageUrl) return '';
  
  // If it's already a full URL (starts with http:// or https://), use it directly
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // Otherwise, it's a relative path, prepend the API base URL
  return `${apiBaseUrl}${imageUrl}`;
}; 
