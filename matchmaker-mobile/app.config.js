// Dynamic config so EAS Build can inject google-services.json via GOOGLE_SERVICES_JSON
// (file env var — see https://docs.expo.dev/eas/environment-variables/#file-environment-variables).
// Locally, use ./google-services.json (gitignored) as in app.json.
const appJson = require('./app.json');

const GOOGLE_SAMPLE_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const GOOGLE_SAMPLE_IOS_APP_ID = 'ca-app-pub-3940256099942544~1458002511';

module.exports = () => ({
  expo: {
    ...appJson.expo,
    plugins: [
      ...(appJson.expo.plugins || []),
      [
        'react-native-google-mobile-ads',
        {
          androidAppId:
            process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID ?? GOOGLE_SAMPLE_ANDROID_APP_ID,
          iosAppId:
            process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID ?? GOOGLE_SAMPLE_IOS_APP_ID,
        },
      ],
    ],
    android: {
      ...appJson.expo.android,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    },
  },
});