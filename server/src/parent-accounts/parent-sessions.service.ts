import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import type { Database } from 'firebase-admin/database';
import { FIRESTORE, REALTIME_DB } from '../firebase/firebase.constants';
import { Role } from '../auth/role.enum';
import { Patient } from '../patients/entities/patient.entity';
import { TherapySession } from '../therapy-sessions/entities/therapy-session.entity';
import { ParentAccountsService } from './parent-accounts.service';

export interface WatchChildSessionResult {
  patientId: string;
  sessionId: string;
  activities: TherapySession['activities'];
  realtimePath: string;
}

@Injectable()
export class ParentSessionsService {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: Firestore,
    @Inject(REALTIME_DB) private readonly realtimeDb: Database,
    private readonly parentAccountsService: ParentAccountsService,
  ) {}

  /**
   * Bind an authenticated parent to their child's currently active therapy
   * session so they can watch it live via RTDB `liveSessions`.
   */
  async watchChildSession(
    parentUid: string,
    patientId: string,
  ): Promise<WatchChildSessionResult> {
    // 404s if this patient isn't one of the parent's linked children.
    await this.parentAccountsService.assertParentOwnsPatient(
      parentUid,
      patientId,
    );

    // Respect the therapist's per-patient sharing toggle (defaults to false):
    // owning the child is necessary but not sufficient — the therapist must
    // have opted in to parent live-session sharing.
    const patientSnapshot = await this.firestore
      .collection('patients')
      .doc(patientId)
      .get();

    if (!patientSnapshot.exists) {
      throw new NotFoundException('Patient not found');
    }

    const patient = patientSnapshot.data() as Patient;

    if (!patient.parentSharingEnabled) {
      throw new ForbiddenException(
        'Parent sharing is disabled for this patient',
      );
    }

    const activeSessionsSnapshot = await this.firestore
      .collection('sessions')
      .where('patientId', '==', patientId)
      .where('status', '==', 'active')
      .get();

    if (activeSessionsSnapshot.empty) {
      throw new NotFoundException('No active session found for patient');
    }

    // More than one active session can exist if a prior one was abandoned
    // (TherapySessionsService.create does not close an existing active session).
    // Bind to the most recently created one so the parent never lands on a
    // stale session (equality-only query, so no composite index is needed).
    const session = activeSessionsSnapshot.docs
      .map((doc) => doc.data() as TherapySession)
      .reduce((latest, candidate) =>
        this.createdAtMillis(candidate) > this.createdAtMillis(latest)
          ? candidate
          : latest,
      );

    const realtimePath = `liveSessions/${session.id}`;
    const now = new Date().toISOString();

    // Keyed by uid so the RTDB security rule can match request.auth.uid.
    await this.realtimeDb
      .ref(`${realtimePath}/participants/parents/${parentUid}`)
      .set({
        uid: parentUid,
        patientId,
        role: Role.Parent,
        joinedAt: now,
      });

    return {
      patientId,
      sessionId: session.id,
      activities: session.activities ?? [],
      realtimePath,
    };
  }

  // createdAt may come back as a Firestore Timestamp (admin read), a Date, or a
  // string depending on the write path — normalise to epoch millis for sorting.
  private createdAtMillis(session: TherapySession): number {
    const value = session.createdAt as unknown;
    if (value == null) return 0;
    if (typeof (value as { toMillis?: () => number }).toMillis === 'function') {
      return (value as { toMillis: () => number }).toMillis();
    }
    if (value instanceof Date) return value.getTime();
    const parsed = new Date(value as string).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
}
