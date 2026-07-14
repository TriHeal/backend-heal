import { ActivityType } from '../../activities/activity-type.enum';


export type SessionStatus = 'active' | 'ended';

export type TherapySessionActivityStatus = 'pending' | 'active' | 'completed';

//The game once selected by the therapist for the session
export interface TherapySessionActivity {
  type: ActivityType;
  order: number;
  status: TherapySessionActivityStatus;
}

//activities - stores the games selected by the therapist, in the selected order.
export interface TherapySession {
  id: string;
  therapistId: string;
  patientId: string;
  status: SessionStatus;
  activities: TherapySessionActivity[];
  createdAt: Date;
  updatedAt: Date;
}