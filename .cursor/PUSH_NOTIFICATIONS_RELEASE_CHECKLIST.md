# Push notifications — release checklist (matchmaker-mobile)

Use this when shipping builds where users must get FCM/APNs tokens saved in `push_tokens` and receive remote pushes.

## How it works (short)

| Piece | Role |
|--------|------|
| **`google-services.json`** (Android) | Bundled **in the app** at build time. Lets the device obtain an FCM token. **Not** read by your Flask API. |
| **`FIREBASE_CREDENTIALS_*` on the server** | Lets the **backend send** FCM messages. Does **not** create `push_tokens` rows; the **app** creates them via `POST /notifications/register_token`. |
| **`EXPO_PUBLIC_API_BASE_URL`** | Must point at the API users should hit (dev vs production Railway). |

If a new user has **no row in `push_tokens`**, the problem is almost always **client-side** (no FCM token, or `register_token` never succeeded), not “backend can’t read `google-services.json`.”

---

## 1. Android client (EAS / Play build)

- [ ] **`google-services.json`** exists at project root and matches Firebase app with package **`com.matchmate.matchmatedating`** (see [app.json](app.json) `android.package`).
- [ ] **`expo.android.googleServicesFile`** is **`./google-services.json`** (not `.google-services.json`).
- [ ] **`expo.plugins`** includes **`expo-notifications`** (already in [app.json](app.json)).
- [ ] After changing the above, run a **fresh native build** (`eas build` or `expo prebuild` + build). OTA updates alone do not inject `google-services.json` into an old binary.
- [ ] Bump **`expo.version`** in [app.json](app.json) when you need every opted-in user to re-sync tokens (see `NotificationContext` migration logic).

---

## 2. API URL baked into the app

[env.js](src/env.js) uses **`process.env.EXPO_PUBLIC_API_BASE_URL`**, with a default production URL.

[eas.json](eas.json) sets **`EXPO_PUBLIC_API_BASE_URL`** per profile:

| Profile | API (from repo) |
|---------|------------------|
| `development` | `https://set-up-app-dev.up.railway.app` |
| `preview` / `demo` | dev or demo as configured |
| `production` | `https://set-up-app-production.up.railway.app` |

- [ ] The profile you ship matches the **backend** where you expect `push_tokens` (dev vs prod).
- [ ] For local dev, use a root **`.env`** with `EXPO_PUBLIC_API_BASE_URL=...` and restart Metro.

If the app still points at the wrong host, `register_token` hits the wrong server or fails CORS/auth.

---

## 3. Backend (Railway / remote)

Token **storage** only needs a working **`POST /notifications/register_token`** (JWT + JSON body).

- [ ] **Sending** Android pushes from the server requires **`FIREBASE_CREDENTIALS_JSON`** or **`FIREBASE_CREDENTIALS_PATH`** (Firebase **service account** JSON — not `google-services.json`). See [backend/env.template](../backend/env.template).
- [ ] **iOS** sending needs **`APNS_*`** vars if you use native iOS tokens.
- [ ] CORS allows your app origin if applicable; authenticated routes need a valid JWT.

---

## 4. App behavior ([NotificationContext.js](src/context/NotificationContext.js))

- [ ] User is **logged in** (JWT in AsyncStorage) when enabling notifications.
- [ ] OS notification permission **granted**.
- [ ] No persistent **`registerPushToken failed`** / **`complete the guide`** (Android FCM) in logs — fix native Firebase config first.

---

## 5. Verify end-to-end

1. Log in as a test user on a **release** build (not Expo Go if you rely on native FCM).
2. Enable notifications; confirm **`push_tokens`** has a row for that `user_id` (`platform` `android` / `ios` / `expo`).
3. **`POST /notifications/test_push`** with that user’s Bearer token (non-prod or `ALLOW_TEST_PUSH=true` in prod).
4. Backend logs: no **`FCM not configured`** / **`firebase-admin not installed`** when sending.

---

## Quick “no token row” triage

| Symptom | Likely cause |
|---------|----------------|
| Works locally, not on EAS APK | Missing or stale **`google-services.json`** in **built** app; rebuild. |
| Wrong API DB | **`EXPO_PUBLIC_API_BASE_URL`** / EAS **`env`** profile doesn’t match the server you’re checking. |
| `401` on register | Expired/missing JWT; user not logged in. |
| Android log: “complete the guide” | Native project missing Google Services / FCM setup; see [Expo FCM credentials](https://docs.expo.dev/push-notifications/fcm-credentials/). |
