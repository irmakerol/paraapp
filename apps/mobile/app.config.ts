import type { ExpoConfig } from 'expo/config';

// Build-time settings. EXPO_PUBLIC_* values are also inlined into the app bundle.
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
// Google Sign-In on iOS returns to the app through the reversed iOS client ID.
const googleUrlScheme = googleIosClientId
  ? `com.googleusercontent.apps.${googleIosClientId.replace('.apps.googleusercontent.com', '')}`
  : 'com.googleusercontent.apps.unset';

const config: ExpoConfig = {
  name: 'Fly Anatolia',
  slug: 'fly-anatolia',
  scheme: 'flyanatolia',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    bundleIdentifier: 'com.flyanatolia.paraapp',
    buildNumber: process.env.IOS_BUILD_NUMBER ?? '1',
    supportsTablet: false,
    usesAppleSignIn: true,
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      UIBackgroundModes: ['location', 'audio'],
      CFBundleAllowMixedLocalizations: true,
    },
  },
  locales: {
    tr: './locales/ios-tr.json',
    en: './locales/ios-en.json',
  },
  plugins: [
    'expo-localization',
    'expo-web-browser',
    'expo-apple-authentication',
    ['expo-audio', { microphonePermission: false }],
    [
      'expo-location',
      {
        isIosBackgroundLocationEnabled: true,
        locationAlwaysPermission:
          'Fly Anatolia keeps recording your flight when the screen is locked.',
        locationWhenInUsePermission:
          'Fly Anatolia records your flight track with GPS while you fly.',
        locationAlwaysAndWhenInUsePermission:
          'Fly Anatolia keeps recording your flight when the screen is locked. Choose “Always” so a flight is not cut off.',
      },
    ],
    [
      'expo-sensors',
      { motionPermission: 'Fly Anatolia uses the barometer for an accurate climb rate (vario).' },
    ],
    ['expo-build-properties', { ios: { deploymentTarget: '15.1' } }],
    ['@react-native-google-signin/google-signin', { iosUrlScheme: googleUrlScheme }],
  ],
};

export default config;
