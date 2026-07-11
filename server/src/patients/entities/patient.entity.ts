export type PatientStatus = 'active' | 'inactive';

export interface Patient {
  id: string;
  therapistId: string;
  displayName: string;
  age: number;
  avatarUrl: string | null;
  status: PatientStatus;
  parentIds: string[];
  createdAt: Date;
  updatedAt: Date;
}