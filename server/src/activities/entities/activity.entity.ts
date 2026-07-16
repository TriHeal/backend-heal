import { ActivityType } from '../activity-type.enum';

export enum ActivityCategory {
  Clinic = 'clinic',
  Practice = 'practice',
  Distress = 'distress',
}

export type ActivityStatus = 'active' | 'completed';

export interface ActivityPractice {
  assignedByTherapistId: string;
  assignedInSessionId: string;
  performedInSessionId: string;
  assignedAt: string;
  instructions: string;
  targetCount: number;
  completedCount: number;
  isCompleted: boolean;
}

export interface Activity<TDetails = unknown> {
  id: string;
  patientId: string;
  therapistId: string;
  sessionId: string;

  activityCategory: ActivityCategory;
  activityType: ActivityType;
  status: ActivityStatus;

  createdAt: string;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  interruptionCount: number;

  details: TDetails;

  practice: ActivityPractice | null;
  distress: unknown | null;
  syncMetrics: unknown | null;
}
