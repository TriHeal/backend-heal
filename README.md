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

## Prerequisites

Before running the project locally, install:

- Node.js + npm
- Firebase CLI
- Java JDK 21 or above

### 1. Install Node.js

On macOS with Homebrew:

```bash
brew install node
```

Verify:

```bash
node -v
npm -v
```

### 2. Install Firebase CLI

```bash
npm install -g firebase-tools
```

Verify:

```bash
firebase --version
```

### 3. Login to Firebase

```bash
firebase login
```

### 4. Install Java JDK 21

Firebase emulators require Java 21+.

```bash
brew install openjdk@21
```

Link Java:

```bash
sudo ln -sfn /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-21.jdk
```

Add Java to PATH:

```bash
echo 'export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Verify:

```bash
java -version
```

Expected version should be `21` or above.

### 5. Clone the repository

```bash
git clone <repo-url>
cd backend-heal
```

### 6. Install project dependencies

```bash
cd functions
npm install
cd ..
```
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