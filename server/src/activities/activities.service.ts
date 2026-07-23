import { ActivityType } from './activity-type.enum';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import type { Database } from 'firebase-admin/database';
import { FIRESTORE, REALTIME_DB } from '../firebase/firebase.constants';
import { Activity } from './entities/activity.entity';
import { StartActivityDto } from './dto/start-activity.dto';
import { TherapySession } from 'src/therapy-sessions/entities/therapy-session.entity';
import { StopActivityDto } from './dto/stop-activity.dto';

export interface ActivityCatalogItem {
  type: ActivityType;
  displayName: string;
  isAvailable: boolean;
}

@Injectable()
export class ActivitiesService {
  constructor(
    @Inject(FIRESTORE)
    private readonly firestore: Firestore,

    @Inject(REALTIME_DB)
    private readonly realtimeDb: Database,
  ) {}

  private readonly catalog: ActivityCatalogItem[] = [
    {
      type: ActivityType.Breathing,
      displayName: 'Breathing Exercise',
      isAvailable: true,
    },
    {
      type: ActivityType.EventProcessing,
      displayName: 'Event Processing',
      isAvailable: true,
    },
    {
      type: ActivityType.MemoryLake,
      displayName: 'Memory Lake',
      isAvailable: true,
    },
    {
      type: ActivityType.BondingForest,
      displayName: 'Bonding Forest',
      isAvailable: true,
    },
    {
      type: ActivityType.LeafOnWater,
      displayName: 'Leaf on Water',
      isAvailable: false,
    },
  ];

  findCatalog(): ActivityCatalogItem[] {
    return this.catalog;
  }

  async findRuns(
    sessionId: string,
    therapistId: string,
  ): Promise<Activity<Record<string, unknown>>[]> {
    const sessionSnapshot = await this.firestore
      .collection('sessions')
      .doc(sessionId)
      .get();

    if (!sessionSnapshot.exists) {
      throw new NotFoundException('Session not found');
    }

    const session = sessionSnapshot.data() as TherapySession;

    if (session.therapistId !== therapistId) {
      throw new NotFoundException('Session not found');
    }

    const activitiesSnapshot = await this.firestore
      .collection('patients')
      .doc(session.patientId)
      .collection('activities')
      .where('sessionId', '==', sessionId)
      .get();

    return activitiesSnapshot.docs
      .map((doc) => doc.data() as Activity<Record<string, unknown>>)
      .sort(
        (first, second) =>
          new Date(first.startedAt).getTime() -
          new Date(second.startedAt).getTime(),
      );
  }

  async start(
    sessionId: string,
    dto: StartActivityDto,
    therapistId: string,
  ): Promise<Activity<Record<string, never>>> {
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
      throw new ConflictException('Session is not active');
    }

    const selectedActivity = session.activities.find(
      (activity) => activity.type === dto.activityType,
    );

    if (!selectedActivity) {
      throw new NotFoundException('Activity is not part of this session');
    }

    if (
      selectedActivity.status !== 'pending' &&
      selectedActivity.status !== 'completed'
    ) {
      throw new ConflictException('Activity is already active');
    }

    const currentActivitySnapshot = await this.realtimeDb
      .ref(`liveSessions/${sessionId}/currentActivity`)
      .get();

    if (currentActivitySnapshot.exists()) {
      throw new ConflictException('Another activity is already active');
    }

    const activityRef = this.firestore
      .collection('patients')
      .doc(session.patientId)
      .collection('activities')
      .doc();

    const now = new Date().toISOString();

    const activity: Activity<Record<string, never>> = {
      id: activityRef.id,
      activityCategory: dto.activityCategory,
      activityType: dto.activityType,
      status: 'active',

      sessionId,
      patientId: session.patientId,
      therapistId,

      details: {},

      createdAt: now,
      startedAt: now,
      completedAt: null,
      durationSeconds: null,
      interruptionCount: 0,
      practice: null,
      distress: null,
      syncMetrics: null,
    };

    const updatedActivities = session.activities.map((item) =>
      item.type === dto.activityType
        ? {
            ...item,
            status: 'active' as const,
          }
        : item,
    );

    // TODO: Handle partial failure when Firestore succeeds but updating
    // Realtime Database currentActivity fails.
    const batch = this.firestore.batch();

    batch.set(activityRef, activity);
    batch.update(sessionRef, {
      activities: updatedActivities,
      updatedAt: new Date(),
    });

    await batch.commit();

    await this.realtimeDb.ref(`liveSessions/${sessionId}`).update({
      currentActivity: activity,
      activities: updatedActivities,
      updatedAt: now,
    });
    return activity;
  }

  async stop(
    sessionId: string,
    dto: StopActivityDto,
    therapistId: string,
  ): Promise<Activity<Record<string, unknown>>> {
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
      throw new ConflictException('Session is not active');
    }

    const currentActivityRef = this.realtimeDb.ref(
      `liveSessions/${sessionId}/currentActivity`,
    );

    const currentActivitySnapshot = await currentActivityRef.get();

    if (!currentActivitySnapshot.exists()) {
      throw new ConflictException('No activity is currently active');
    }

    const liveActivity = currentActivitySnapshot.val() as Activity<
      Record<string, unknown>
    >;

    const activityRef = this.firestore
      .collection('patients')
      .doc(session.patientId)
      .collection('activities')
      .doc(liveActivity.id);

    const activitySnapshot = await activityRef.get();

    if (!activitySnapshot.exists) {
      throw new NotFoundException('Activity not found');
    }

    const storedActivity = activitySnapshot.data() as Activity<
      Record<string, unknown>
    >;

    if (storedActivity.status !== 'active') {
      throw new ConflictException('Activity is not active');
    }

    const completedAt = new Date();
    const startedAt = new Date(storedActivity.startedAt);

    const durationSeconds = Math.max(
      0,
      Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000),
    );

    const completedActivity: Activity<Record<string, unknown>> = {
      ...storedActivity,
      status: 'completed',
      details: dto.details ?? storedActivity.details,
      completedAt: completedAt.toISOString(),
      durationSeconds,
      interruptionCount:
        dto.interruptionCount ?? storedActivity.interruptionCount,
    };

    const updatedActivities = session.activities.map((item) =>
      item.type === storedActivity.activityType && item.status === 'active'
        ? {
            ...item,
            status: 'completed' as const,
          }
        : item,
    );

    const batch = this.firestore.batch();

    batch.set(activityRef, completedActivity);
    batch.update(sessionRef, {
      activities: updatedActivities,
      updatedAt: completedAt,
    });

    await batch.commit();

    await this.realtimeDb.ref(`liveSessions/${sessionId}`).update({
      currentActivity: null,
      activities: updatedActivities,
      updatedAt: completedAt.toISOString(),
    });

    return completedActivity;
  }
}
