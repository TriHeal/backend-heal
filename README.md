# Tri-Heal Backend

Standalone NestJS server for the Tri-Heal MVP, backed by Firebase (Firestore,
Realtime Database, Auth) via the Admin SDK.

## Prerequisites

- Node.js 24 + npm
- Firebase CLI: `npm install -g firebase-tools`

## Setup

1. Install dependencies:

   ```bash
   cd server
   npm install
   ```

2. Log in and grant local access to the Firebase project:

   ```bash
   firebase login
   gcloud auth application-default login
   ```

3. Create `server/.env` from the example and fill it in:

   ```bash
   cp .env.example .env
   ```

   ```env
   PORT=3003
   FIREBASE_DATABASE_URL=https://tri-heal-dev-d9484-default-rtdb.europe-west1.firebasedatabase.app
   ```

Works the same on macOS, Linux, and Windows (PowerShell/cmd) — just use your
shell's equivalent of `cp` (e.g. `copy .env.example .env` on Windows).

## Run

```bash
cd server
npm run start:dev
```

## Check it's running

```bash
curl http://localhost:3003/health
```

Expected:

```json
{ "ok": true, "service": "tri-heal-backend", "timestamp": "..." }
```

## API docs (Swagger)

Interactive docs, once the server is running:

```text
http://localhost:3003/docs
```

Raw OpenAPI JSON at `/docs-json`.

## Auth

Custom ID+password login (not Firebase email/password): credentials live in a
Firestore `credentials` collection (bcrypt-hashed). Login returns a Firebase
custom token; exchange it client-side for an ID token
(`signInWithCustomToken`) and send that as `Authorization: Bearer <idToken>`
on subsequent requests.

```bash
# provision a login (therapist-only, needs an existing therapist token)
curl -X POST http://localhost:3003/auth/credentials \
  -H "Authorization: Bearer <therapist idToken>" \
  -H "Content-Type: application/json" \
  -d '{"id":"demo-therapist-1","password":"a-strong-password","role":"therapist"}'

# log in
curl -X POST http://localhost:3003/auth/login \
  -H "Content-Type: application/json" \
  -d '{"id":"demo-therapist-1","password":"a-strong-password"}'
```

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | none | liveness check |
| POST | `/auth/login` | none | rate-limited, 5 failed attempts locks the account 15 min |
| POST | `/auth/credentials` | therapist | provisions a login |
| POST | `/patients` | therapist | `therapistId` is taken from the token, not the body |
| POST | `/parent-invitations/accept` | none (token) | activates a parent and returns a Firebase **custom token** (see below) |
| POST | `/parent/sessions/watch` | parent | binds the parent to a specific child's active session for live viewing |

## Parent access to a child's live session

A parent can watch their child's therapy session in real time. The flow:

1. **Provision (once):** the parent accepts their invitation via
   `POST /parent-invitations/accept` with `{ token }`. The server links a
   Firebase Auth identity to the `parentAccounts` doc (`firebaseUid`), writes
   `users/{uid}` with `role: parent`, and returns a **custom token**. The
   client exchanges it for an ID token (`signInWithCustomToken`). The same
   uid is reused across all of a parent's children (deduped by email), so one
   login covers every child.
2. **Watch (per child):** the authenticated parent calls
   `POST /parent/sessions/watch` with `{ patientId }` (the specific child).
   The server verifies the parent owns that child, resolves the child's
   **active** therapy session, registers the parent under
   `liveSessions/{sessionId}/participants/parents/{uid}`, and returns
   `{ patientId, sessionId, activities, realtimePath }`.
3. **Live view:** the parent's client subscribes directly to `realtimePath`
   (RTDB `liveSessions/{sessionId}`). Read access is granted by the rule in
   `database.rules.json`, which allows a uid present under
   `participants/parents`.

```bash
# activate (returns { token, role, parentId, patientIds, patient })
curl -X POST http://localhost:3003/parent-invitations/accept \
  -H "Content-Type: application/json" \
  -d '{"token":"<invite token>"}'

# watch a specific child's active session
curl -X POST http://localhost:3003/parent/sessions/watch \
  -H "Authorization: Bearer <parent idToken>" \
  -H "Content-Type: application/json" \
  -d '{"patientId":"<child patientId>"}'
```

An end-to-end smoke script that walks this whole flow (therapist login → patient
→ invite → accept → session → parent watch) lives at
[`scripts/smoke-parent-watch.sh`](scripts/smoke-parent-watch.sh) — see its header
comment for the two-stage usage (the invite token comes from the email).

## Firebase project

Project: `tri-heal-dev-d9484`. Registered client apps (Unity + web use these
to talk to Firebase Auth/Firestore/RTDB directly for realtime sync, separate
from the REST API above):

| Platform | App ID |
|---|---|
| Web | `1:935486565850:web:c255c143b23d26603164e3` |
| Android | `1:935486565850:android:eb76337c902219b63164e3` |
| iOS | `1:935486565850:ios:58726f356d1c0a993164e3` |

Fetch a config anytime: `firebase apps:sdkconfig <WEB|ANDROID|IOS> <app-id> --project tri-heal-dev-d9484`

Security rules for that direct-client path live in `firestore.rules` and
`database.rules.json`.
