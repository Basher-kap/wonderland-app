# Environments: keep test data away from real users

| Variant     | App name           | Android package                  | Firebase project         |
|-------------|--------------------|----------------------------------|--------------------------|
| production  | Wonderland         | com.wonderlandgame.app           | wonderland-b6794 (live)  |
| preview     | Wonderland Preview | com.wonderlandgame.app.preview   | wonderland-test (new)    |
| development | Wonderland Dev     | com.wonderlandgame.app.dev       | wonderland-test (new)    |

Preview and development share the TEST project, so nothing you try there touches the live leaderboard,
tickets or chat. Production is unchanged, so existing installs keep working and updating.

## One-time setup (Firebase console, about 15 minutes)
1. Create a new Firebase project (e.g. `wonderland-test`, Spark plan).
2. Authentication -> Google -> enable. Copy its Web client ID.
3. Firestore -> create in production mode, region `asia-southeast1`; Rules tab -> paste `backend/firestore.rules` -> Publish.
4. Add a Web app (copy the 6 config values) and TWO Android apps: `com.wonderlandgame.app.preview` and
   `com.wonderlandgame.app.dev`. Download each `google-services.json`.
5. After the first build of each variant, add its SHA-1 (`eas credentials -p android`) to that Android app
   in Firebase, or Google sign-in fails. Re-download google-services.json afterwards.

## EAS environment variables (they are NOT in git)
For each of `preview` and `development`, with the TEST project's values:
```
eas env:create --environment preview --name EXPO_PUBLIC_FIREBASE_API_KEY --value <...>
# repeat: EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, _PROJECT_ID, _STORAGE_BUCKET, _MESSAGING_SENDER_ID,
#         _APP_ID, EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
eas env:create --environment preview --name GOOGLE_SERVICES_JSON --type file --value ./google-services.preview.json
```
Same again with `--environment development` and `./google-services.development.json`. For `production`, use the
current live values and the current google-services.json. Never set EXPO_PUBLIC_TEST_GAME in preview or production.

## Building
```
eas build -p android --profile preview       # "Wonderland Preview"
eas build -p android --profile development   # "Wonderland Dev" (dev client)
eas build -p android --profile production    # live app (AAB)
```

## Running locally
`npx expo start --dev-client` reads `.env.development` over `.env`. Put the TEST project's keys in
`.env.development` and keep `.env` for production only. Start the dev server with `APP_VARIANT=development`
so the app config matches the "Wonderland Dev" build (otherwise it reports the production package).
