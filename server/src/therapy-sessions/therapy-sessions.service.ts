import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import type { Database } from 'firebase-admin/database';
import { FIRESTORE, REALTIME_DB } from '../firebase/firebase.constants';
import { CreateTherapySessionDto } from './dto/create-therapy-session.dto';
import { Patient } from 'src/patients/entities/patient.entity';
import { TherapySession } from './entities/therapy-session.entity';

@Injectable()
export class TherapySessionsService {
  constructor(
    @Inject(FIRESTORE)
    private readonly firestore: Firestore,

    @Inject(REALTIME_DB)
    private readonly realtimeDb: Database,
  ) {}

  async create(
    dto: CreateTherapySessionDto,
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
      endedAt: null,
      activities: (dto.activities ?? [])
        .sort((a, b) => a.order - b.order)
        .map((activity) => ({
          type: activity.type,
          order: activity.order,
          status: 'pending' as const,
        })),
    };

    await sessionRef.set(session);

    await this.realtimeDb.ref(`liveSessions/${session.id}`).set({
      sessionId: session.id,
      therapistId,
      patientId: dto.patientId,
      status: 'active',
      currentActivity: null,
      activities: session.activities,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      endedAt: null,
    });

    return session;
  }

  async end(sessionId: string, therapistId: string): Promise<TherapySession> {
    const sessionRef = this.firestore.collection('sessions').doc(sessionId);
    const sessionSnapshot = await sessionRef.get();

    if (!sessionSnapshot.exists) {
      throw new NotFoundException('Session not found');
    }

    const session = sessionSnapshot.data() as TherapySession;

    if (session.therapistId !== therapistId) {
      throw new NotFoundException('Session not found');
    }

    if (session.status !== 'active') {
      throw new ConflictException('Session has already ended');
    }

    const hasActiveActivity = session.activities.some(
      (activity) => activity.status === 'active',
    );

    if (hasActiveActivity) {
      throw new ConflictException(
        'The current activity must be stopped before ending the session',
      );
    }

    const currentActivitySnapshot = await this.realtimeDb
      .ref(`liveSessions/${sessionId}/currentActivity`)
      .get();

    if (currentActivitySnapshot.exists()) {
      throw new ConflictException(
        'The current activity must be stopped before ending the session',
      );
    }

    const endedAt = new Date();

    const endedSession: TherapySession = {
      ...session,
      status: 'ended',
      endedAt,
      updatedAt: endedAt,
    };

    await sessionRef.update({
      status: 'ended',
      endedAt,
      updatedAt: endedAt,
    });

    // TODO: Handle partial failure if Firestore succeeds but RTDB fails.
    await this.realtimeDb.ref(`liveSessions/${sessionId}`).update({
      status: 'ended',
      endedAt: endedAt.toISOString(),
      updatedAt: endedAt.toISOString(),
    });

    return endedSession;
  }

  async findAllForTherapist(therapistId: string): Promise<TherapySession[]> {
    const snapshot = await this.firestore
      .collection('sessions')
      .where('therapistId', '==', therapistId)
      .get();

    return snapshot.docs.map((doc) => doc.data() as TherapySession);
  }

  async findOne(
    sessionId: string,
    therapistId: string,
  ): Promise<TherapySession> {
    const doc = await this.firestore
      .collection('sessions')
      .doc(sessionId)
      .get();

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
