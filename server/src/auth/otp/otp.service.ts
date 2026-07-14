import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { randomInt } from 'crypto';
import { FIREBASE_AUTH, FIRESTORE, REALTIME_DB } from '../../firebase/firebase.constants';
import { GenerateOtpDto } from './dto/generate-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { Role } from '../role.enum';
import { TherapySession } from 'src/therapy-sessions/entities/therapy-session.entity';
import { Database } from 'node_modules/firebase-admin/lib/database/database';

const OTP_CODES_COLLECTION = 'otpCodes';
const PATIENTS_COLLECTION = 'patients';
const SESSIONS_COLLECTION = 'sessions';
const OTP_LENGTH = 6;
const OTP_EXPIRY_MS = 15 * 60 * 1000;
const MAX_GENERATE_ATTEMPTS = 5;

interface OtpCodeDoc {
  patientId: string;
  expiresAt: number;
  used: boolean;
  createdAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
}

interface PatientDoc {
  childUid: string | null;
}

type VerifyOtpResponse = {
  token: string;
  role: Role;
  patientId: string;
  sessionId: string;
  activities: TherapySession['activities'];
  realtimePath: string;
};


@Injectable()
export class OtpService {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: Firestore,
    @Inject(FIREBASE_AUTH) private readonly firebaseAuth: Auth,
    @Inject(REALTIME_DB) private readonly realtimeDb: Database,
  ) {}

  async generate(
    dto: GenerateOtpDto,
  ): Promise<{ code: string; expiresAt: number }> {
    const collection = this.firestore.collection(OTP_CODES_COLLECTION);
    const expiresAt = Date.now() + OTP_EXPIRY_MS;

    for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS; attempt++) {
      const code = this.randomCode();
      const docRef = collection.doc(code);
      const existing = await docRef.get();
      if (existing.exists) continue;

      await docRef.set({
        patientId: dto.patientId,
        expiresAt,
        used: false,
        createdAt: FieldValue.serverTimestamp(),
      } satisfies OtpCodeDoc);

      return { code, expiresAt };
    }

    throw new Error('Failed to generate a unique OTP code, please retry');
  }

  async verify(dto: VerifyOtpDto): Promise<(VerifyOtpResponse)> {
    const docRef = this.firestore
      .collection(OTP_CODES_COLLECTION)
      .doc(dto.code);

    const otp = await this.firestore.runTransaction(async (tx) => {
      const snapshot = await tx.get(docRef);

      if (!snapshot.exists) {
        throw new UnauthorizedException('Invalid code');
      }

      const data = snapshot.data() as OtpCodeDoc;

      if (data.used) {
        throw new UnauthorizedException('Code already used');
      }

      if (data.expiresAt < Date.now()) {
        throw new UnauthorizedException('Code expired');
      }

      tx.update(docRef, { used: true });
      return data;
    });

    const patientRef = this.firestore
      .collection(PATIENTS_COLLECTION)
      .doc(otp.patientId);
    const patientSnapshot = await patientRef.get();

    if (!patientSnapshot.exists) {
      throw new UnauthorizedException('Invalid code');
    }

    const patient = patientSnapshot.data() as PatientDoc;
    let childUid = patient.childUid;

    if (!childUid) {
      const firebaseUser = await this.firebaseAuth.createUser({});
      childUid = firebaseUser.uid;
      await patientRef.update({ childUid });
    }

    const activeSessionSnapshot = await this.firestore
      .collection(SESSIONS_COLLECTION)
      .where('patientId', '==', otp.patientId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (activeSessionSnapshot.empty) {
      throw new NotFoundException('No active session found for patient');
    }

    const activeSession = activeSessionSnapshot.docs[0].data() as TherapySession;
    const realtimePath = `liveSessions/${activeSession.id}`;
    const now = new Date().toISOString();

    await this.realtimeDb.ref(`${realtimePath}/participants/child`).set({
      uid: childUid,
      patientId: otp.patientId,
      role: Role.Child,
      joinedAt: now,
    });

    const token = await this.firebaseAuth.createCustomToken(childUid, {
      role: Role.Child,
    });

    return {
      token,
      role: Role.Child,
      patientId: otp.patientId,
      sessionId: activeSession.id,
      activities: activeSession.activities ?? [],
      realtimePath,
    };
  }

  private randomCode(): string {
    const max = 10 ** OTP_LENGTH;
    return randomInt(0, max).toString().padStart(OTP_LENGTH, '0');
  }
}
