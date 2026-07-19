import { ActivityType } from '../activity-type.enum';

export type ActivityCategory = 'clinic' | 'practice' | 'distress';

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

  createdAt: string;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number;
  interruptionCount: number;

  details: TDetails;

  practice: ActivityPractice | null;
  distress: unknown | null;
  syncMetrics: unknown | null;
}
