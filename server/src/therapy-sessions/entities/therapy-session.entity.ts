export type SessionStatus = 'active' | 'ended';

export interface TherapySession {
  id: string;
  therapistId: string;
  patientId: string;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
}