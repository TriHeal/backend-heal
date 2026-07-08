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
   PORT=3000
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
curl http://localhost:3000/health
```

Expected:

```json
{ "ok": true, "service": "tri-heal-backend", "timestamp": "..." }
```

## API docs (Swagger)

Interactive docs, once the server is running:

```text
http://localhost:3000/docs
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
curl -X POST http://localhost:3000/auth/credentials \
  -H "Authorization: Bearer <therapist idToken>" \
  -H "Content-Type: application/json" \
  -d '{"id":"demo-therapist-1","password":"a-strong-password","role":"therapist"}'

# log in
curl -X POST http://localhost:3000/auth/login \
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
