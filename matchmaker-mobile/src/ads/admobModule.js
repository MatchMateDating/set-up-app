import Constants, { ExecutionEnvironment } from 'expo-constants';
import { TurboModuleRegistry } from 'react-native';

let cachedModule = null;
let cachedAvailable = null;

const isExpoGo = () =>
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.appOwnership === 'expo';

/** Off by default until you rebuild with AdMob and set EXPO_PUBLIC_ADMOB_ENABLED=true */
export const isAdMobEnabledInConfig = () =>
  process.env.EXPO_PUBLIC_ADMOB_ENABLED === 'true';

/**
 * AdMob requires custom native code. Never import the package at module scope —
 * its entry file calls TurboModuleRegistry.getEnforcing and crashes without native code.
 */
export const isAdMobAvailable = () => {
  if (!isAdMobEnabledInConfig()) {
    return false;
  }

  if (cachedAvailable !== null) {
    return cachedAvailable;
  }

  try {
    if (isExpoGo()) {
      cachedAvailable = false;
      return false;
    }

    cachedAvailable = TurboModuleRegistry.get('RNGoogleMobileAdsModule') != null;
    return cachedAvailable;
  } catch (err) {
    console.warn('AdMob availability check failed:', err);
    cachedAvailable = false;
    return false;
  }
};

export const getAdMobModule = () => {
  if (!isAdMobAvailable()) {
    return null;
  }

  if (cachedModule) {
    return cachedModule;
  }

  try {
    cachedModule = require('react-native-google-mobile-ads');
    return cachedModule;
  } catch (err) {
    console.warn('AdMob module could not be loaded:', err);
    cachedAvailable = false;
    cachedModule = null;
    return null;
  }
};

export const initializeAdMob = () => {
  try {
    const mod = getAdMobModule();
    if (!mod) {
      return Promise.resolve();
    }

    return mod.default().initialize().catch((err) => {
      console.error('AdMob initialization failed:', err);
    });
  } catch (err) {
    console.warn('AdMob initialization skipped:', err);
    return Promise.resolve();
  }
};
