import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

const IOS_NATIVE_UNIT_ID = process.env.EXPO_PUBLIC_ADMOB_IOS_NATIVE_UNIT_ID;
const ANDROID_NATIVE_UNIT_ID = process.env.EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_UNIT_ID;

export const getNativeAdUnitId = () => {
  const productionId =
    Platform.OS === 'ios' ? IOS_NATIVE_UNIT_ID : ANDROID_NATIVE_UNIT_ID;

  if (productionId) {
    return productionId;
  }

  if (__DEV__) {
    return TestIds.NATIVE;
  }

  return TestIds.NATIVE;
};

/** Random interval between 3 and 8 profile cards (inclusive). */
export const randomAdInterval = () => 3 + Math.floor(Math.random() * 6);
