export interface Activity<TDetails = unknown> {
  id: string;
  activityType: string;
  sessionId: string;
  patientId: string;
  therapistId: string;
  details: TDetails;
  createdAt: string;
}
