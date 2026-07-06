const { withGradleProperties } = require('expo/config-plugins');

/**
 * Windows builds hit MAX_PATH when the repo lives under a long path like
 * Downloads/Apps/set-up-app/matchmaker-mobile. AGP can opt into long paths when
 * the OS setting is enabled (Windows 10 1607+).
 */
module.exports = function withAndroidLongPaths(config) {
  return withGradleProperties(config, (gradleConfig) => {
    const props = gradleConfig.modResults;
    const upsert = (key, value) => {
      const existing = props.find((item) => item.type === 'property' && item.key === key);
      if (existing) {
        existing.value = value;
      } else {
        props.push({ type: 'property', key, value });
      }
    };

    upsert('android.enableLongPaths', 'true');
    // Faster local dev builds; override with -PreactNativeArchitectures if needed.
    upsert('reactNativeArchitectures', 'arm64-v8a');

    return gradleConfig;
  });
};
