export type ParentInvitationStatus = 'pending' | 'accepted' | 'expired';

export interface ParentInvitation {
  id: string;
  parentId: string;
  patientId: string;
  therapistId: string;
  tokenHash: string;
  status: ParentInvitationStatus;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt: Date | null;
}
