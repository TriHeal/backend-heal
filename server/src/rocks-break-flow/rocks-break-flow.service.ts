import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import type { Database } from 'firebase-admin/database';
import { FIRESTORE, REALTIME_DB } from '../firebase/firebase.constants';
import { CreateRocksBreakFlowDto } from './dto/create-rocks-break-flow.dto';
import { RocksBreakFlowDetails } from './entities/rocks-break-flow.entity';
import { Activity } from '../activities/entities/activity.entity';
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

    if (session.status !== 'active') {
      throw new ConflictException('Session is not active');
    }

    const currentActivitySnapshot = await this.realtimeDb
      .ref(`liveSessions/${sessionId}/currentActivity`)
      .get();

    if (!currentActivitySnapshot.exists()) {
      throw new ConflictException('No activity is currently active');
    }

    const currentActivity =
      currentActivitySnapshot.val() as Activity<RocksBreakFlowDetails> | null;

    if (!currentActivity) {
      throw new ConflictException('No activity is currently active');
    }

    if (currentActivity.status !== 'active') {
      throw new ConflictException('Current activity is not active');
    }

    if (currentActivity.sessionId !== sessionId) {
      throw new ConflictException(
        'Current activity does not belong to this session',
      );
    }

    if (currentActivity.patientId !== session.patientId) {
      throw new ConflictException(
        'Current activity does not belong to this patient',
      );
    }

    if (currentActivity.therapistId !== therapistId) {
      throw new ConflictException(
        'Current activity does not belong to this therapist',
      );
    }

    if (currentActivity.activityType !== ActivityType.EventProcessing) {
      throw new ConflictException(
        'Current activity is not an event processing activity',
      );
    }

    const activityRef = this.firestore
      .collection('patients')
      .doc(session.patientId)
      .collection('activities')
      .doc(currentActivity.id);

    const activitySnapshot = await activityRef.get();

    if (!activitySnapshot.exists) {
      throw new NotFoundException('Activity not found');
    }

    const storedActivity =
      activitySnapshot.data() as Activity<RocksBreakFlowDetails>;

    if (storedActivity.status !== 'active') {
      throw new ConflictException('Activity is not active');
    }

    if (storedActivity.sessionId !== sessionId) {
      throw new ConflictException(
        'Stored activity does not belong to this session',
      );
    }

    if (storedActivity.patientId !== session.patientId) {
      throw new ConflictException(
        'Stored activity does not belong to this patient',
      );
    }

    if (storedActivity.therapistId !== therapistId) {
      throw new ConflictException(
        'Stored activity does not belong to this therapist',
      );
    }

    if (storedActivity.activityType !== ActivityType.EventProcessing) {
      throw new ConflictException(
        'Stored activity is not an event processing activity',
      );
    }

    const details: RocksBreakFlowDetails = {
      eventTitle: dto.eventTitle,
      thoughts: dto.thoughts,
      facts: dto.facts,
    };

    const updatedActivity: Activity<RocksBreakFlowDetails> = {
      ...storedActivity,
      details,
    };

    await activityRef.update({ details });

    await this.realtimeDb
      .ref(`liveSessions/${sessionId}/currentActivity`)
      .set(updatedActivity);

    return updatedActivity;
  }
}
