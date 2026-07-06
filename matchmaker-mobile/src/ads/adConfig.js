import { Platform } from 'react-native';

const IOS_NATIVE_UNIT_ID = process.env.EXPO_PUBLIC_ADMOB_IOS_NATIVE_UNIT_ID;
const ANDROID_NATIVE_UNIT_ID = process.env.EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_UNIT_ID;

const GOOGLE_TEST_NATIVE_UNIT_ID = Platform.select({
  ios: 'ca-app-pub-3940256099942544/3986624511',
  android: 'ca-app-pub-3940256099942544/2247696110',
  default: 'ca-app-pub-3940256099942544/2247696110',
});

export const getNativeAdUnitId = () => {
  const productionId =
    Platform.OS === 'ios' ? IOS_NATIVE_UNIT_ID : ANDROID_NATIVE_UNIT_ID;

  if (productionId) {
    return productionId;
  }

  return GOOGLE_TEST_NATIVE_UNIT_ID;
};

/** Show a native ad after a random number of profile cards in this range (inclusive). */
export const MIN_PROFILES_BETWEEN_ADS = 2;
export const MAX_PROFILES_BETWEEN_ADS = 2;

export const getRandomProfilesUntilAd = () =>
  Math.floor(
    Math.random() * (MAX_PROFILES_BETWEEN_ADS - MIN_PROFILES_BETWEEN_ADS + 1)
  ) + MIN_PROFILES_BETWEEN_ADS;
