import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  FIREBASE_AUTH,
  FIRESTORE,
  REALTIME_DB,
} from '../../firebase/firebase.constants';
import { OtpService } from './otp.service';
import { Role } from '../role.enum';
import { ParentAccountsService } from '../../parent-accounts/parent-accounts.service';

describe('OtpService', () => {
  let service: OtpService;
  let firestoreMock: any;
  let otpDocRef: any;
  let patientsDocRef: any;
  let sessionsQuery: any;
  let otpCollection: any;
  let patientsCollection: any;
  let sessionsCollection: any;
  let parentAccountsServiceMock: { assertParentOwnsPatient: jest.Mock };

  beforeEach(async () => {
    otpDocRef = {
      get: jest.fn(),
      set: jest.fn(),
    };

    patientsDocRef = {
      get: jest.fn(),
    };

    sessionsQuery = {
      get: jest.fn(),
    };

    otpCollection = {
      doc: jest.fn(() => otpDocRef),
    };

    patientsCollection = {
      doc: jest.fn(() => patientsDocRef),
    };

    sessionsCollection = {
      where: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn(() => sessionsQuery),
        })),
      })),
    };

    firestoreMock = {
      collection: jest.fn((name: string) => {
        if (name === 'otpCodes') return otpCollection;
        if (name === 'patients') return patientsCollection;
        if (name === 'sessions') return sessionsCollection;
        return { doc: jest.fn() };
      }),
    };

    parentAccountsServiceMock = {
      assertParentOwnsPatient: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: FIRESTORE, useValue: firestoreMock },
        {
          provide: FIREBASE_AUTH,
          useValue: { createUser: jest.fn(), createCustomToken: jest.fn() },
        },
        { provide: REALTIME_DB, useValue: { ref: jest.fn() } },
        {
          provide: ParentAccountsService,
          useValue: parentAccountsServiceMock,
        },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
  });

  it('allows an authorized therapist to generate a code', async () => {
    patientsDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ therapistId: 'therapist-1', parentIds: [] }),
    });
    sessionsQuery.get.mockResolvedValue({
      empty: false,
      docs: [{ data: () => ({ id: 'session-1', activities: [] }) }],
    });
    otpDocRef.get.mockResolvedValue({ exists: false });

    await expect(
      service.generate(
        { patientId: 'patient-1' },
        'therapist-1',
        Role.Therapist,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        code: expect.any(String),
        expiresAt: expect.any(Number),
      }),
    );

    expect(otpDocRef.set).toHaveBeenCalledTimes(1);
  });

  it('allows an authorized parent to generate a code', async () => {
    patientsDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ therapistId: 'therapist-1' }),
    });
    parentAccountsServiceMock.assertParentOwnsPatient.mockResolvedValue(
      undefined,
    );
    sessionsQuery.get.mockResolvedValue({
      empty: false,
      docs: [{ data: () => ({ id: 'session-1', activities: [] }) }],
    });
    otpDocRef.get.mockResolvedValue({ exists: false });

    await expect(
      service.generate({ patientId: 'patient-1' }, 'parent-1', Role.Parent),
    ).resolves.toEqual(
      expect.objectContaining({
        code: expect.any(String),
        expiresAt: expect.any(Number),
      }),
    );

    expect(
      parentAccountsServiceMock.assertParentOwnsPatient,
    ).toHaveBeenCalledWith('parent-1', 'patient-1');
    expect(otpDocRef.set).toHaveBeenCalledTimes(1);
  });

  it('rejects an unrelated therapist', async () => {
    patientsDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ therapistId: 'other-therapist', parentIds: [] }),
    });

    await expect(
      service.generate(
        { patientId: 'patient-1' },
        'therapist-1',
        Role.Therapist,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(otpDocRef.set).not.toHaveBeenCalled();
  });

  it('rejects an unrelated parent', async () => {
    patientsDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ therapistId: 'therapist-1' }),
    });
    parentAccountsServiceMock.assertParentOwnsPatient.mockRejectedValue(
      new NotFoundException('Patient not found'),
    );

    await expect(
      service.generate({ patientId: 'patient-1' }, 'parent-1', Role.Parent),
    ).rejects.toThrow(NotFoundException);

    expect(otpDocRef.set).not.toHaveBeenCalled();
  });

  it('rejects a missing patient', async () => {
    patientsDocRef.get.mockResolvedValue({ exists: false });

    await expect(
      service.generate(
        { patientId: 'patient-1' },
        'therapist-1',
        Role.Therapist,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(otpDocRef.set).not.toHaveBeenCalled();
  });

  it('rejects a patient without an active session', async () => {
    patientsDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ therapistId: 'therapist-1', parentIds: [] }),
    });
    sessionsQuery.get.mockResolvedValue({ empty: true, docs: [] });

    await expect(
      service.generate(
        { patientId: 'patient-1' },
        'therapist-1',
        Role.Therapist,
      ),
    ).rejects.toThrow(ConflictException);

    expect(otpDocRef.set).not.toHaveBeenCalled();
  });

  it('does not write an otpCodes document when validation fails', async () => {
    patientsDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ therapistId: 'other-therapist', parentIds: [] }),
    });

    await expect(
      service.generate(
        { patientId: 'patient-1' },
        'therapist-1',
        Role.Therapist,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(otpDocRef.set).not.toHaveBeenCalled();
  });
});
