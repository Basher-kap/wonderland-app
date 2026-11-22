// Build variants. APP_VARIANT is set per EAS build profile in eas.json:
//   production (default) -> "Wonderland",          com.wonderlandgame.app          (live Firebase project)
//   preview              -> "Wonderland Preview",  com.wonderlandgame.app.preview  (TEST Firebase project)
//   development          -> "Wonderland Dev",      com.wonderlandgame.app.dev      (TEST Firebase project)
// Different package ids let all three install side by side on one phone. Each package id must be
// registered as its own Android app in the Firebase project it talks to (see ENVIRONMENTS.md).
//
// The Firebase keys (EXPO_PUBLIC_FIREBASE_*) come from the EAS environment of the same name
// (eas env:create --environment preview ...) and, for local runs, from .env / .env.development.
// google-services.json comes from the EAS file variable GOOGLE_SERVICES_JSON of that environment,
// or locally from ./google-services.json (production) / ./google-services.<variant>.json.
const VARIANTS = {
  production: { name: 'Wonderland', suffix: '' },
  preview: { name: 'Wonderland Preview', suffix: '.preview' },
  development: { name: 'Wonderland Dev', suffix: '.dev' },
};

module.exports = ({ config }) => {
  const key = process.env.APP_VARIANT ?? 'production';
  const variant = VARIANTS[key];
  if (!variant) throw new Error(`Unknown APP_VARIANT "${key}". Use production, preview or development.`);

  const localFile = key === 'production' ? './google-services.json' : `./google-services.${key}.json`;

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
