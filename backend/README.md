# MyGuardian — Backend

Shared API for the MyGuardian two-app system (elder Android app + guardian app).
Current state: **Phase 0 foundation + Phase 1 detection backend** — hardened
Express/Prisma service with dev auth, family linking, URL reputation scanning,
and a flagged-event/alerts pipeline. No mobile app code in this repo.

## Stack

- Node.js + TypeScript
- Express (helmet, CORS, rate limiting, pino HTTP logging, request IDs)
- PostgreSQL via Prisma ORM
- Zod for request validation
- JSON Web Tokens (jsonwebtoken)
- pino structured logging

## API

OpenAPI 3 contract for the mobile clients lives at `docs/openapi.yaml`.
Business endpoints are versioned under `/api/v1`; ops endpoints are unversioned.

| Method | Path                          | Auth   | Who      | Description                                               |
| ------ | ----------------------------- | ------ | -------- | --------------------------------------------------------- |
| GET    | `/health`                     | none   | —        | Liveness → `{ "status": "ok" }`                           |
| GET    | `/health/ready`               | none   | —        | Readiness (DB ping) → 200 / 503                           |
| POST   | `/api/v1/auth/dev-login`      | none   | —        | **Dev-only** login → access token (see auth note)         |
| POST   | `/api/v1/family-links/invite` | bearer | guardian | Generates a short 6-character invite code               |
| POST   | `/api/v1/family-links/accept` | bearer | elder    | Pairs with the invited guardian (creates the family link) |
| GET    | `/api/v1/family-links`        | bearer | either   | Lists the caller's family links                           |
| POST   | `/api/v1/detection/scan-url`  | bearer | either   | URL reputation verdict (cached)                           |
| POST   | `/api/v1/events`              | bearer | elder    | Flags an event; alerts linked guardians                   |
| GET    | `/api/v1/events`              | bearer | either   | Elder → own events; guardian → linked elders' events      |
| PATCH  | `/api/v1/events/{id}/action`  | bearer | elder    | Records `dismissed` / `blocked` / `no_action`             |
| POST   | `/api/v1/push/tokens`         | bearer | either   | Upserts this device's push token (FCM/APNs)               |
| GET    | `/api/v1/push/tokens`         | bearer | either   | Lists the caller's registered tokens                      |
| DELETE | `/api/v1/push/tokens/{token}` | bearer | either   | Removes a token                                           |

**Auth note.** `POST /api/v1/auth/dev-login` is a local stand-in so the apps can
be built before Firebase/Auth0 is wired in. It takes `{ role, phone_number_hash }`
and returns a signed JWT for a (created or existing) `users` row. It is
**disabled when `NODE_ENV=production`** (`code: AUTH_DEV_DISABLED`). The
production path verifies an OAuth provider ID token and maps it onto `users`;
the seam for that is `src/services/auth.service.ts`.

**Invite codes** are short 6-character codes stored server-side with a TTL
(default 15 min, see `INVITE_CODE_TTL_MINUTES`) — deliberately human-friendly
so a guardian can read them aloud or send them by message. Accepted codes are
case- and whitespace-insensitive, and accepting is idempotent: reusing a code
always returns the same link.

**Reputation.** `scan-url` hashes the URL, checks `reputation_cache` (default
TTL 1h), and on miss queries Google Safe Browsing. With no
`SAFE_BROWSING_API_KEY` configured it returns a degraded `null` score with
`source: no_vendor_configured` (never fails closed). Number reputation is a
Phase-2 integration (e.g. Twilio Lookup).

**Guardian alerts + push.** `POST /api/v1/events` flags an event and notifies
every active-linked guardian via FCM (firebase-admin-style delivery on top of
Google's OAuth2-issued access token — see `src/providers/fcm.ts`). Push is
best-effort: with no `FCM_SERVICE_ACCOUNT_JSON`, no registered `device_tokens`,
or a failed send it logs and skips, but the alert is always recorded in the
guardians feed (`guardian_notified_at` is set on the `flagged_event`). The
guardian app registers its native device token via `/api/v1/push/tokens`.

**Privacy (PLAN.md §3).** Only hashes, risk scores, and short reason tags
(e.g. `urgency_language`, `payment_request`) are stored or transmitted — never
raw numbers, message text, audio, or call transcripts.

## Data model

| Table              | Columns                                                                                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`            | `id`, `role` (`elder`\|`guardian`), `phone_number_hash`, `created_at`                                                                                                                                                |
| `family_links`     | `id`, `elder_user_id` (FK → users), `guardian_user_id` (FK → users), `status` (`pending`\|`active`), `created_at`                                                                                                    |
| `flagged_events`   | `id`, `elder_user_id` (FK → users), `event_type` (`call`\|`sms`\|`email`), `sender_hash`, `risk_score`, `risk_reasons[]`, `created_at`, `guardian_notified_at`, `elder_action` (`dismissed`\|`blocked`\|`no_action`) |
| `device_tokens`    | `id`, `user_id` (FK → users), `token` (unique), `platform` (`android`\|`ios`\|`web`), `created_at`                                                                                                                        |
| `reputation_cache` | `id`, `identifier_hash` (unique), `identifier_type` (`number`\|`url`), `score`, `source`, `cached_at`, `ttl`                                                                                                         |

All foreign keys are `ON DELETE CASCADE`. Prisma client names are
`User` / `FamilyLink` / `FlaggedEvent` / `DeviceToken` / `ReputationCache`,
mapped to the snake_case table names above.

## Prerequisites

- Node.js 18+
- PostgreSQL running locally (or Docker — see below)

## Run locally

```bash
# 1. Install dependencies (postinstall runs `prisma generate`)
npm install

# 2. Configure environment
copy .env.example .env    # then edit DATABASE_URL / PORT / JWT_SECRET
# (a .env already exists with sane dev defaults)

# 3. Create the database and apply migrations
npx prisma migrate dev

# 4. Start the server (tsx watch — restarts on changes)
npm run dev

# 5. Verify
curl http://localhost:4000/health          # -> { "status": "ok" }
curl http://localhost:4000/health/ready    # -> { "status": "ok" }
```

Quick end-to-end pairing + detection check:

```bash
GUARDIAN=$(curl -s -X POST localhost:4000/api/v1/auth/dev-login -H "Content-Type: application/json" \
  -d '{"role":"guardian","phone_number_hash":"dev-guardian-<unique>"}')
ELDER=$(curl -s -X POST localhost:4000/api/v1/auth/dev-login -H "Content-Type: application/json" \
  -d '{"role":"elder","phone_number_hash":"dev-elder-<unique>"}')
GT=$(node -e "console.log(JSON.parse(process.argv[1]).token)" "$GUARDIAN")
ET=$(node -e "console.log(JSON.parse(process.argv[1]).token)" "$ELDER")
CODE=$(curl -s -X POST localhost:4000/api/v1/family-links/invite -H "Authorization: Bearer $GT" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).invite_code))")
curl -s -X POST localhost:4000/api/v1/family-links/accept -H "Authorization: Bearer $ET" -H "Content-Type: application/json" -d "{\"invite_code\":\"$CODE\"}"
curl -s -X POST localhost:4000/api/v1/events -H "Authorization: Bearer $ET" -H "Content-Type: application/json" \
  -d '{"event_type":"sms","sender_hash":"abc123","risk_score":90,"risk_reasons":["payment_request"]}'
```

## Run with Docker (production-like)

```bash
docker compose up --build
# api on :4000, postgres on :5432 (migrations auto-applied on start)
```

## Tests

```bash
# /health tests (no database needed)
npm run test:health

# All other suites REQUIRE a migrated PostgreSQL — see "Run locally" steps 2-3.
npm run test:ready       # readiness check
npm run test:prisma      # data-model validation
npm run test:auth        # dev-login + 401 handling
npm run test:familylink  # invite/accept flow
npm run test:detection   # URL scan + event pipeline
npm run test:push        # push token registration + flag-to-push seam

# Everything
npm test
```

## Scripts

| Command                   | Purpose                            |
| ------------------------- | ---------------------------------- |
| `npm run dev`             | Run with hot reload (tsx watch)    |
| `npm run build`           | Compile TypeScript to `dist/`      |
| `npm start`               | Run the compiled build             |
| `npm run typecheck`       | Type-check without emitting        |
| `npm run lint`            | ESLint (flat config)               |
| `npm run format`          | Prettier write                     |
| `npm run format:check`    | Prettier check                     |
| `npm test`                | Run all Jest tests                 |
| `npm run prisma:generate` | Regenerate the Prisma client       |
| `npm run prisma:migrate`  | Create/apply dev migrations        |
| `npm run prisma:deploy`   | Apply migrations (non-interactive) |

## Project layout

```
docs/
  openapi.yaml             — API contract for the mobile apps
prisma/
  schema.prisma
  migrations/              — init + detection migrations
src/
  config/     env.ts          — Zod-validated environment config
  controllers/ health, readiness, auth, familyLink, detection
  db/         prisma.ts       — PrismaClient singleton
  lib/        tokens.ts (JWT), hash.ts (SHA-256), logger.ts (pino)
  middleware/ errorHandler.ts, requestContext.ts, validate.ts, auth.ts
  providers/  safeBrowsing.ts — Google Safe Browsing client (degradable)
              fcm.ts          — Firebase Cloud Messaging client (best-effort)
  routes/     index.ts (ops), auth.ts, familyLinks.ts, detection.ts, push.ts
  schemas/    auth, familyLink, detection, push — Zod request schemas
  services/   health, auth, familyLink, reputation, event, push
  types/      express.d.ts    — Request.id / Request.user augmentation
  app.ts                      — Express app factory (used by server + tests)
  index.ts                    — bootstrap / listener / graceful shutdown
tests/
  health.test.ts              — /health + error shape (no DB)
  ready.test.ts               — /health/ready (needs DB)
  prisma.test.ts              — data-model validation (needs DB)
  auth.test.ts                — dev-login + 401 handling (needs DB)
  familyLink.test.ts          — invite/accept flow (needs DB)
  detection.test.ts           — scan-url + events (needs DB)
  push.test.ts                — push tokens + flag-without-FCM (needs DB)
Dockerfile / docker-compose.yml / eslint.config.mjs / .prettierrc.json
```

## Error response shape

All errors return `{ "error": string, "code": string, "requestId": string }`.
`requestId` is echoed in the `X-Request-Id` response header for correlation with
logs. Codes: `UNAUTHORIZED` (401), `INVALID_TOKEN` (401), `FORBIDDEN` (403),
`VALIDATION_ERROR` (400), `INVALID_INVITE_CODE` (400), `NOT_FOUND` (404),
`AUTH_DEV_DISABLED` (403), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500).

## Next steps (per PLAN.md)

- Guardian/elder app shells consuming this API (separate repos per PLAN.md §6)
- Push: obtain Firebase credentials (`FCM_SERVICE_ACCOUNT_JSON`) and verify delivery to a dev build
- Number reputation (Twilio Lookup) for Phase 2 call protection
- Google Safe Browsing live tests once a `SAFE_BROWSING_API_KEY` exists
