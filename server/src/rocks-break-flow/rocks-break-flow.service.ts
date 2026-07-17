import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import type { Database } from 'firebase-admin/database';
import { FIRESTORE, REALTIME_DB } from '../firebase/firebase.constants';
import { CreateRocksBreakFlowDto } from './dto/create-rocks-break-flow.dto';
import { RocksBreakFlowDetails } from './entities/rocks-break-flow.entity';
import {
  Activity,
  ActivityCategory,
} from '../activities/entities/activity.entity';
import { ActivityType } from '../activities/activity-type.enum';
import { TherapySession } from '../therapy-sessions/entities/therapy-session.entity';

@Injectable()
export class RocksBreakFlowService {
  constructor(
    @Inject(FIRESTORE)
    private readonly firestore: Firestore,

    @Inject(REALTIME_DB)
    private readonly realtimeDb: Database,
  ) {}

  async create(
    sessionId: string,
    dto: CreateRocksBreakFlowDto,
    therapistId: string,
  ): Promise<Activity<RocksBreakFlowDetails>> {
    const sessionDoc = await this.firestore
      .collection('sessions')
      .doc(sessionId)
      .get();

    if (!sessionDoc.exists) {
      throw new NotFoundException('Session not found');
    }

    const session = sessionDoc.data() as TherapySession;

    if (session.therapistId !== therapistId) {
      throw new NotFoundException('Session not found');
    }

    const details: RocksBreakFlowDetails = {
      eventTitle: dto.eventTitle,
      thoughts: dto.thoughts,
      facts: dto.facts,
    };

    const activityRef = this.firestore
      .collection('patients')
      .doc(session.patientId)
      .collection('activities')
      .doc();

    const now = new Date().toISOString();

    const activity: Activity<RocksBreakFlowDetails> = {
      id: activityRef.id,
      activityCategory: ActivityCategory.Clinic,
      activityType: ActivityType.EventProcessing,
      status: 'active',

      sessionId,
      patientId: session.patientId,
      therapistId,

      details,

      createdAt: now,
      startedAt: now,
      completedAt: null,
      durationSeconds: null,
      interruptionCount: 0,
    };

    await activityRef.set(activity);

    await this.realtimeDb
      .ref(`liveSessions/${sessionId}/currentActivity`)
      .set(activity);

    return activity;
  }
}
