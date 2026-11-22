// Release builds (preview/production) shrink the code with R8. react-native-webrtc references WebRTC
// classes that are not in the final app (e.g. org.webrtc.Dav1dDecoder$Natives), and R8 stops with
// "Missing class". These rules keep the WebRTC classes and silence the missing-class warnings.
const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod } = require('expo/config-plugins');

const MARKER = '# --- wonderland: webrtc ---';
const RULES = `${MARKER}
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**
`;

module.exports = function withWebrtcProguard(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (!current.includes(MARKER)) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, current + (current.endsWith('\n') || current === '' ? '' : '\n') + '\n' + RULES);
      }
      return cfg;
    },
  ]);
};
