# Voice chat + daily cleanup: setup

## 1. Voice chat (the mic)

Install the WebRTC library and rebuild the app. It has native code, so it does NOT run in Expo Go;
use a development build (`expo-dev-client` is already installed):

```bash
npx expo install react-native-webrtc @config-plugins/react-native-webrtc
eas build --profile development --platform android   # or ios
```

`app.json` (plugin + microphone permission) and `metro.config.js` are already updated in this update.
Install the packages BEFORE starting the app, because the plugin and the config now refer to them.

Add these rules to `backend/firestore.rules`, inside `match /databases/{database}/documents { ... }`.
They assume a lobby document has `playerIds`; rename `isLobbyMember` if you already have a helper:

```
function isLobbyMember(code) {
  return request.auth != null
    && request.auth.uid in get(/databases/$(database)/documents/lobbies/$(code)).data.playerIds;
}

match /lobbies/{code}/voice/{uid} {
  allow read: if isLobbyMember(code);
  allow create, update, delete: if isLobbyMember(code) && request.auth.uid == uid;
}

match /lobbies/{code}/voiceSignals/{pair} {
  allow read, create, update: if isLobbyMember(code) && request.auth.uid in pair.split('_');
  match /ice/{id} {
    allow read: if isLobbyMember(code) && request.auth.uid in pair.split('_');
    allow create: if isLobbyMember(code) && request.auth.uid in pair.split('_')
                  && request.resource.data.from == request.auth.uid;
  }
}
```

Then `firebase deploy --only firestore:rules`.

## 2. Daily cleanup (backend)

`functions/` is a Firebase Cloud Function that runs every day at 04:00 (Asia/Manila): it empties the
public `chat` and deletes lobbies older than 6 hours with everything inside them (game states, results,
voice signals). Edit the constants at the top of `functions/index.js` to change that.

Scheduled functions need the Blaze (pay-as-you-go) plan; at this size it stays within the free quota.
Make sure `firebase.json` has the functions folder, then deploy:

```json
{ "functions": [{ "source": "functions", "codebase": "default" }] }
```

```bash
cd functions && npm install && cd ..
firebase deploy --only functions
```
