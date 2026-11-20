// Reads app.json, then swaps in the google-services.json that EAS provides at build time.
// On EAS Build the file is not in the upload (it is gitignored), so the file variable
// GOOGLE_SERVICES_JSON holds its path. On your own computer it falls back to ./google-services.json.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile ?? './google-services.json',
  },
});