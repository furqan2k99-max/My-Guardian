# MyGuardian — Guardian App

React Native + Expo + TypeScript guardian app. **Phase 1**: auth, pairing, and
the alerts dashboard (flagged events feed for linked elders). Push notifications
(FCM) and elder-side flows are still ahead.

Consumes the MyGuardian backend (`../backend`). API contract:
`../backend/docs/openapi.yaml`.

## Structure

```
App.tsx                       — providers (safe area, auth) + navigator
src/
  api/        client.ts (fetch wrapper + env base URL), auth.ts, familyLinks.ts, events.ts, types.ts
  auth/       AuthContext.tsx (session state machine), storage.ts (SecureStore)
  navigation/ RootNavigator.tsx + types.ts
  screens/    LoginScreen, EnterInviteScreen, AlertsDashboardScreen
  components/ Screen, PrimaryButton, TextField, EventCard
  utils/      format.ts (hash truncation, relative time, reason labels)
  theme.ts    colors / spacing / radii
```

## Flow

- **Signed out** → `Login` (dev-login as `guardian` with a phone-number hash)
- **Signed in, unpaired** → `EnterInvite`: generates a **short 6-character
  invite code** (`POST /api/v1/family-links/invite`, server-side 15-min TTL —
  safer and easy to read aloud / relay), a **Copy code** button, and polls link
  status until the elder accepts, then flips to
- **Signed in, paired** → `Alerts` dashboard: flagged events for all linked
  elders (`GET /api/v1/events`, which embeds `elder_user`), newest first.
  Pull-to-refresh + 30s polling.

Tokens are persisted in SecureStore and the session restores on cold start
(token validated via `GET /api/v1/family-links`).

## Run against the local backend

Prereqs: backend running with PostgreSQL up (see `../backend/README.md`):

```bash
cd ../backend
docker start myguardian-pg    # or run your own Postgres
npm run dev                   # backend on http://localhost:4000
```

Then, from this folder:

```bash
npm install
npx expo start
```

Open the app with **Expo Go** (Android or iOS) or press `a` / `i` for an
emulator/simulator.

### Pointing at the backend (`EXPO_PUBLIC_API_URL`)

Edit `.env` (or copy `.env.example`):

| Where the app runs | `EXPO_PUBLIC_API_URL` |
| --- | --- |
| iOS simulator / web | `http://localhost:4000` |
| Android emulator | `http://10.0.2.2:4000` |
| Physical device (Expo Go) | `http://<your-LAN-IP>:4000` |

The device/emulator and the machine running the backend must be able to reach
each other. After changing `.env`, fully reload the app (e.g. `r` in the Expo
CLI) — the value is inlined at bundle time.

> Note: the backend's `POST /api/v1/auth/dev-login` is **disabled when
> `NODE_ENV=production`** (403 `AUTH_DEV_DISABLED`). Run the backend via
> `npm run dev` (development) to use dev-login.

## Pairing flow (how it actually works today)

The backend splits pairing by role:

- **Guardian** (this app): `POST /api/v1/family-links/invite` → gets a short
  6-character invite code (stored server-side, expires after
  `INVITE_CODE_TTL_MINUTES`, default 15 min) to share with the elder.
- **Elder** (`elder-app`): `POST /api/v1/family-links/accept` with that code →
  creates the active family link (elder-only, 403 for guardians). Accepting is
  forgiving of case and stray spaces.

So "enter invite code" in this guardian app is the **generator/display** side
plus polling until the elder accepts. The API client also exposes
`acceptInvite()` (matching the real endpoint shape) for the elder-side flow.

## Backend gaps / assumptions hit this session

- `invite`, `listFamilyLinks` (link status), and `dev-login` all exist in the
  backend with the shapes used here. Invite codes are now short + TTL'd
  (replaces an earlier stateless JWT).
- `acceptInvite` exists backend-side but is elder-only; the guardian app never
  calls it (would get 403) — kept in the client for contract completeness.
- No `GET /me` endpoint exists; session restore relies on
  `GET /family-links` returning the caller's links (its 401/200 tells us
  whether the token is still valid).