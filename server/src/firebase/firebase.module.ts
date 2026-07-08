import { Global, Module } from '@nestjs/common';
import {
  App,
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';
import { FIRESTORE, REALTIME_DB, FIREBASE_AUTH } from './firebase.constants';

const FIREBASE_APP = 'FIREBASE_APP';

function initializeFirebaseApp(): App {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }

  const databaseURL = process.env.FIREBASE_DATABASE_URL;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    return initializeApp({
      credential: cert(JSON.parse(serviceAccountJson)),
      databaseURL,
    });
  }

  // Falls back to GOOGLE_APPLICATION_CREDENTIALS / Application Default Credentials,
  // which is also what lets the app run against the real Firebase project without
  // requiring the local emulator suite.
  return initializeApp({
    credential: applicationDefault(),
    databaseURL,
  });
}

@Global()
@Module({
  providers: [
    { provide: FIREBASE_APP, useFactory: initializeFirebaseApp },
    {
      provide: FIRESTORE,
      useFactory: (app: App) => getFirestore(app),
      inject: [FIREBASE_APP],
    },
    {
      provide: REALTIME_DB,
      useFactory: (app: App) => getDatabase(app),
      inject: [FIREBASE_APP],
    },
    {
      provide: FIREBASE_AUTH,
      useFactory: (app: App) => getAuth(app),
      inject: [FIREBASE_APP],
    },
  ],
  exports: [FIRESTORE, REALTIME_DB, FIREBASE_AUTH],
})
export class FirebaseModule {}
