# Web frontend polish plan

Goal: make `frontend-app` feel closer to the Matchmate mobile app, including Safari **Add to Home Screen** / standalone mode.

Stack: Create React App in `frontend-app/`, API via `REACT_APP_API_BASE_URL` (local or Railway).

---

## Phase 1 — Install / home-screen polish ✅ Done

Make Safari “Add to Home Screen” feel native.

- [x] Brand `manifest.json` (name, icons, `theme_color`, `display: standalone`)
- [x] iOS meta in `public/index.html` (`apple-mobile-web-app-capable`, status bar, title, touch icons)
- [x] Viewport `viewport-fit=cover` + safe-area padding on shell header / tab bar
- [x] Matchmate title, description, and icons (from mobile `matchmate_logo_1024.png`)
- [x] `HOST=0.0.0.0` in `.env.local` for LAN phone testing
- [ ] Optional later: service worker for offline shell / stronger installability

**How to verify on phone:** same Wi‑Fi → Safari → `http://<your-mac-ip>:3000` → Share → Add to Home Screen → open from Home screen (fullscreen, Matchmate icon).

---

## Phase 2 — Shell & responsive UX

Build on the mobile chrome already ported (AppShell, bottom tabs, role theming).

- [x] Lock viewport (`100dvh`, no document rubber-band); compact auth cards so signup/login fit statically on phone; spacious desktop cards
- [x] Phone auth = flat white (native-like); desktop keeps purple backdrop + white card
- [x] Login inputs match mobile gray `#fafafa` fields + email/phone identifier
- [ ] Tighten AppShell for phone vs desktop (full-bleed on mobile; decide desktop max-width vs phone frame)
- [ ] Consistent back navigation on chat / nested screens (browser history + in-app back)
- [x] Port matchmaker gate (dater without linked MM → Settings / referral)
- [ ] Remove or retire leftover `sideBar` so there’s one nav model

**Key paths:** `src/components/layout/AppShell.js`, `bottomTab.js`, `sideBar.js`, `src/App.js`, `src/components/auth/login.css`

---

## Phase 3 — Auth parity ✅ Done

- [x] Forgot-password entry from Login → `/forgot-password` (`POST /auth/forgot-password`)
- [x] Email/phone verification flow after signup (`/verify-email`, `POST /auth/verify-email`)
- [x] Phone signup on web (identifier + SMS consent + password rules)

**Key paths:** `src/components/auth/*`

---

## Phase 4 — Feature depth ✅ Mostly done

Bring over high-impact mobile behavior without full gesture parity.

- [x] **Puzzles:** Spirit Animal / Zodiac / Trivia hub + routes (Settings → Puzzles Hub)
- [x] **Match & chat:** matchmaker gate; in-chat Unmatch; puzzle links include `matchId`
- [x] View-note / lightbox / approve already existed on web
- [x] **Notifications:** settings UI + Web Push client; backend `web` platform — deploy VAPID on Railway (see [WEB_PUSH_PLAN.md](./WEB_PUSH_PLAN.md))

**Key paths:** `src/components/puzzles/*`, `matches/*`, `conversations/*`, `settings/SettingsSections.js`

---

## Phase 5 — Validate on device

- [ ] iPhone Safari → Add to Home Screen → fullscreen, icon/title, safe areas
- [ ] Walk Profile → Matches → Conversations → Settings as matchmaker and as dater
- [ ] Spot-check auth (forgot / signup verify), puzzles, and chat against mobile

---

## Suggested order

**Phase 1 → 2 → 3 → 4 → 5.**  
Phase 1 makes the home-screen web app real; the rest closes product parity with Expo.

---

## How to run the web frontend

```bash
cd frontend-app
npm install
```

`frontend-app/.env.local` example:

```bash
REACT_APP_API_BASE_URL=https://set-up-app-cas-dev.up.railway.app
HOST=0.0.0.0
```

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000), or on a phone on the same network: `http://<mac-lan-ip>:3000`.

Other API targets:

| Env | URL |
|-----|-----|
| Local backend | `http://localhost:5000` |
| Railway cas-dev | `https://set-up-app-cas-dev.up.railway.app` |
| Railway dev | `https://set-up-app-dev.up.railway.app` |
| Railway demo | `https://set-up-app-demo.up.railway.app` |
| Railway production | `https://set-up-app-production.up.railway.app` |

Restart `npm start` after changing `.env.local`.
