export type PatientStatus = "active" | "paused" | "completed";
export type PatientSex = "male" | "female" | "unspecified";

export interface Patient {
  id: string;
  therapistId: string;
  displayName: string;
  age: number;
  sex: PatientSex;
  avatarUrl: string | null;
  status: PatientStatus;
  parentIds: string[];
  childUid: string | null;
  parentSharingEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}