import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FIRESTORE, REALTIME_DB } from '../firebase/firebase.constants';
import { ActivityType } from '../activities/activity-type.enum';
import { ActivityCategory } from '../activities/entities/activity.entity';
import { CreateRocksBreakFlowDto } from './dto/create-rocks-break-flow.dto';
import { RocksBreakFlowService } from './rocks-break-flow.service';

describe('RocksBreakFlowService', () => {
  let service: RocksBreakFlowService;
  let firestoreMock: any;
  let realtimeDbMock: any;
  let sessionDoc: any;
  let activityDoc: any;
  let currentActivityRef: any;

  beforeEach(async () => {
    sessionDoc = {
      get: jest.fn(),
    };

    activityDoc = {
      get: jest.fn(),
      update: jest.fn(),
    };

    currentActivityRef = {
      get: jest.fn(),
      set: jest.fn(),
    };

    firestoreMock = {
      collection: jest.fn(),
    };

    realtimeDbMock = {
      ref: jest.fn(),
    };

    firestoreMock.collection.mockImplementation((name: string) => {
      if (name === 'sessions') {
        return { doc: jest.fn(() => sessionDoc) };
      }

      if (name === 'patients') {
        const activitiesCollection = {
          doc: jest.fn(() => activityDoc),
        };
        return {
          doc: jest.fn(() => ({
            collection: jest.fn(() => activitiesCollection),
          })),
        };
      }

      return { doc: jest.fn() };
    });

    realtimeDbMock.ref.mockReturnValue(currentActivityRef);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RocksBreakFlowService,
        { provide: FIRESTORE, useValue: firestoreMock },
        { provide: REALTIME_DB, useValue: realtimeDbMock },
      ],
    }).compile();

    service = module.get<RocksBreakFlowService>(RocksBreakFlowService);
  });

  it('updates the active event processing activity for the session', async () => {
    const dto = new CreateRocksBreakFlowDto();
    dto.eventTitle = 'The rock of self-doubt';
    dto.thoughts = ['I always mess this up'];
    dto.facts = ['I can fix it'];

    sessionDoc.get.mockResolvedValue({
      exists: true,
      data: () => ({
        therapistId: 'therapist-1',
        patientId: 'patient-1',
        status: 'active',
      }),
    });

    currentActivityRef.get.mockResolvedValue({
      exists: () => true,
      val: () => ({
        id: 'activity-1',
        activityType: ActivityType.EventProcessing,
        status: 'active',
        activityCategory: ActivityCategory.Clinic,
        patientId: 'patient-1',
        therapistId: 'therapist-1',
        sessionId: 'session-1',
        startedAt: '2025-01-01T00:00:00.000Z',
        createdAt: '2025-01-01T00:00:00.000Z',
        completedAt: null,
        durationSeconds: null,
        interruptionCount: 0,
        details: {
          eventTitle: 'Old title',
          thoughts: ['old'],
          facts: ['old fact'],
        },
        practice: null,
        distress: null,
        syncMetrics: null,
      }),
    });

    activityDoc.get.mockResolvedValue({
      exists: true,
      data: () => ({
        id: 'activity-1',
        activityType: ActivityType.EventProcessing,
        status: 'active',
        activityCategory: ActivityCategory.Clinic,
        patientId: 'patient-1',
        therapistId: 'therapist-1',
        sessionId: 'session-1',
        startedAt: '2025-01-01T00:00:00.000Z',
        createdAt: '2025-01-01T00:00:00.000Z',
        completedAt: null,
        durationSeconds: null,
        interruptionCount: 0,
        details: {
          eventTitle: 'Old title',
          thoughts: ['old'],
          facts: ['old fact'],
        },
        practice: null,
        distress: null,
        syncMetrics: null,
      }),
    });

    await expect(
      service.create('session-1', dto, 'therapist-1'),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'activity-1',
        details: {
          eventTitle: 'The rock of self-doubt',
          thoughts: ['I always mess this up'],
          facts: ['I can fix it'],
        },
      }),
    );

    expect(activityDoc.update).toHaveBeenCalledWith({
      details: {
        eventTitle: 'The rock of self-doubt',
        thoughts: ['I always mess this up'],
        facts: ['I can fix it'],
      },
    });

    expect(currentActivityRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'activity-1',
        details: {
          eventTitle: 'The rock of self-doubt',
          thoughts: ['I always mess this up'],
          facts: ['I can fix it'],
        },
      }),
    );
  });

  it('rejects when the RTDB current activity belongs to another session', async () => {
    const dto = new CreateRocksBreakFlowDto();

    sessionDoc.get.mockResolvedValue({
      exists: true,
      data: () => ({
        therapistId: 'therapist-1',
        patientId: 'patient-1',
        status: 'active',
      }),
    });

    currentActivityRef.get.mockResolvedValue({
      exists: () => true,
      val: () => ({
        id: 'activity-1',
        activityType: ActivityType.EventProcessing,
        status: 'active',
        sessionId: 'other-session',
        patientId: 'patient-1',
        therapistId: 'therapist-1',
      }),
    });

    await expect(
      service.create('session-1', dto, 'therapist-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when the RTDB current activity belongs to another patient or therapist', async () => {
    const dto = new CreateRocksBreakFlowDto();

    sessionDoc.get.mockResolvedValue({
      exists: true,
      data: () => ({
        therapistId: 'therapist-1',
        patientId: 'patient-1',
        status: 'active',
      }),
    });

    currentActivityRef.get.mockResolvedValue({
      exists: () => true,
      val: () => ({
        id: 'activity-1',
        activityType: ActivityType.EventProcessing,
        status: 'active',
        sessionId: 'session-1',
        patientId: 'other-patient',
        therapistId: 'therapist-1',
      }),
    });

    await expect(
      service.create('session-1', dto, 'therapist-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when the stored Firestore activity identity mismatches', async () => {
    const dto = new CreateRocksBreakFlowDto();

    sessionDoc.get.mockResolvedValue({
      exists: true,
      data: () => ({
        therapistId: 'therapist-1',
        patientId: 'patient-1',
        status: 'active',
      }),
    });

    currentActivityRef.get.mockResolvedValue({
      exists: () => true,
      val: () => ({
        id: 'activity-1',
        activityType: ActivityType.EventProcessing,
        status: 'active',
        sessionId: 'session-1',
        patientId: 'patient-1',
        therapistId: 'therapist-1',
      }),
    });

    activityDoc.get.mockResolvedValue({
      exists: true,
      data: () => ({
        id: 'activity-1',
        activityType: ActivityType.EventProcessing,
        status: 'active',
        sessionId: 'other-session',
        patientId: 'patient-1',
        therapistId: 'therapist-1',
      }),
    });

    await expect(
      service.create('session-1', dto, 'therapist-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when the stored Firestore activity has the wrong type', async () => {
    const dto = new CreateRocksBreakFlowDto();

    sessionDoc.get.mockResolvedValue({
      exists: true,
      data: () => ({
        therapistId: 'therapist-1',
        patientId: 'patient-1',
        status: 'active',
      }),
    });

    currentActivityRef.get.mockResolvedValue({
      exists: () => true,
      val: () => ({
        id: 'activity-1',
        activityType: ActivityType.EventProcessing,
        status: 'active',
        sessionId: 'session-1',
        patientId: 'patient-1',
        therapistId: 'therapist-1',
      }),
    });

    activityDoc.get.mockResolvedValue({
      exists: true,
      data: () => ({
        id: 'activity-1',
        activityType: ActivityType.Breathing,
        status: 'active',
        sessionId: 'session-1',
        patientId: 'patient-1',
        therapistId: 'therapist-1',
      }),
    });

    await expect(
      service.create('session-1', dto, 'therapist-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when no activity is currently active', async () => {
    const dto = new CreateRocksBreakFlowDto();

    sessionDoc.get.mockResolvedValue({
      exists: true,
      data: () => ({
        therapistId: 'therapist-1',
        patientId: 'patient-1',
        status: 'active',
      }),
    });

    currentActivityRef.get.mockResolvedValue({
      exists: () => false,
      val: () => null,
    });

    await expect(
      service.create('session-1', dto, 'therapist-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when the active activity type is not event processing', async () => {
    const dto = new CreateRocksBreakFlowDto();

    sessionDoc.get.mockResolvedValue({
      exists: true,
      data: () => ({
        therapistId: 'therapist-1',
        patientId: 'patient-1',
        status: 'active',
      }),
    });

    currentActivityRef.get.mockResolvedValue({
      exists: () => true,
      val: () => ({
        id: 'activity-1',
        activityType: ActivityType.Breathing,
        status: 'active',
      }),
    });

    await expect(
      service.create('session-1', dto, 'therapist-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when the session is inactive', async () => {
    const dto = new CreateRocksBreakFlowDto();

    sessionDoc.get.mockResolvedValue({
      exists: true,
      data: () => ({
        therapistId: 'therapist-1',
        patientId: 'patient-1',
        status: 'ended',
      }),
    });

    await expect(
      service.create('session-1', dto, 'therapist-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when the therapist does not own the session', async () => {
    const dto = new CreateRocksBreakFlowDto();

    sessionDoc.get.mockResolvedValue({
      exists: true,
      data: () => ({
        therapistId: 'other-therapist',
        patientId: 'patient-1',
        status: 'active',
      }),
    });

    await expect(
      service.create('session-1', dto, 'therapist-1'),
    ).rejects.toThrow(NotFoundException);
  });
});
