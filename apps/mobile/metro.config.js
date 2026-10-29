// Metro: also bundle the shared track code from packages/core (outside this app's folder).
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const coreTracks = path.resolve(__dirname, '../../packages/core/src/tracks');

config.watchFolders = [coreTracks];
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@paraapp/core-tracks') {
    return { type: 'sourceFile', filePath: path.join(coreTracks, 'index.ts') };
  }
  return (defaultResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
