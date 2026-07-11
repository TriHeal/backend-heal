import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import type { Database } from 'firebase-admin/database';
import { FIRESTORE, REALTIME_DB } from '../firebase/firebase.constants';
import { CreateSessionDto } from './dto/create-session.dto';
import { Patient } from 'src/patients/entities/patient.entity';
import { TherapySession } from './entities/therapy-session.entity';


@Injectable()
export class SessionsService {
  constructor(
    @Inject(FIRESTORE)
    private readonly firestore: Firestore,

    @Inject(REALTIME_DB)
    private readonly realtimeDb: Database,
  ) {}

 async create(
  dto: CreateSessionDto,
  therapistId: string,
): Promise<TherapySession> {
  const patientRef = this.firestore.collection('patients').doc(dto.patientId);
  const patientSnapshot = await patientRef.get();

  if (!patientSnapshot.exists) {
    throw new NotFoundException('Patient not found');
  }

  const patient = patientSnapshot.data() as Patient;

  if (patient.therapistId !== therapistId) {
    throw new NotFoundException('Patient not found');
  }

  const sessionRef = this.firestore.collection('sessions').doc();
  const now = new Date();

  const session: TherapySession = {
    id: sessionRef.id,
    therapistId,
    patientId: dto.patientId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  await sessionRef.set(session);

  await this.realtimeDb.ref(`liveSessions/${session.id}`).set({
    sessionId: session.id,
    therapistId,
    patientId: dto.patientId,
    status: 'active',
    currentActivity: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  return session;
}

  async findAllForTherapist(therapistId: string): Promise<TherapySession[]> {
    const snapshot = await this.firestore
      .collection('sessions')
      .where('therapistId', '==', therapistId)
      .get();

    return snapshot.docs.map((doc) => doc.data() as TherapySession);
  }

  async findOne(sessionId: string, therapistId: string) : Promise<TherapySession> {
    const doc = await this.firestore.collection('sessions').doc(sessionId).get();

    if (!doc.exists) {
      throw new NotFoundException('Session not found');
    }

    const session = doc.data() as TherapySession;

    if (session?.therapistId !== therapistId) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }
}