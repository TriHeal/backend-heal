import 'dotenv/config';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as bcrypt from 'bcrypt';

const BCRYPT_SALT_ROUNDS = 12;

function initFirebase() {
  if (getApps().length) return getApps()[0];
  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  const projectId = process.env.GCLOUD_PROJECT ?? 'tri-heal-dev-d9484';

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    // Emulator-only app: no real credential needed.
    return initializeApp({ projectId, databaseURL });
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    return initializeApp({ credential: cert(JSON.parse(serviceAccountJson)), databaseURL });
  }
  return initializeApp({ credential: applicationDefault(), databaseURL });
}

async function ensureCredential(id: string, password: string, role: 'therapist' | 'parent') {
  const app = initFirebase();
  const firestore = getFirestore(app);
  const auth = getAuth(app);

  const docRef = firestore.collection('credentials').doc(id);
  const existing = await docRef.get();
  if (existing.exists) {
    console.log(`credential "${id}" already exists, skipping`);
    return;
  }

  const firebaseUser = await auth.createUser({});
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  await docRef.set({
    passwordHash,
    role,
    linkedUid: firebaseUser.uid,
    createdAt: FieldValue.serverTimestamp(),
    failedAttempts: 0,
    lockedUntil: null,
  });

  console.log(`created credential "${id}" (role=${role}, uid=${firebaseUser.uid})`);
}

async function main() {
  await ensureCredential('therapist1', 'Passw0rd!', 'therapist');
  await ensureCredential('parent1', 'Passw0rd!', 'parent');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
