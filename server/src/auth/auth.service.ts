import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { FIREBASE_AUTH, FIRESTORE } from '../firebase/firebase.constants';
import { LoginDto } from './dto/login.dto';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { Role } from './role.enum';

const CREDENTIALS_COLLECTION = 'credentials';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const BCRYPT_SALT_ROUNDS = 12;

interface CredentialDoc {
  passwordHash: string;
  role: Role;
  linkedUid: string;
  createdAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  failedAttempts: number;
  lockedUntil: number | null;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: Firestore,
    @Inject(FIREBASE_AUTH) private readonly firebaseAuth: Auth,
  ) {}

  async login(dto: LoginDto): Promise<{ token: string; role: Role }> {
    const docRef = this.firestore
      .collection(CREDENTIALS_COLLECTION)
      .doc(dto.id);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const credential = snapshot.data() as CredentialDoc;

    if (credential.lockedUntil && credential.lockedUntil > Date.now()) {
      throw new UnauthorizedException(
        'Account temporarily locked, try again later',
      );
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      credential.passwordHash,
    );

    if (!passwordMatches) {
      const failedAttempts = (credential.failedAttempts ?? 0) + 1;
      const lockedUntil =
        failedAttempts >= MAX_FAILED_ATTEMPTS
          ? Date.now() + LOCKOUT_DURATION_MS
          : null;

      await docRef.update({ failedAttempts, lockedUntil });
      throw new UnauthorizedException('Invalid credentials');
    }

    await docRef.update({ failedAttempts: 0, lockedUntil: null });

    const token = await this.firebaseAuth.createCustomToken(
      credential.linkedUid,
      {
        role: credential.role,
      },
    );

    return { token, role: credential.role };
  }

  async createCredential(
    dto: CreateCredentialDto,
  ): Promise<{ id: string; uid: string }> {
    const docRef = this.firestore
      .collection(CREDENTIALS_COLLECTION)
      .doc(dto.id);
    const existing = await docRef.get();

    if (existing.exists) {
      throw new BadRequestException(
        `Credential with id "${dto.id}" already exists`,
      );
    }

    const firebaseUser = await this.firebaseAuth.createUser({});

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    await docRef.set({
      passwordHash,
      role: dto.role,
      linkedUid: firebaseUser.uid,
      createdAt: FieldValue.serverTimestamp(),
      failedAttempts: 0,
      lockedUntil: null,
    } satisfies CredentialDoc);

    return { id: dto.id, uid: firebaseUser.uid };
  }
}
