import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { FIREBASE_AUTH, FIRESTORE } from '../firebase/firebase.constants';
import { Role } from './role.enum';

export interface AuthenticatedUser {
  uid: string;
  role: Role;
}

export interface LoginResponse {
  customToken: string;
  role: Role;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(FIREBASE_AUTH) private readonly firebaseAuth: Auth,
    @Inject(FIRESTORE) private readonly firestore: Firestore,
  ) {}

  async loginWithIsraeliId(
    israeliId: string,
    password: string,
  ): Promise<LoginResponse> {
    const normalizedId = this.normalizeIsraeliId(israeliId);
    const authEmail = this.buildInternalAuthEmail(normalizedId);

    const firebaseUser = await this.signInWithFirebasePassword(
      authEmail,
      password,
    );

    const uid = firebaseUser.localId;

    let userSnapshot;
    try {
      userSnapshot = await this.firestore.collection('users').doc(uid).get();
    } catch (error) {
      const err = error as { code?: string | number; message?: string };
      this.logger.error(
        `Firestore users lookup failed for uid=${uid} code=${err.code ?? 'unknown'} message=${err.message ?? 'unknown'}`,
      );
      throw error;
    }

    if (!userSnapshot.exists) {
      this.logger.warn(
        `Login Auth succeeded but Firestore users/${uid} was not found`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const userData = userSnapshot.data();

    if (!userData?.role) {
      throw new UnauthorizedException('User role not configured');
    }

    const role = userData.role as Role;
    try {
      const customToken = await this.firebaseAuth.createCustomToken(uid, {
        role,
      });
      return { customToken, role };
    } catch (error) {
      const err = error as { code?: string | number; message?: string };
      this.logger.error(
        `createCustomToken failed for uid=${uid} code=${err.code ?? 'unknown'} message=${err.message ?? 'unknown'}`,
      );
      throw error;
    }
  }

  async verifyTokenAndLoadUser(idToken: string): Promise<AuthenticatedUser> {
    let decodedToken;

    try {
      decodedToken = await this.firebaseAuth.verifyIdToken(idToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const uid = decodedToken.uid;

    const userSnapshot = await this.firestore
      .collection('users')
      .doc(uid)
      .get();

    if (!userSnapshot.exists) {
      throw new UnauthorizedException('User profile not found');
    }

    const userData = userSnapshot.data();

    if (!userData?.role) {
      throw new UnauthorizedException('User role not configured');
    }

    return {
      uid,
      role: userData.role as Role,
    };
  }

  private buildInternalAuthEmail(israeliId: string): string {
    const secret = process.env.AUTH_ID_HASH_SECRET;

    if (!secret) {
      throw new Error('AUTH_ID_HASH_SECRET is not configured');
    }

    const hash = crypto
      .createHmac('sha256', secret)
      .update(israeliId)
      .digest('hex')
      .slice(0, 32);

    return `${hash}@auth.triheal.local`;
  }

  private normalizeIsraeliId(israeliId: string): string {
    const digitsOnly = israeliId.replace(/\D/g, '');

    if (digitsOnly.length < 5 || digitsOnly.length > 9) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return digitsOnly.padStart(9, '0');
  }

  private async signInWithFirebasePassword(
    email: string,
    password: string,
  ): Promise<{ localId: string }> {
    const apiKey = process.env.FIREBASE_WEB_API_KEY;

    if (!apiKey) {
      throw new Error('FIREBASE_WEB_API_KEY is not configured');
    }

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      },
    );

    if (!response.ok) {
      this.logger.warn(
        `Firebase password sign-in failed (HTTP ${response.status}). Check AUTH_ID_HASH_SECRET and FIREBASE_WEB_API_KEY match the Firebase Auth project.`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    return response.json();
  }
}
