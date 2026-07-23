import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FIRESTORE, REALTIME_DB } from '../firebase/firebase.constants';
import { ParentAccountsService } from './parent-accounts.service';
import { ParentSessionsService } from './parent-sessions.service';

describe('ParentSessionsService', () => {
  let service: ParentSessionsService;
  let firestoreMock: any;
  let realtimeDbMock: any;
  let sessionsQuery: any;
  let patientDocRef: any;
  let participantRef: any;
  let parentAccountsServiceMock: { assertParentOwnsPatient: jest.Mock };

  beforeEach(async () => {
    sessionsQuery = { get: jest.fn() };
    patientDocRef = { get: jest.fn() };

    firestoreMock = {
      collection: jest.fn((name: string) => {
        if (name === 'sessions') {
          return {
            where: jest.fn(() => ({
              where: jest.fn(() => sessionsQuery),
            })),
          };
        }
        if (name === 'patients') {
          return { doc: jest.fn(() => patientDocRef) };
        }
        return { doc: jest.fn() };
      }),
    };

    participantRef = { set: jest.fn().mockResolvedValue(undefined) };
    realtimeDbMock = { ref: jest.fn(() => participantRef) };

    parentAccountsServiceMock = {
      assertParentOwnsPatient: jest.fn().mockResolvedValue(undefined),
    };

    // Default: patient exists with sharing enabled.
    patientDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ id: 'patient-1', parentSharingEnabled: true }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParentSessionsService,
        { provide: FIRESTORE, useValue: firestoreMock },
        { provide: REALTIME_DB, useValue: realtimeDbMock },
        {
          provide: ParentAccountsService,
          useValue: parentAccountsServiceMock,
        },
      ],
    }).compile();

    service = module.get<ParentSessionsService>(ParentSessionsService);
  });

  it('binds the parent to the child active session and returns the realtime path', async () => {
    sessionsQuery.get.mockResolvedValue({
      empty: false,
      docs: [
        {
          data: () => ({
            id: 'session-1',
            createdAt: new Date('2026-01-01T00:00:00Z'),
            activities: [{ type: 'breathing', order: 1, status: 'pending' }],
          }),
        },
      ],
    });

    const result = await service.watchChildSession('parent-uid', 'patient-1');

    expect(
      parentAccountsServiceMock.assertParentOwnsPatient,
    ).toHaveBeenCalledWith('parent-uid', 'patient-1');
    expect(realtimeDbMock.ref).toHaveBeenCalledWith(
      'liveSessions/session-1/participants/parents/parent-uid',
    );
    expect(participantRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'parent-uid',
        patientId: 'patient-1',
        role: 'parent',
      }),
    );
    expect(result).toEqual({
      patientId: 'patient-1',
      sessionId: 'session-1',
      activities: [{ type: 'breathing', order: 1, status: 'pending' }],
      realtimePath: 'liveSessions/session-1',
    });
  });

  it('binds to the most recently created session when several are active', async () => {
    sessionsQuery.get.mockResolvedValue({
      empty: false,
      docs: [
        {
          data: () => ({
            id: 'stale-session',
            createdAt: new Date('2026-01-01T00:00:00Z'),
            activities: [],
          }),
        },
        {
          data: () => ({
            id: 'fresh-session',
            createdAt: new Date('2026-06-01T00:00:00Z'),
            activities: [],
          }),
        },
      ],
    });

    const result = await service.watchChildSession('parent-uid', 'patient-1');

    expect(result.sessionId).toBe('fresh-session');
    expect(realtimeDbMock.ref).toHaveBeenCalledWith(
      'liveSessions/fresh-session/participants/parents/parent-uid',
    );
  });

  it('rejects a parent who does not own the patient', async () => {
    parentAccountsServiceMock.assertParentOwnsPatient.mockRejectedValue(
      new NotFoundException('Patient not found'),
    );

    await expect(
      service.watchChildSession('parent-uid', 'patient-1'),
    ).rejects.toThrow(NotFoundException);

    expect(realtimeDbMock.ref).not.toHaveBeenCalled();
  });

  it('rejects when the therapist has not enabled parent sharing', async () => {
    patientDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ id: 'patient-1', parentSharingEnabled: false }),
    });

    await expect(
      service.watchChildSession('parent-uid', 'patient-1'),
    ).rejects.toThrow(ForbiddenException);

    expect(sessionsQuery.get).not.toHaveBeenCalled();
    expect(participantRef.set).not.toHaveBeenCalled();
  });

  it('rejects when the child has no active session', async () => {
    sessionsQuery.get.mockResolvedValue({ empty: true, docs: [] });

    await expect(
      service.watchChildSession('parent-uid', 'patient-1'),
    ).rejects.toThrow(NotFoundException);

    expect(participantRef.set).not.toHaveBeenCalled();
  });
});
