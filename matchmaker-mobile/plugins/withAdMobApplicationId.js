const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const ADMOB_APP_ID_META = 'com.google.android.gms.ads.APPLICATION_ID';

/**
 * Ensures the AdMob application ID meta-data name is correct in AndroidManifest.
 * A bad merge can leave "com.google.android.gms.ads. " which crashes MobileAdsInitProvider.
 */
module.exports = function withAdMobApplicationId(config, { androidAppId } = {}) {
  if (!androidAppId) {
    return config;
  }

  return withAndroidManifest(config, (manifestConfig) => {
    const manifest = manifestConfig.modResults;
    AndroidConfig.Manifest.ensureToolsAvailable(manifest);

    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    const metaData = mainApplication['meta-data'] ?? [];
    mainApplication['meta-data'] = metaData;

    const broken = metaData.find((item) => {
      const name = item.$?.['android:name'] ?? '';
      return name.startsWith('com.google.android.gms.ads.') && name !== ADMOB_APP_ID_META;
    });

    if (broken) {
      const index = metaData.indexOf(broken);
      metaData.splice(index, 1);
    }

    const existing = metaData.find((item) => item.$?.['android:name'] === ADMOB_APP_ID_META);
    if (existing) {
      existing.$['android:value'] = androidAppId;
      existing.$['tools:replace'] = 'android:value';
    } else {
      metaData.push({
        $: {
          'android:name': ADMOB_APP_ID_META,
          'android:value': androidAppId,
          'tools:replace': 'android:value',
        },
      });
    }

    return manifestConfig;
  });
};
