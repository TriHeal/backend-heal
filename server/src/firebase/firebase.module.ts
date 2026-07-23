import { Global, Logger, Module } from '@nestjs/common';
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
import {
  FIREBASE_APP,
  FIRESTORE,
  REALTIME_DB,
  FIREBASE_AUTH,
} from './firebase.constants';
import {
  assertFirebaseRuntimeConfig,
  logFirebaseStartupDiagnostics,
  resolveFirebaseRuntimeConfig,
} from './firebase-config';

const logger = new Logger('FirebaseModule');

function initializeFirebaseApp(): App {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }

  const config = resolveFirebaseRuntimeConfig();
  assertFirebaseRuntimeConfig(config);

  const app =
    config.serviceAccount != null
      ? initializeApp({
          credential: cert(config.serviceAccount),
          projectId: config.projectId,
          databaseURL: config.databaseURL,
        })
      : initializeApp({
          credential: applicationDefault(),
          projectId: config.projectId,
          databaseURL: config.databaseURL,
        });

  logFirebaseStartupDiagnostics(config);

  const resolvedProjectId = app.options.projectId ?? config.projectId;
  if (resolvedProjectId !== config.projectId) {
    logger.warn(
      `Firebase app projectId mismatch: config=${config.projectId}, app=${resolvedProjectId}`,
    );
  }

  return app;
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
  exports: [FIREBASE_APP, FIRESTORE, REALTIME_DB, FIREBASE_AUTH],
})
export class FirebaseModule {}
