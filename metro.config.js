// react-native-webrtc (voice chat) needs event-target-shim v6, while React Native itself uses v5.
// This makes only the files of react-native-webrtc resolve their own copy.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('event-target-shim') && context.originModulePath.includes('react-native-webrtc')) {
    return {
      filePath: require.resolve(moduleName, { paths: [path.dirname(context.originModulePath)] }),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
