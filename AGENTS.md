# AGENTS.md — Tri-Heal Backend

Context for anyone (human or AI agent) working on this repo. See the root
`Tri-Heal` project's `CLAUDE.md` for the full product picture (Tri-View
architecture, MVP clinical flow, permissions model). This file is scoped to
**this repo only**: the backend server and Firebase project config.

## What this repo is

A standalone NestJS server (`server/`) plus Firebase project configuration
(`firebase.json`, `firestore.rules`, `database.rules.json`,
`firestore.indexes.json`). It backs three clients that don't live in this
repo:

- **Unity game client** (child) — separate Unity repo, `engine/`.
- **Web dashboard** (therapist + parent) — separate repo, not yet built.
- Both connect to Firebase (Auth/Firestore/RTDB) directly *and* to this
  NestJS server over HTTP. See "Two data paths" below — this is the most
  important architectural fact about the repo.

There used to be a Firebase Cloud Functions codebase (`functions/`) here.
It was replaced entirely by `server/`. Do not resurrect the Cloud
Functions pattern — the server is meant to run standalone (e.g. on Cloud
Run or any Node host), not as a Function.

## Two data paths — read this before adding anything

1. **Through the NestJS server (`server/`)** — for anything that needs
   business logic, validation, or a trusted server-side decision: auth
   (login, credential provisioning), patient CRUD, and any future
   clinical/session logic. The server uses the Firebase **Admin SDK**,
   which bypasses Firestore/RTDB security rules entirely — it is the
   trusted backend.
2. **Direct client → Firebase** — for realtime sync only (e.g. the
   breathing/tap-sync boat mechanic between two devices). Unity and the
   web client use the Firebase client SDK directly against Firestore/RTDB,
   authenticated with a Firebase ID token. This path is *not* trusted by
   default — it's gated by `firestore.rules` / `database.rules.json`.

When adding a feature, decide up front which path it belongs to. Don't put
realtime/high-frequency sync traffic through the NestJS REST API (no
websocket/streaming support today); don't let clients write clinical or
cross-role data directly to Firestore without a rule that specifically
allows it.

## Auth model

Not Firebase's built-in email/password. Custom ID+password, chosen
because the "ID" needs to be therapist/parent/child-friendly (e.g. a short
code), not necessarily an email.

Flow:

1. A therapist calls `POST /auth/credentials` (guarded, therapist-only) to
   provision a login: `{ id, password, role }`. The server creates a
   Firebase Auth user (for the `uid`), bcrypt-hashes the password, and
   stores `{ passwordHash, role, linkedUid, failedAttempts, lockedUntil }`
   in Firestore `credentials/{id}`.
2. The client calls `POST /auth/login` with `{ id, password }`. The server
   verifies the hash, resets/increments lockout counters, and mints a
   Firebase **custom token** via `admin.auth().createCustomToken(linkedUid,
   { role })`.
3. The client exchanges that custom token for a real Firebase **ID token**
   client-side (`signInWithCustomToken`, part of the Firebase client SDK —
   this step happens in Unity/web, not in this repo).
4. The ID token is sent as `Authorization: Bearer <idToken>` on:
   - subsequent NestJS API calls (verified by `FirebaseAuthGuard`, which
     calls `verifyIdToken` and reads the `role` custom claim), and
   - direct Firestore/RTDB client SDK calls (verified by Firebase's rules
     engine, which also reads `request.auth.token.role`).

This means **the `role` custom claim set at login time is the single
source of truth for authorization**, used identically by the server guard
and by the security rules. If you add a new role or change role logic,
update both `server/src/auth/role.enum.ts` and the corresponding checks in
`firestore.rules` / `database.rules.json`.

Lockout: 5 failed attempts locks the account for 15 minutes
(`server/src/auth/auth.service.ts`). `POST /auth/login` is also
rate-limited via `@nestjs/throttler` (5 req/min).

## Project layout (`server/src/`)

```
main.ts                  bootstrap: dotenv, CORS, ValidationPipe, exception filter
app.module.ts             root module: wires Firebase/Auth/Patients + global throttler guard
firebase/
  firebase.module.ts       @Global module — one admin app instance, exports Firestore/RTDB/Auth
  firebase.constants.ts     DI tokens: FIRESTORE, REALTIME_DB, FIREBASE_AUTH
auth/
  auth.controller.ts        POST /auth/login, POST /auth/credentials
  auth.service.ts           credential storage, bcrypt, lockout, custom token minting
  firebase-auth.guard.ts    verifies ID tokens, enforces @Roles()
  roles.decorator.ts        @Roles(Role.Therapist, ...) metadata
  current-user.decorator.ts @CurrentUser() param decorator -> { uid, role }
  role.enum.ts              Role.Therapist | Role.Parent | Role.Child
health/
  health.controller.ts      GET /health, unauthenticated
patients/
  patients.controller.ts    POST /patients, therapist-only
  patients.service.ts       Firestore writes to `patients` collection
common/
  http-exception.filter.ts  consistent { error, details } JSON error shape
```

Pattern for new features: one module per resource
(`<feature>/{*.module,*.controller,*.service}.ts` + `dto/`), following
`patients/` as the template. Inject `FIRESTORE`/`REALTIME_DB`/`FIREBASE_AUTH`
via `@Inject(...)` from `firebase/firebase.constants.ts` — never call
`admin.firestore()` etc. directly outside `firebase.module.ts`.

## API docs

`@nestjs/swagger` (pinned to v8.x — the current NestJS 10 major; v9+ of
`@nestjs/swagger` requires NestJS 11) is wired in `main.ts` and serves
interactive docs at `/docs` (raw spec at `/docs-json`) whenever the server
is running. When adding a new endpoint, add `@ApiProperty()`/
`@ApiPropertyOptional()` to its DTO fields and `@ApiTags()`/`@ApiOperation()`/
`@ApiBearerAuth('firebase-id-token')` (if guarded) to the controller —
follow `patients/` as the reference.

## Firebase project

Project ID: `tri-heal-dev-d9484`. Firestore, Realtime Database, and Auth
are provisioned there. `server/` connects with either Application Default
Credentials (`gcloud auth application-default login`, for local dev) or a
service account JSON via `FIREBASE_SERVICE_ACCOUNT` (for deployed
environments) — **no Firebase Emulator required**, the server talks to the
real project by default.

Registered client apps (for Unity/web direct SDK access — not used by the
server):

| Platform | App ID | Bundle/Package ID |
|---|---|---|
| Web | `1:935486565850:web:c255c143b23d26603164e3` | — |
| Android | `1:935486565850:android:eb76337c902219b63164e3` | `com.devspirit.triheal` |
| iOS | `1:935486565850:ios:58726f356d1c0a993164e3` | `com.devspirit.triheal` |

Fetch/refresh a client config: `firebase apps:sdkconfig <WEB|ANDROID|IOS>
<app-id> --project tri-heal-dev-d9484`. Android/iOS configs live at
`engine/Assets/google-services.json` and
`engine/Assets/GoogleService-Info.plist` in the Unity repo and are
committed there (not secrets, needed at build time).

A Firebase MCP server (`firebase-tools experimental:mcp`) is configured for
this project — prefer its tools over raw `firebase` CLI calls when
inspecting/managing Firestore, RTDB, Auth users, or security rules from an
agent session.

## Data model (current)

- `credentials/{id}` (Firestore) — login credentials. **Never** exposed to
  clients directly; `firestore.rules` denies all client read/write on this
  collection. Only the Admin SDK touches it.
- `patients/{patientId}` (Firestore) — one doc per child. Fields:
  `therapistId` (owner's Firebase uid, set server-side from the auth
  token — never trust a client-supplied value here), `displayName`, `age`,
  `avatarUrl`, `status`, `enrolledAt`, `createdAt`, `updatedAt`, `parents`
  (array of parent uids), `childUid` (nullable, set once the child's own
  login is linked). Security rules grant read access to the owning
  therapist, any uid in `parents`, and the uid matching `childUid`.
- `sessions/{sessionId}` (Realtime Database) — scaffold only, not yet
  written by any code. Intended for realtime sync state (turn-taking,
  breathing/tap sync). Rules require the caller's uid to be present under
  `participants` to read/write.

## Running locally

```bash
cd server
npm install
cp .env.example .env   # fill in FIREBASE_DATABASE_URL at minimum
npm run start:dev
```

See `README.md` for the quick curl-based walkthrough (health check, login,
patient creation). Default port is 3000 (change via `PORT` if occupied —
common on dev machines).

## Conventions / gotchas for future changes

- **firebase-admin v14** uses modular submodule imports
  (`firebase-admin/app`, `firebase-admin/firestore`, `firebase-admin/auth`,
  `firebase-admin/database`) — not the old `admin.app.App` / `admin.credential`
  namespaced API. Follow `firebase.module.ts` as the reference.
- DTOs use `class-validator` decorators; `main.ts` has a global
  `ValidationPipe({ whitelist: true, transform: true })`, so unlisted
  fields are stripped automatically — don't hand-write field filtering.
- Any field that implies ownership/authorization (like `therapistId`) must
  be derived from `@CurrentUser()` server-side, never taken from the
  request body — see `patients.controller.ts` for the pattern.
- When you add a Firestore/RTDB collection that clients will read/write
  directly, you must add rules for it in `firestore.rules` /
  `database.rules.json` — the Admin SDK-only default is deny-by-default,
  so nothing is accidentally exposed, but nothing works either until rules
  are added.
- Deploying rules is a real, live action (`firebase deploy --only
  firestore:rules` / `--only database`) — confirm with the user before
  running it, it's not local-only.
