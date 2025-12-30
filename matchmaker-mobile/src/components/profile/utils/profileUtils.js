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

export const getZodiacSign = (birthdate) => {
  if (!birthdate) return '';
  const date = new Date(birthdate);
  const month = date.getMonth() + 1; // JS months are 0-based
  const day = date.getDate();

  const zodiacSigns = [
    { name: 'Capricorn', start: [12, 22], end: [1, 19] },
    { name: 'Aquarius', start: [1, 20], end: [2, 18] },
    { name: 'Pisces', start: [2, 19], end: [3, 20] },
    { name: 'Aries', start: [3, 21], end: [4, 19] },
    { name: 'Taurus', start: [4, 20], end: [5, 20] },
    { name: 'Gemini', start: [5, 21], end: [6, 20] },
    { name: 'Cancer', start: [6, 21], end: [7, 22] },
    { name: 'Leo', start: [7, 23], end: [8, 22] },
    { name: 'Virgo', start: [8, 23], end: [9, 22] },
    { name: 'Libra', start: [9, 23], end: [10, 22] },
    { name: 'Scorpio', start: [10, 23], end: [11, 21] },
    { name: 'Sagittarius', start: [11, 22], end: [12, 21] },
  ];

  for (const z of zodiacSigns) {
    const [startM, startD] = z.start;
    const [endM, endD] = z.end;

    if (startM === 12 && endM === 1) {
      // Capricorn crossing year boundary
      if ((month === 12 && day >= startD) || (month === 1 && day <= endD)) return z.name;
    } else {
      if ((month === startM && day >= startD) || (month === endM && day <= endD)) return z.name;
    }
  }

  return '';
};

export const zodiacInfo = (sign) => {
  const ZODIAC_DATA = {
    Aries: {
      traits: ['Bold', 'Confident', 'Passionate'],
      pros: ['Energetic', 'Leader', 'Adventurous'],
      cons: ['Impulsive', 'Impatient'],
      compatible: ['Leo', 'Sagittarius'],
    },
    Taurus: {
      traits: ['Grounded', 'Reliable', 'Patient'],
      pros: ['Loyal', 'Stable'],
      cons: ['Stubborn', 'Resistant to change'],
      compatible: ['Virgo', 'Capricorn'],
    },
    Gemini: {
      traits: ['Curious', 'Adaptable', 'Expressive'],
      pros: ['Communicative', 'Witty'],
      cons: ['Indecisive', 'Restless'],
      compatible: ['Libra', 'Aquarius'],
    },
    Cancer: {
      traits: ['Emotional', 'Caring', 'Intuitive'],
      pros: ['Loyal', 'Protective'],
      cons: ['Moody', 'Sensitive'],
      compatible: ['Scorpio', 'Pisces'],
    },
    Leo: {
      traits: ['Confident', 'Warm', 'Charismatic'],
      pros: ['Creative', 'Generous'],
      cons: ['Prideful', 'Attention-seeking'],
      compatible: ['Aries', 'Sagittarius'],
    },
    Virgo: {
      traits: ['Analytical', 'Kind', 'Detail-oriented'],
      pros: ['Reliable', 'Thoughtful'],
      cons: ['Overcritical', 'Anxious'],
      compatible: ['Taurus', 'Capricorn'],
    },
    Libra: {
      traits: ['Charming', 'Diplomatic', 'Balanced'],
      pros: ['Fair-minded', 'Romantic'],
      cons: ['Avoids conflict', 'Indecisive'],
      compatible: ['Gemini', 'Aquarius'],
    },
    Scorpio: {
      traits: ['Intense', 'Passionate', 'Loyal'],
      pros: ['Focused', 'Brave'],
      cons: ['Jealous', 'Secretive'],
      compatible: ['Cancer', 'Pisces'],
    },
    Sagittarius: {
      traits: ['Adventurous', 'Optimistic', 'Independent'],
      pros: ['Honest', 'Fun-loving'],
      cons: ['Blunt', 'Commitment-averse'],
      compatible: ['Aries', 'Leo'],
    },
    Capricorn: {
      traits: ['Disciplined', 'Ambitious', 'Responsible'],
      pros: ['Patient', 'Reliable'],
      cons: ['Rigid', 'Work-obsessed'],
      compatible: ['Taurus', 'Virgo'],
    },
    Aquarius: {
      traits: ['Innovative', 'Independent', 'Open-minded'],
      pros: ['Visionary', 'Friendly'],
      cons: ['Detached', 'Unpredictable'],
      compatible: ['Gemini', 'Libra'],
    },
    Pisces: {
      traits: ['Empathetic', 'Dreamy', 'Creative'],
      pros: ['Compassionate', 'Intuitive'],
      cons: ['Overly trusting', 'Escapist'],
      compatible: ['Cancer', 'Scorpio'],
    },
  };

  return ZODIAC_DATA[sign] || {
    traits: [],
    pros: [],
    cons: [],
    compatible: [],
  };
};
