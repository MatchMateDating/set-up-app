// Dynamic config so EAS Build can inject google-services.json via GOOGLE_SERVICES_JSON
// (file env var — see https://docs.expo.dev/eas/environment-variables/#file-environment-variables).
// Locally, use ./google-services.json (gitignored) as in app.json.
const appJson = require('./app.json');
const { loadProjectEnv } = require('./scripts/loadEnv');

loadProjectEnv();

const GOOGLE_SAMPLE_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const GOOGLE_SAMPLE_IOS_APP_ID = 'ca-app-pub-3940256099942544~1458002511';

const admobEnabled = process.env.EXPO_PUBLIC_ADMOB_ENABLED === 'true';

const plugins = [
  ...(appJson.expo.plugins || []),
  'expo-dev-client',
  './plugins/withAndroidLongPaths',
];

if (admobEnabled) {
  plugins.push([
    'react-native-google-mobile-ads',
    {
      androidAppId:
        process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID ?? GOOGLE_SAMPLE_ANDROID_APP_ID,
      iosAppId:
        process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID ?? GOOGLE_SAMPLE_IOS_APP_ID,
    },
  ]);
}

module.exports = () => ({
  expo: {
    ...appJson.expo,
    scheme: appJson.expo.scheme ?? 'matchmaker-mobile',
    plugins,
    ...(admobEnabled
      ? {}
      : {
          autolinking: {
            exclude: ['react-native-google-mobile-ads'],
          },
        }),
    android: {
      ...appJson.expo.android,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    },
  },
});
