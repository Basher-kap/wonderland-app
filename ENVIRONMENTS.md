# Environments: keep test data away from real users

There is no Google Play account yet, so the **preview** build (an APK shared directly) is what real users install.

| EAS profile | App name       | Android package              | Firebase project               | Used for                 |
|-------------|----------------|------------------------------|--------------------------------|--------------------------|
| preview     | Wonderland     | com.wonderlandgame.app       | Wonderland (live, main account)| real users               |
| development | Wonderland Dev | com.wonderlandgame.app.dev   | wonderland-test (other account)| testing new games        |
| production  | Wonderland     | com.wonderlandgame.app       | same as preview                | reserved for Play Store  |

The Dev app installs next to the live app and talks only to the test project, so testing never touches the
real leaderboard, tickets or chat.

## Firebase
- Live project: unchanged. Package `com.wonderlandgame.app` stays registered there.
- Test project `wonderland-test`: register ONE Android app, `com.wonderlandgame.app.dev`, plus the Web app and
  Google sign-in. (A `.preview` app there is not needed; delete it if you created one.)
- Add the SHA-1 of each build's keystore to the matching Android app (`eas credentials -p android`).

## EAS environment variables (not in git)
`preview` environment = LIVE values, `development` environment = TEST values:
EXPO_PUBLIC_FIREBASE_API_KEY, _AUTH_DOMAIN, _PROJECT_ID, _STORAGE_BUCKET, _MESSAGING_SENDER_ID, _APP_ID,
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, and the file variable GOOGLE_SERVICES_JSON.
```
eas env:create --environment preview --name EXPO_PUBLIC_FIREBASE_API_KEY --value <live value> --visibility sensitive
eas env:create --environment preview --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json
eas env:create --environment development --name GOOGLE_SERVICES_JSON --type file --value ./google-services.development.json
```
Never set EXPO_PUBLIC_TEST_GAME in preview or production.

## Building
```
eas build -p android --profile preview       # live app, "Wonderland"
eas build -p android --profile development   # test app, "Wonderland Dev" (dev client)
```

## Running locally
Put the TEST keys in `.env.development` (and keep `.env` for live only), then
`APP_VARIANT=development npx expo start --dev-client` (PowerShell: `$env:APP_VARIANT="development"; npx expo start --dev-client`).
