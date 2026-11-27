// app.config.js
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

// Keep any plugins already in app.json, and add expo-audio and expo-image-picker once each.
  const plugins = config.plugins ?? [];
  const has = (name) => plugins.some((p) => (Array.isArray(p) ? p[0] : p) === name);
  const withAudio = [
    ...plugins,
    ...(has('expo-audio') ? [] : ['expo-audio']),
    ...(has('expo-image-picker')
      ? []
      : [['expo-image-picker', { photosPermission: 'WONDERLAND lets you choose a profile picture from your photos.' }]]),
  ];

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
    plugins: withAudio,
    extra: { ...config.extra, appVariant: key },
  };
};