import 'dotenv/config';
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as crypto from 'crypto';

/**
 * Provision a working login for the CURRENT auth model (Israeli T.Z + password),
 * so `POST /auth/login` succeeds and you can drive the API for functional tests.
 *
 * This mirrors AuthService.loginWithIsraeliId exactly: the T.Z is normalized and
 * HMAC'd (with AUTH_ID_HASH_SECRET) into an internal Firebase Auth email, a Firebase
 * user is created/updated with the given password, and users/{uid}.role is set.
 *
 * NOTE: the legacy scripts/bootstrap-users.ts writes to the `credentials` collection,
 * which the current login flow does NOT read — use THIS script instead.
 *
 * Usage (from server/):
 *   npm run seed:user -- <tz> <password> [role]
 *   # e.g. npm run seed:user -- 123456789 Test1234! therapist
 *
 * Requires in server/.env: AUTH_ID_HASH_SECRET (must match the value the server
 * uses), FIREBASE_DATABASE_URL, and Admin credentials (FIREBASE_SERVICE_ACCOUNT
 * or GOOGLE_APPLICATION_CREDENTIALS=./service-account.json).
 */

type Role = 'therapist' | 'parent' | 'child';

function initFirebase() {
  if (getApps().length) return getApps()[0];
  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  const projectId =
    process.env.FIREBASE_PROJECT_ID ??
    process.env.GCLOUD_PROJECT ??
    'tri-heal-dev-d9484';

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId, databaseURL });
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    return initializeApp({
      credential: cert(JSON.parse(serviceAccountJson)),
      projectId,
      databaseURL,
    });
  }
  return initializeApp({
    credential: applicationDefault(),
    projectId,
    databaseURL,
  });
}

// --- mirrors AuthService (normalize first, then HMAC the normalized id) -------
function normalizeIsraeliId(israeliId: string): string {
  const digitsOnly = israeliId.replace(/\D/g, '');
  if (digitsOnly.length < 5 || digitsOnly.length > 9) {
    throw new Error(
      `Invalid T.Z "${israeliId}": expected 5-9 digits, got ${digitsOnly.length}`,
    );
  }
  return digitsOnly.padStart(9, '0');
}

function buildInternalAuthEmail(normalizedId: string, secret: string): string {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(normalizedId)
    .digest('hex')
    .slice(0, 32);
  return `${hash}@auth.triheal.local`;
}

async function main() {
  const [, , tzArg, passwordArg, roleArg] = process.argv;
  const tz = tzArg ?? process.env.SEED_TZ;
  const password = passwordArg ?? process.env.SEED_PASSWORD;
  const role = (roleArg ?? process.env.SEED_ROLE ?? 'therapist') as Role;

  if (!tz || !password) {
    throw new Error(
      'Usage: npm run seed:user -- <tz> <password> [therapist|parent|child]',
    );
  }
  if (!['therapist', 'parent', 'child'].includes(role)) {
    throw new Error(`Invalid role "${role}"`);
  }

  const secret = process.env.AUTH_ID_HASH_SECRET;
  if (!secret) {
    throw new Error('AUTH_ID_HASH_SECRET is not set (must match the server).');
  }

  const app = initFirebase();
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  const normalized = normalizeIsraeliId(tz);
  const email = buildInternalAuthEmail(normalized, secret);

  let uid: string;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    await auth.updateUser(uid, { password });
    console.log(`Reused existing auth user uid=${uid} (password reset)`);
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found')
      throw error;
    const created = await auth.createUser({ email, password });
    uid = created.uid;
    console.log(`Created auth user uid=${uid}`);
  }

  await firestore
    .collection('users')
    .doc(uid)
    .set({ role, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  console.log('');
  console.log('Login credentials for POST /auth/login:');
  console.log(`  israeliId: ${normalized}   (you can also send ${tz})`);
  console.log(`  password:  ${password}`);
  console.log(`  role:      ${role}`);
  console.log(`  uid:       ${uid}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
