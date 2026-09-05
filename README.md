# MyGuardian

Two-app fraud-protection system for elderly users (PLAN.md drives architecture).
Repositories are split per project (PLAN.md section 6):

| Folder | Project | Tech | State |
| --- | --- | --- | --- |
| `backend/` | Shared API (elders + guardians) | Node/TS, Express, Prisma, PostgreSQL | Phase 1 detection backend done (auth, family linking, URL reputation, flagged events, FCM alert push) |
| `guardian-app/` | Guardian mobile app | React Native + Expo + TypeScript | Phase 0 shell: auth + pairing flow + alerts feed with push registration |
| `elder-app/` | Elder Android app | Kotlin (planned) | Reserved — not started |

Run instructions live in each project's `README.md`. The API contract for mobile
clients is `backend/docs/openapi.yaml`.