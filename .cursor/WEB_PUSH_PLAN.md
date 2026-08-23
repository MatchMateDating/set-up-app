# Web Push plan

Goal: deliver OS/browser notifications from the Matchmate **web** app (including Safari **Add to Home Screen**), using the same preference model as mobile.

Stack today:
- Web: `frontend-app` CRA — Settings prefs + Web Push subscribe (service worker)
- Mobile: Expo registers `push_tokens` (`expo` / `ios` / `android`)
- Backend: `notification_service` + `push_platforms` (Expo / APNs / FCM / **web**)

Reuse existing prefs (`notifications_enabled`, per-type flags, match mutes). Web is an additional delivery channel.

---

## Constraints (read first)

| Constraint | Implication |
|------------|-------------|
| **HTTPS** | Web Push needs secure context. Localhost OK for desktop; phone/LAN testing needs HTTPS or a deployed frontend. |
| **iOS Safari** | Push only for **installed PWAs** (Add to Home Screen), iOS **16.4+**. Not in normal Safari tabs. |
| **Android Chrome** | Works in browser + installed PWA. |
| **Desktop** | Chrome / Edge / Firefox OK when permission granted. |
| **Token shape** | Web stores a **PushSubscription JSON** (endpoint + `p256dh` + `auth`), not an Expo/FCM string. Fit into existing `push_tokens.token` (`Text`) + platform `web`. |

---

## Architecture

```
[Web Settings: Enable]
        ↓ permission + PushManager.subscribe(VAPID public key)
[Service worker]
        ↓ POST /notifications/register_token { platform: "web", push_token: <subscription JSON> }
[push_tokens row]
        ↓ event (match / message / …) + prefs check (unchanged)
[notification_service] → platform web → pywebpush (VAPID)
        ↓
[Browser push service] → SW `push` → showNotification → click → open / deep-link
```

---

## Phase 0 — Keys & env ✅

- [x] Generate VAPID key pair (local `backend/.env` + `frontend-app/.env.local` public key)
- [x] Backend config: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- [x] Frontend: `REACT_APP_VAPID_PUBLIC_KEY` (optional; falls back to API)
- [x] Documented in `backend/env.template` + README
- [ ] **Ops:** set the same three VAPID vars on Railway (cas-dev / prod) and deploy backend with `pywebpush`

---

## Phase 1 — Backend: accept + send `web` ✅

- [x] `POST /notifications/register_token` allows `web`; validates + canonicalizes subscription JSON
- [x] Linked-account dual-register preserved; unregister also clears linked account
- [x] `GET /notifications/vapid_public_key`
- [x] `pywebpush` in `requirements.txt`; `send_web_push` in `push_platforms.py`
- [x] `send_push_to_token_row` + `_push_tokens_for_delivery` keep `web` alongside mobile
- [x] Prune on 410 / expired; test_push diagnostics include VAPID hint

---

## Phase 2 — Frontend: service worker + helpers ✅

- [x] `frontend-app/public/sw.js` (push + notificationclick deep-links)
- [x] Register SW from `src/index.js`
- [x] `src/notifications/webPush.js` (support checks, subscribe/unsubscribe, status)

---

## Phase 3 — Settings UI ✅

- [x] Enable → save prefs + subscribe (prefs still save if subscribe fails)
- [x] Disable → unsubscribe + save prefs off
- [x] Status line for subscribed / denied / unsupported / misconfigured

---

## Phase 4 — iOS / PWA polish ✅

- [x] Standalone / Home Screen gate for iPhone before promising push
- [x] Settings copy when unsupported (Add to Home Screen)

---

## Phase 5 — Test plan

### Desktop (Chrome)

- [ ] HTTPS or localhost → Enable notifications → allow prompt → `push_tokens` row `platform=web`
- [ ] Backend test_push or trigger a message → tray notification
- [ ] Click → correct in-app route
- [ ] Disable → row pruned / unsubscribed

### Android Chrome / iPhone PWA

- [ ] Same flows; iPhone only from Home Screen icon (16.4+)

### Regression

- [ ] Mobile Expo/APNs/FCM unchanged
- [ ] Linked accounts + match mutes still work

---

## Deploy checklist (required for cas-dev / prod)

1. Add to Railway (same values as local `backend/.env`):
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT=mailto:support@matchmatedating.com`
2. Deploy backend so `platform=web` + `pywebpush` are live.
3. Restart `npm start` after `.env.local` VAPID public key change.
4. Settings → Enable notifications → allow browser prompt → verify `push_tokens` row.

---

## Explicit non-goals (v1)

- Full offline caching / Workbox rewrite of CRA
- Email/SMS fallback for web users
- Replacing native push
- Safari non-PWA push (impossible on iOS)
- Rich actions / reply from notification
