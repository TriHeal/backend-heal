# Tri-Heal Backend

Firebase backend setup for the Tri-Heal MVP.

## Current Scope

This repository currently contains the initial Firebase backend infrastructure:

- Firebase Functions
- Firestore
- Realtime Database
- Firebase Authentication
- Local Firebase Emulator Suite

The first implemented backend endpoint is a simple example endpoint for creating a patient document in Firestore.

## Firebase Project

Development Firebase project:

```text
tri-heal-dev-d9484
```

## Running Locally

Install dependencies:

```bash
cd functions
npm install
cd ..
```

Start Firebase emulators:

```bash
firebase emulators:start
```

Open Emulator UI:

```text
http://127.0.0.1:4000
```

## Available Local Endpoints

### Health Check

```text
GET http://127.0.0.1:5001/tri-heal-dev-d9484/us-central1/health
```

Expected response:

```json
{
  "ok": true,
  "service": "tri-heal-backend",
  "timestamp": "..."
}
```

### Create Patient

```text
POST http://127.0.0.1:5001/tri-heal-dev-d9484/us-central1/createPatient
```

Example request:

```bash
curl -X POST http://127.0.0.1:5001/tri-heal-dev-d9484/us-central1/createPatient \
  -H "Content-Type: application/json" \
  -d '{
    "therapistId": "demo-therapist-1",
    "displayName": "Daniel",
    "age": 8
  }'
```

Expected response:

```json
{
  "patientId": "...",
  "message": "Patient created successfully"
}
```

The created record can be viewed in:

```text
Emulator UI → Firestore → patients
```

## Notes

- Local emulator data is not the real Firebase cloud data.
- Emulator data may be deleted after restart unless export/import is configured.
- This is an MVP starting point, not final production architecture.
- Authentication and security rules still need to be completed.