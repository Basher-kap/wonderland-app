// Adds the Google sign-in settings to app.json so you do not have to edit it by hand.
// Run it from your app folder (the one that contains app.json):
//
//   node scripts/setup-google-signin.cjs
//   node scripts/setup-google-signin.cjs com.yourname.wonderland     (to choose another package name)
//
// It keeps a copy of your original as app.json.bak and is safe to run twice.

const fs = require('node:fs');
const path = require('node:path');

const file = path.resolve(process.cwd(), 'app.json');
if (!fs.existsSync(file)) {
  console.error('app.json not found. Run this from your app folder (the one that contains app.json).');
  process.exit(1);
}

const packageName = process.argv[2] || 'com.wonderlandgame.app';
if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName)) {
  console.error('Package name must look like com.yourname.wonderland (lowercase letters, numbers, dots).');
  process.exit(1);
}

const original = fs.readFileSync(file, 'utf8');
let json;
try {
  json = JSON.parse(original);
} catch (e) {
  console.error('app.json is not valid JSON: ' + e.message);
  process.exit(1);
}

const expo = json.expo || (json.expo = {});
expo.android = expo.android || {};
const keptPackage = Boolean(expo.android.package);
if (!keptPackage) expo.android.package = packageName;
expo.android.googleServicesFile = './google-services.json';

const plugins = Array.isArray(expo.plugins) ? expo.plugins : [];
const pluginName = '@react-native-google-signin/google-signin';
if (!plugins.some((p) => (Array.isArray(p) ? p[0] : p) === pluginName)) plugins.push(pluginName);
expo.plugins = plugins;

fs.writeFileSync(file + '.bak', original);
fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');

console.log('app.json updated (original saved as app.json.bak).');
console.log('  android package : ' + expo.android.package + (keptPackage ? '  (kept the one you already had)' : ''));
console.log('  google-services : ./google-services.json');
console.log('  plugin          : ' + pluginName);
if (!fs.existsSync(path.resolve(process.cwd(), 'google-services.json'))) {
  console.log('\nNote: google-services.json is not in this folder yet. Download it from Firebase (guide, step 2) and put it here.');
}
console.log('\nUse "' + expo.android.package + '" as the Android package name when you add the Android app in Firebase.');
