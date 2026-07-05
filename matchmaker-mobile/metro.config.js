const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.projectRoot = __dirname;
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

const admobEnabled = process.env.EXPO_PUBLIC_ADMOB_ENABLED === 'true';
const stubPath = path.resolve(__dirname, 'src/ads/admobStub.js');

if (!admobEnabled) {
  const defaultResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'react-native-google-mobile-ads') {
      return {
        filePath: stubPath,
        type: 'sourceFile',
      };
    }
    if (defaultResolveRequest) {
      return defaultResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
