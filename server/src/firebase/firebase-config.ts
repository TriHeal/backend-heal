import { Logger } from '@nestjs/common';
import type { ServiceAccount } from 'firebase-admin/app';

const logger = new Logger('FirebaseConfig');

export const EXPECTED_FIREBASE_PROJECT_ID = 'tri-heal-dev-d9484';

export type FirebaseCredentialMode =
  'service_account_json' | 'service_account_fields' | 'application_default';

export interface FirebaseRuntimeConfig {
  projectId: string;
  databaseURL: string | undefined;
  credentialMode: FirebaseCredentialMode;
  serviceAccount: ServiceAccount | null;
  hasWebApiKey: boolean;
  hasAuthIdHashSecret: boolean;
  webApiKeyLength: number;
  authIdHashSecretLength: number;
}

function normalizePrivateKey(privateKey: string): string {
  // Render/UI env vars often store literal "\n" sequences instead of newlines.
  return privateKey.includes('\\n')
    ? privateKey.replace(/\\n/g, '\n')
    : privateKey;
}

function parseServiceAccountJson(raw: string): ServiceAccount {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT is not valid JSON (${message}). If this was pasted into Render, ensure it is a single-line JSON string.`,
    );
  }

  // Some hosts accidentally double-encode the JSON blob.
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT appears double-encoded and the inner value is not valid JSON.',
      );
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('FIREBASE_SERVICE_ACCOUNT must be a JSON object.');
  }

  const record = parsed as Record<string, unknown>;
  const projectId = record.project_id;
  const clientEmail = record.client_email;
  const privateKey = record.private_key;

  if (typeof projectId !== 'string' || !projectId) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is missing project_id.');
  }
  if (typeof clientEmail !== 'string' || !clientEmail) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is missing client_email.');
  }
  if (typeof privateKey !== 'string' || !privateKey) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is missing private_key.');
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
  };
}

function loadServiceAccountFromFields(): ServiceAccount | null {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const projectId =
    process.env.FIREBASE_PROJECT_ID ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GCLOUD_PROJECT;

  // Project ID alone is normal for ADC / local GOOGLE_APPLICATION_CREDENTIALS.
  // Only treat this as an explicit field-based credential when email+key exist.
  if (!clientEmail && !privateKey) {
    return null;
  }

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Partial Firebase field credentials detected. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY together.',
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
  };
}

export function resolveFirebaseRuntimeConfig(): FirebaseRuntimeConfig {
  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  const webApiKey = process.env.FIREBASE_WEB_API_KEY ?? '';
  const authIdHashSecret = process.env.AUTH_ID_HASH_SECRET ?? '';

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  let credentialMode: FirebaseCredentialMode = 'application_default';
  let serviceAccount: ServiceAccount | null = null;

  if (serviceAccountJson) {
    serviceAccount = parseServiceAccountJson(serviceAccountJson);
    credentialMode = 'service_account_json';
  } else {
    serviceAccount = loadServiceAccountFromFields();
    if (serviceAccount) {
      credentialMode = 'service_account_fields';
    }
  }

  const projectId =
    serviceAccount?.projectId ??
    process.env.FIREBASE_PROJECT_ID ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GCLOUD_PROJECT ??
    EXPECTED_FIREBASE_PROJECT_ID;

  return {
    projectId,
    databaseURL,
    credentialMode,
    serviceAccount,
    hasWebApiKey: Boolean(webApiKey),
    hasAuthIdHashSecret: Boolean(authIdHashSecret),
    webApiKeyLength: webApiKey.length,
    authIdHashSecretLength: authIdHashSecret.length,
  };
}

export function assertFirebaseRuntimeConfig(
  config: FirebaseRuntimeConfig,
): void {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!config.hasWebApiKey) {
    throw new Error('Missing FIREBASE_WEB_API_KEY');
  }
  if (!config.hasAuthIdHashSecret) {
    throw new Error('Missing AUTH_ID_HASH_SECRET');
  }
  if (!config.databaseURL) {
    throw new Error('Missing FIREBASE_DATABASE_URL');
  }
  if (!/^https:\/\//.test(config.databaseURL)) {
    throw new Error(
      'FIREBASE_DATABASE_URL must be an absolute https URL (e.g. https://<project>-default-rtdb...<domain>)',
    );
  }

  if (isProduction && config.credentialMode === 'application_default') {
    throw new Error(
      'Production requires FIREBASE_SERVICE_ACCOUNT (JSON) or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY. Application Default Credentials are not available on Render.',
    );
  }

  if (config.projectId && config.projectId !== EXPECTED_FIREBASE_PROJECT_ID) {
    logger.warn(
      `Firebase projectId is "${config.projectId}" (expected "${EXPECTED_FIREBASE_PROJECT_ID}")`,
    );
  }
}

export function logFirebaseStartupDiagnostics(
  config: FirebaseRuntimeConfig,
): void {
  logger.log(
    `Firebase initialized: project=${config.projectId}, credentials=${config.credentialMode}, webApiKey=${config.hasWebApiKey}, authHashSecret=${config.hasAuthIdHashSecret}`,
  );
}

export function toPublicFirebaseDiagnostics(config: FirebaseRuntimeConfig) {
  return {
    projectId: config.projectId,
    expectedProjectId: EXPECTED_FIREBASE_PROJECT_ID,
    projectIdMatchesExpected: config.projectId === EXPECTED_FIREBASE_PROJECT_ID,
    credentialMode: config.credentialMode,
    hasServiceAccountJson: Boolean(
      process.env.FIREBASE_SERVICE_ACCOUNT?.trim(),
    ),
    hasServiceAccountFields: Boolean(
      process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY,
    ),
    hasWebApiKey: config.hasWebApiKey,
    hasAuthIdHashSecret: config.hasAuthIdHashSecret,
    webApiKeyLength: config.webApiKeyLength,
    authIdHashSecretLength: config.authIdHashSecretLength,
    databaseURLConfigured: Boolean(config.databaseURL),
    databaseURLIsHttps: Boolean(config.databaseURL?.startsWith('https://')),
  };
}
