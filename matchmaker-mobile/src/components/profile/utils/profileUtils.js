// utils/profileUtils.js
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

