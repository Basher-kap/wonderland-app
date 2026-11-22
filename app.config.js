// Build variants. APP_VARIANT is set per EAS build profile in eas.json:
//   preview     -> "Wonderland",      com.wonderlandgame.app       LIVE Firebase project (the APK real users install)
//   production  -> "Wonderland",      com.wonderlandgame.app       same as preview (reserved for a future Play Store release)
//   development -> "Wonderland Dev",  com.wonderlandgame.app.dev   TEST Firebase project (wonderland-test)
// The dev build has its own package id, so it installs next to the live app and never touches live data.
// The .dev package id must be registered as an Android app in the test Firebase project (see ENVIRONMENTS.md).
//
// The Firebase keys (EXPO_PUBLIC_FIREBASE_*) come from the EAS environment of the same name
// (eas env:create --environment preview ...) and, for local runs, from .env / .env.development.
// google-services.json comes from the EAS file variable GOOGLE_SERVICES_JSON of that environment,
// or locally from ./google-services.json (live) / ./google-services.development.json (test).
const VARIANTS = {
  production: { name: 'Wonderland', suffix: '' },
  preview: { name: 'Wonderland', suffix: '' },
  development: { name: 'Wonderland Dev', suffix: '.dev' },
};

module.exports = ({ config }) => {
  const key = process.env.APP_VARIANT ?? 'production';
  const variant = VARIANTS[key];
  if (!variant) throw new Error(`Unknown APP_VARIANT "${key}". Use production, preview or development.`);

  const localFile = variant.suffix === '' ? './google-services.json' : `./google-services.${key}.json`;

  return {
    ...config,
    name: variant.name,
    android: {
      ...config.android,
      package: `com.wonderlandgame.app${variant.suffix}`,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? localFile,
    },
    ios: config.ios && {
      ...config.ios,
      ...(variant.suffix ? { bundleIdentifier: `com.wonderlandgame.app${variant.suffix}` } : {}),
    },
    extra: { ...config.extra, appVariant: key },
  };
};
