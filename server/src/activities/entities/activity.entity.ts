import { ActivityType } from '../activity-type.enum';

export enum ActivityCategory {
  Clinic = 'clinic',
  Practice = 'practice',
  Distress = 'distress',
}

export type ActivityStatus = 'active' | 'completed';

export interface Activity<TDetails = unknown> {
  id: string;

  activityCategory: ActivityCategory;
  activityType: ActivityType;
  status: ActivityStatus;

  sessionId: string;
  patientId: string;
  therapistId: string;

  details: TDetails;

  createdAt: string;
  startedAt: string;
  completedAt: string | null;

  durationSeconds: number | null;
  interruptionCount: number;
}
