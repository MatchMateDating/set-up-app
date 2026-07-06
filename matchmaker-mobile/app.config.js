// Dynamic config so EAS Build can inject google-services.json via GOOGLE_SERVICES_JSON
// (file env var — see https://docs.expo.dev/eas/environment-variables/#file-environment-variables).
// Locally, use ./google-services.json (gitignored) as in app.json.
const appJson = require('./app.json');
const { loadProjectEnv } = require('./scripts/loadEnv');

loadProjectEnv();

const plugins = [
  ...(appJson.expo.plugins || []),
  'expo-dev-client',
  './plugins/withAndroidLongPaths',
];

module.exports = () => ({
  expo: {
    ...appJson.expo,
    scheme: appJson.expo.scheme ?? 'matchmaker-mobile',
    plugins,
    android: {
      ...appJson.expo.android,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    },
  },
});
