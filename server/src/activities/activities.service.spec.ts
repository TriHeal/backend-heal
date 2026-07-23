import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FIRESTORE, REALTIME_DB } from '../firebase/firebase.constants';
import { ActivityType } from './activity-type.enum';
import { ActivitiesService } from './activities.service';
import { StartActivityDto } from './dto/start-activity.dto';
import { ActivityCategory } from './entities/activity.entity';

describe('ActivitiesService', () => {
  let service: ActivitiesService;
  let firestoreMock: any;
  let realtimeDbMock: any;

  let sessionDoc: any;
  let sessionsCollection: any;
  let patientsCollection: any;
  let patientDoc: any;
  let activitiesCollection: any;
  let activitiesQuery: any;

  let currentActivityRef: any;
  let liveSessionRef: any;
  let batchMock: any;
  let activityCounter: number;

  const startDto: StartActivityDto = {
    activityType: ActivityType.Breathing,
    activityCategory: ActivityCategory.Clinic,
  };

  function sessionWithActivity(status: 'pending' | 'active' | 'completed') {
    return {
      therapistId: 'therapist-1',
      patientId: 'patient-1',
      status: 'active',
      activities: [
        {
          type: ActivityType.Breathing,
          order: 1,
          status,
        },
      ],
    };
  }

  beforeEach(async () => {
    activityCounter = 0;

    sessionDoc = {
      get: jest.fn(),
    };

    sessionsCollection = {
      doc: jest.fn(() => sessionDoc),
    };

    activitiesQuery = {
      get: jest.fn(),
    };

    activitiesCollection = {
      doc: jest.fn(() => ({
        id: `activity-${++activityCounter}`,
      })),
      where: jest.fn(() => activitiesQuery),
    };

    patientDoc = {
      collection: jest.fn(() => activitiesCollection),
    };

    patientsCollection = {
      doc: jest.fn(() => patientDoc),
    };

    batchMock = {
      set: jest.fn(),
      update: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };

    firestoreMock = {
      collection: jest.fn((name: string) => {
        if (name === 'sessions') return sessionsCollection;
        if (name === 'patients') return patientsCollection;
        return {};
      }),
      batch: jest.fn(() => batchMock),
    };

    currentActivityRef = {
      get: jest.fn().mockResolvedValue({
        exists: () => false,
      }),
    };

    liveSessionRef = {
      update: jest.fn(),
    };

    realtimeDbMock = {
      ref: jest.fn((path: string) =>
        path.endsWith('/currentActivity') ? currentActivityRef : liveSessionRef,
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        { provide: FIRESTORE, useValue: firestoreMock },
        { provide: REALTIME_DB, useValue: realtimeDbMock },
      ],
    }).compile();

    service = module.get<ActivitiesService>(ActivitiesService);
  });

  it('starts a completed planned activity again', async () => {
    sessionDoc.get.mockResolvedValue({
      exists: true,
      data: () => sessionWithActivity('completed'),
    });

    await expect(
      service.start('session-1', startDto, 'therapist-1'),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'activity-1',
        activityType: ActivityType.Breathing,
        activityCategory: ActivityCategory.Clinic,
        status: 'active',
        sessionId: 'session-1',
        patientId: 'patient-1',
        therapistId: 'therapist-1',
      }),
    );

    expect(batchMock.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'activity-1' }),
      expect.objectContaining({
        id: 'activity-1',
        activityType: ActivityType.Breathing,
        status: 'active',
      }),
    );

    expect(batchMock.update).toHaveBeenCalledWith(
      sessionDoc,
      expect.objectContaining({
        activities: [
          expect.objectContaining({
            type: ActivityType.Breathing,
            status: 'active',
          }),
        ],
      }),
    );

    expect(liveSessionRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        currentActivity: expect.objectContaining({
          id: 'activity-1',
          activityType: ActivityType.Breathing,
        }),
      }),
    );
  });

  it('rejects starting an activity that is already active', async () => {
    sessionDoc.get.mockResolvedValue({
      exists: true,
      data: () => sessionWithActivity('active'),
    });

    await expect(
      service.start('session-1', startDto, 'therapist-1'),
    ).rejects.toThrow(ConflictException);

    expect(currentActivityRef.get).not.toHaveBeenCalled();
    expect(activitiesCollection.doc).not.toHaveBeenCalled();
  });

  it('creates a new activity document for every restart', async () => {
    sessionDoc.get.mockResolvedValue({
      exists: true,
      data: () => sessionWithActivity('completed'),
    });

    const firstRun = await service.start('session-1', startDto, 'therapist-1');

    const secondRun = await service.start('session-1', startDto, 'therapist-1');

    expect(firstRun.id).toBe('activity-1');
    expect(secondRun.id).toBe('activity-2');
    expect(activitiesCollection.doc).toHaveBeenCalledTimes(2);

    expect(batchMock.set).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'activity-1' }),
      expect.objectContaining({ id: 'activity-1' }),
    );

    expect(batchMock.set).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'activity-2' }),
      expect.objectContaining({ id: 'activity-2' }),
    );
  });

  it('returns the requested session runs sorted by start time', async () => {
    sessionDoc.get.mockResolvedValue({
      exists: true,
      data: () => ({
        therapistId: 'therapist-1',
        patientId: 'patient-1',
        status: 'active',
        activities: [],
      }),
    });

    activitiesQuery.get.mockResolvedValue({
      docs: [
        {
          data: () => ({
            id: 'activity-late',
            sessionId: 'session-1',
            startedAt: '2026-07-23T10:00:00.000Z',
          }),
        },
        {
          data: () => ({
            id: 'activity-early',
            sessionId: 'session-1',
            startedAt: '2026-07-23T09:00:00.000Z',
          }),
        },
      ],
    });

    const result = await service.findRuns('session-1', 'therapist-1');

    expect(activitiesCollection.where).toHaveBeenCalledWith(
      'sessionId',
      '==',
      'session-1',
    );

    expect(result.map((activity) => activity.id)).toEqual([
      'activity-early',
      'activity-late',
    ]);
  });

  it('rejects activity-run access for an unrelated therapist', async () => {
    sessionDoc.get.mockResolvedValue({
      exists: true,
      data: () => ({
        therapistId: 'other-therapist',
        patientId: 'patient-1',
        status: 'active',
        activities: [],
      }),
    });

    await expect(service.findRuns('session-1', 'therapist-1')).rejects.toThrow(
      NotFoundException,
    );

    expect(activitiesCollection.where).not.toHaveBeenCalled();
  });
});
