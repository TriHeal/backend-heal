export type ParentRelationship = 'mother' | 'father' | 'guardian' | 'other';
export type ParentInvitationStatus =
  'not_requested' | 'pending' | 'accepted' | 'failed';

export interface ParentAccount {
  id: string;
  therapistId: string;
  firebaseUid: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  relationship: ParentRelationship;
  canAccessApp: boolean;
  patientIds: string[];
  invitationStatus: ParentInvitationStatus;
  createdAt: Date;
  updatedAt: Date;
}
