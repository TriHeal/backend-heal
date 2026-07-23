import {
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import type { App } from 'firebase-admin/app';
import type { Firestore } from 'firebase-admin/firestore';
import { FIREBASE_APP, FIRESTORE } from '../firebase/firebase.constants';
import {
  resolveFirebaseRuntimeConfig,
  toPublicFirebaseDiagnostics,
} from '../firebase/firebase-config';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: Firestore,
    @Inject(FIREBASE_APP) private readonly firebaseApp: App,
  ) {}

  @Get()
  check() {
    const config = resolveFirebaseRuntimeConfig();
    return {
      ok: true,
      service: 'tri-heal-backend',
      timestamp: new Date().toISOString(),
      firebase: {
        projectId: this.firebaseApp.options.projectId ?? config.projectId,
        credentialMode: config.credentialMode,
        hasWebApiKey: config.hasWebApiKey,
        hasAuthIdHashSecret: config.hasAuthIdHashSecret,
        // Length-only signals help detect env drift without exposing secrets.
        webApiKeyLength: config.webApiKeyLength,
        authIdHashSecretLength: config.authIdHashSecretLength,
        databaseURLConfigured: Boolean(config.databaseURL),
      },
    };
  }

  /**
   * Safe runtime diagnostics for Firebase connectivity.
   * Enabled only when DIAGNOSTICS_TOKEN is configured and provided.
   * Never returns secrets, tokens, or document contents.
   */
  @Get('firebase')
  @ApiExcludeEndpoint()
  async firebaseDiagnostics(
    @Headers('x-diagnostics-token') diagnosticsToken?: string,
  ) {
    const expectedToken = process.env.DIAGNOSTICS_TOKEN;
    if (!expectedToken || diagnosticsToken !== expectedToken) {
      throw new NotFoundException();
    }

    const config = resolveFirebaseRuntimeConfig();
    const publicConfig = toPublicFirebaseDiagnostics(config);

    let firestoreProbe: {
      ok: boolean;
      usersSampleSize?: number;
      errorCode?: string | number;
      errorMessage?: string;
    };

    try {
      const snapshot = await this.firestore.collection('users').limit(1).get();
      firestoreProbe = {
        ok: true,
        usersSampleSize: snapshot.size,
      };
    } catch (error) {
      const err = error as { code?: string | number; message?: string };
      firestoreProbe = {
        ok: false,
        errorCode: err.code,
        errorMessage: err.message,
      };
    }

    return {
      ok: firestoreProbe.ok,
      appProjectId: this.firebaseApp.options.projectId ?? null,
      config: publicConfig,
      firestoreProbe,
      timestamp: new Date().toISOString(),
    };
  }
}
