export type PatientStatus = 'active' | 'paused' | 'completed';

export interface Patient {
  id: string;
  therapistId: string;
  displayName: string;
  age: number;
  avatarUrl: string | null;
  status: PatientStatus;
  parentIds: string[];
  childUid: string | null;
  createdAt: Date;
  updatedAt: Date;
}