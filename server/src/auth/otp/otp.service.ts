import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { FIREBASE_AUTH, FIRESTORE } from '../../firebase/firebase.constants';
import { GenerateOtpDto } from './dto/generate-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { Role } from '../role.enum';

const OTP_CODES_COLLECTION = 'otpCodes';
const PATIENTS_COLLECTION = 'patients';
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

@Injectable()
export class OtpService {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: Firestore,
    @Inject(FIREBASE_AUTH) private readonly firebaseAuth: Auth,
  ) {}

  async generate(dto: GenerateOtpDto): Promise<{ code: string; expiresAt: number }> {
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

  async verify(dto: VerifyOtpDto): Promise<{ token: string; role: Role }> {
    const docRef = this.firestore.collection(OTP_CODES_COLLECTION).doc(dto.code);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      throw new UnauthorizedException('Invalid code');
    }

    const otp = snapshot.data() as OtpCodeDoc;

    if (otp.used) {
      throw new UnauthorizedException('Code already used');
    }

    if (otp.expiresAt < Date.now()) {
      throw new UnauthorizedException('Code expired');
    }

    await docRef.update({ used: true });

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

    const token = await this.firebaseAuth.createCustomToken(childUid, {
      role: Role.Child,
    });

    return { token, role: Role.Child };
  }

  private randomCode(): string {
    const max = 10 ** OTP_LENGTH;
    return Math.floor(Math.random() * max).toString().padStart(OTP_LENGTH, '0');
  }
}
