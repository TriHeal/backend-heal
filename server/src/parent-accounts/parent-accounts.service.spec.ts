import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { ParentAccountsService } from './parent-accounts.service';
import { ParentEmailService } from './parent-email.service';
import { CreateParentAccountDto } from './dto/create-parent-account.dto';
import { AcceptParentInvitationDto } from './dto/accept-parent-invitation.dto';
import { FIREBASE_AUTH, FIRESTORE } from '../firebase/firebase.constants';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UpdateParentAccountDto } from './dto/update-parent-account.dto';

function createDoc(id: string) {
  return {
    id,
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
  };
}

function createSnapshot(data: any) {
  return {
    exists: true,
    data: () => data,
  };
}

describe('ParentAccountsService', () => {
  let service: ParentAccountsService;
  let firestoreMock: any;
  let emailServiceMock: any;
  let firebaseAuthMock: any;
  let transactionMock: any;

  beforeEach(async () => {
    process.env.PARENT_INVITE_BASE_URL = 'http://localhost:3001';

    transactionMock = {
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
    };

    firestoreMock = {
      collection: jest.fn(),
      runTransaction: jest.fn((callback: any) => callback(transactionMock)),
    };

    emailServiceMock = {
      sendParentInvitationEmail: jest.fn(),
    };

    firebaseAuthMock = {
      getUserByEmail: jest.fn(),
      createUser: jest.fn(),
      createCustomToken: jest.fn().mockResolvedValue('custom-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParentAccountsService,
        { provide: FIRESTORE, useValue: firestoreMock },
        { provide: FIREBASE_AUTH, useValue: firebaseAuthMock },
        { provide: ParentEmailService, useValue: emailServiceMock },
      ],
    }).compile();

    service = module.get<ParentAccountsService>(ParentAccountsService);
  });

  it('validates requestAppAccess and email requirement', async () => {
    const dto = new CreateParentAccountDto();
    dto.patientId = 'patient-1';
    dto.fullName = 'Linda Doe';
    dto.relationship = 'mother';
    dto.requestAppAccess = true;

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });

  it('throws when therapist does not own the patient', async () => {
    const patientDoc = createDoc('patient-1');
    patientDoc.get.mockResolvedValue(
      createSnapshot({
        therapistId: 'other-therapist',
        parentIds: [],
        displayName: 'Danny',
      }),
    );

    const patientCollection = { doc: jest.fn(() => patientDoc) };
    const parentAccountsCollection = {
      doc: jest.fn(() => createDoc('parent-1')),
    };
    firestoreMock.collection.mockImplementation((name: string) => {
      switch (name) {
        case 'patients':
          return patientCollection;
        case 'parentAccounts':
          return parentAccountsCollection;
        default:
          return { doc: jest.fn() };
      }
    });

    transactionMock.get.mockResolvedValue(
      createSnapshot({
        therapistId: 'other-therapist',
        parentIds: [],
        displayName: 'Danny',
      }),
    );

    const dto = new CreateParentAccountDto();
    dto.patientId = 'patient-1';
    dto.fullName = 'Linda Doe';
    dto.relationship = 'mother';
    dto.requestAppAccess = false;

    await expect(service.create(dto, 'therapist-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lists parent accounts linked to a patient', async () => {
    const patientDoc = createDoc('patient-1');
    patientDoc.get.mockResolvedValue(
      createSnapshot({
        id: 'patient-1',
        therapistId: 'therapist-1',
        parentIds: ['parent-1'],
      }),
    );

    const parent = {
      id: 'parent-1',
      therapistId: 'therapist-1',
      firebaseUid: null,
      fullName: 'Linda Doe',
      email: 'mom@example.com',
      phone: null,
      relationship: 'mother',
      canAccessApp: false,
      patientIds: ['patient-1'],
      invitationStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const parentQuery = {
      get: jest.fn().mockResolvedValue({
        docs: [{ data: () => parent }],
      }),
    };

    const firstParentWhere = {
      where: jest.fn().mockReturnValue(parentQuery),
    };

    firestoreMock.collection.mockImplementation((name: string) => {
      if (name === 'patients') {
        return { doc: jest.fn(() => patientDoc) };
      }

      if (name === 'parentAccounts') {
        return {
          where: jest.fn().mockReturnValue(firstParentWhere),
        };
      }

      return { doc: jest.fn() };
    });

    const result = await service.findAllByPatient('patient-1', 'therapist-1');

    expect(result).toEqual([parent]);
  });

  it('updates a parent account owned by the therapist', async () => {
    const parentDoc = createDoc('parent-1');

    const existingParent = {
      id: 'parent-1',
      therapistId: 'therapist-1',
      firebaseUid: null,
      fullName: 'Linda Doe',
      email: 'mom@example.com',
      phone: null,
      relationship: 'mother',
      canAccessApp: false,
      patientIds: ['patient-1'],
      invitationStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    parentDoc.get.mockResolvedValue(createSnapshot(existingParent));

    firestoreMock.collection.mockImplementation((name: string) => {
      if (name === 'parentAccounts') {
        return { doc: jest.fn(() => parentDoc) };
      }

      return { doc: jest.fn() };
    });

    const dto = new UpdateParentAccountDto();
    dto.fullName = 'Linda Cohen';
    dto.phone = '+972501111111';

    const result = await service.update('parent-1', dto, 'therapist-1');

    expect(parentDoc.set).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'parent-1',
        fullName: 'Linda Cohen',
        phone: '+972501111111',
        email: 'mom@example.com',
        canAccessApp: false,
      }),
    );

    expect(result.fullName).toBe('Linda Cohen');
    expect(result.phone).toBe('+972501111111');
  });
  it('creates a parent account, links patient, and sends invitation email', async () => {
    const patientDoc = createDoc('patient-1');
    patientDoc.get.mockResolvedValue(
      createSnapshot({
        therapistId: 'therapist-1',
        parentIds: [],
        displayName: 'Danny',
      }),
    );

    const parentDoc = createDoc('parent-1');
    const invitationDoc = createDoc('invitation-1');

    const patientsCollection = { doc: jest.fn(() => patientDoc) };
    const parentAccountsCollection = { doc: jest.fn(() => parentDoc) };
    const parentInvitationsCollection = { doc: jest.fn(() => invitationDoc) };

    firestoreMock.collection.mockImplementation((name: string) => {
      switch (name) {
        case 'patients':
          return patientsCollection;
        case 'parentAccounts':
          return parentAccountsCollection;
        case 'parentInvitations':
          return parentInvitationsCollection;
        default:
          return { doc: jest.fn() };
      }
    });

    transactionMock.get.mockResolvedValue(
      createSnapshot({
        therapistId: 'therapist-1',
        parentIds: [],
        displayName: 'Danny',
      }),
    );
    emailServiceMock.sendParentInvitationEmail.mockResolvedValue({});

    const dto = new CreateParentAccountDto();
    dto.patientId = 'patient-1';
    dto.fullName = 'Linda Doe';
    dto.relationship = 'mother';
    dto.email = 'mom@example.com';
    dto.requestAppAccess = true;

    const result = await service.create(dto, 'therapist-1');

    expect(result.parent.id).toBe('parent-1');
    expect(transactionMock.set).toHaveBeenCalledWith(
      parentDoc,
      expect.objectContaining({ id: 'parent-1' }),
    );
    expect(transactionMock.set).toHaveBeenCalledWith(
      patientDoc,
      expect.objectContaining({ parentIds: ['parent-1'] }),
    );
    expect(transactionMock.set).toHaveBeenCalledWith(
      invitationDoc,
      expect.objectContaining({ parentId: 'parent-1' }),
    );
    expect(emailServiceMock.sendParentInvitationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'mom@example.com', patientName: 'Danny' }),
    );
    expect(result.emailSent).toBe(true);
    expect(result.invitationFailed).toBe(false);
  });

  it('marks parent invitation as failed when email delivery fails', async () => {
    const patientDoc = createDoc('patient-1');
    patientDoc.get.mockResolvedValue(
      createSnapshot({
        therapistId: 'therapist-1',
        parentIds: [],
        displayName: 'Danny',
      }),
    );

    const parentDoc = createDoc('parent-1');
    const invitationDoc = createDoc('invitation-1');

    const patientsCollection = { doc: jest.fn(() => patientDoc) };
    const parentAccountsCollection = { doc: jest.fn(() => parentDoc) };
    const parentInvitationsCollection = { doc: jest.fn(() => invitationDoc) };

    firestoreMock.collection.mockImplementation((name: string) => {
      switch (name) {
        case 'patients':
          return patientsCollection;
        case 'parentAccounts':
          return parentAccountsCollection;
        case 'parentInvitations':
          return parentInvitationsCollection;
        default:
          return { doc: jest.fn() };
      }
    });

    transactionMock.get.mockResolvedValue(
      createSnapshot({
        therapistId: 'therapist-1',
        parentIds: [],
        displayName: 'Danny',
      }),
    );
    emailServiceMock.sendParentInvitationEmail.mockRejectedValue(
      new Error('Send failed'),
    );

    const dto = new CreateParentAccountDto();
    dto.patientId = 'patient-1';
    dto.fullName = 'Linda Doe';
    dto.relationship = 'mother';
    dto.email = 'mom@example.com';
    dto.requestAppAccess = true;

    const result = await service.create(dto, 'therapist-1');

    expect(result.emailSent).toBe(false);
    expect(result.invitationFailed).toBe(true);
    expect(parentAccountsCollection.doc).toHaveBeenCalledWith('parent-1');
    expect(parentDoc.update).toHaveBeenCalledWith(
      expect.objectContaining({ invitationStatus: 'failed' }),
    );
  });

  it('rejects expired invitation tokens', async () => {
    const expiredDate = new Date(Date.now() - 1000 * 60);
    const invitationDoc = createDoc('invitation-1');
    const invitationData = {
      id: 'invitation-1',
      parentId: 'parent-1',
      patientId: 'patient-1',
      therapistId: 'therapist-1',
      tokenHash: 'deadbeef',
      status: 'pending',
      expiresAt: expiredDate,
      createdAt: new Date(),
      acceptedAt: null,
    };

    const invitationSnapshot = {
      data: () => invitationData,
      ref: invitationDoc,
      exists: true,
    };

    const parentInvitationsQuery = {
      empty: false,
      docs: [invitationSnapshot],
    };

    firestoreMock.collection.mockImplementation((name: string) => {
      if (name === 'parentInvitations') {
        return {
          where: jest.fn(() => ({
            limit: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue(parentInvitationsQuery),
            }),
          })),
        };
      }

      return { doc: jest.fn() };
    });

    const dto = new AcceptParentInvitationDto();
    dto.token = 'raw-token';

    // Expiry is caught by the pre-check (before any transaction or Firebase
    // Auth provisioning), which marks the invitation on its own ref.
    await expect(service.acceptInvitation(dto)).rejects.toThrow(
      BadRequestException,
    );
    expect(invitationDoc.update).toHaveBeenCalledWith({ status: 'expired' });
    expect(firebaseAuthMock.createUser).not.toHaveBeenCalled();
    expect(firestoreMock.runTransaction).not.toHaveBeenCalled();
  });

  it('accepts valid parent invitation tokens and provisions a login', async () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60);
    const invitationDoc = createDoc('invitation-1');
    const invitationData = {
      id: 'invitation-1',
      parentId: 'parent-1',
      patientId: 'patient-1',
      therapistId: 'therapist-1',
      tokenHash: 'f0f0f0',
      status: 'pending',
      expiresAt: futureDate,
      createdAt: new Date(),
      acceptedAt: null,
    };

    const invitationSnapshot = {
      data: () => invitationData,
      ref: invitationDoc,
      exists: true,
    };

    const parentRef = createDoc('parent-1');
    const parentData = {
      id: 'parent-1',
      therapistId: 'therapist-1',
      patientIds: ['patient-1'],
      canAccessApp: false,
      invitationStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      firebaseUid: null,
      fullName: 'Linda Doe',
      email: 'mom@example.com',
      phone: null,
      relationship: 'mother',
    };
    // Non-transactional pre-read used to resolve the parent's email/uid.
    parentRef.get.mockResolvedValue(createSnapshot(parentData));

    const patientData = {
      id: 'patient-1',
      displayName: 'Danny',
      age: 7,
      avatarUrl: null,
    };
    const patientRef = createDoc('patient-1');
    const usersDoc = createDoc('firebase-parent-1');

    const parentAccountCollection = { doc: jest.fn(() => parentRef) };
    const parentInvitationsQuery = {
      empty: false,
      docs: [invitationSnapshot],
    };

    firestoreMock.collection.mockImplementation((name: string) => {
      if (name === 'parentInvitations') {
        return {
          where: jest.fn(() => ({
            limit: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue(parentInvitationsQuery),
            }),
          })),
        };
      }

      if (name === 'parentAccounts') {
        return parentAccountCollection;
      }

      if (name === 'patients') {
        return { doc: jest.fn(() => patientRef) };
      }

      if (name === 'users') {
        return { doc: jest.fn(() => usersDoc) };
      }

      return { doc: jest.fn() };
    });

    // Existing Firebase user for this email -> reuse its uid.
    firebaseAuthMock.getUserByEmail.mockResolvedValue({
      uid: 'firebase-parent-1',
    });

    transactionMock.get
      .mockResolvedValueOnce(invitationSnapshot)
      .mockResolvedValueOnce(createSnapshot(parentData))
      .mockResolvedValueOnce(createSnapshot(patientData));

    const dto = new AcceptParentInvitationDto();
    dto.token = 'raw-token';

    const result = await service.acceptInvitation(dto);

    expect(firebaseAuthMock.getUserByEmail).toHaveBeenCalledWith(
      'mom@example.com',
    );
    expect(transactionMock.update).toHaveBeenCalledWith(invitationDoc, {
      status: 'accepted',
      acceptedAt: expect.any(Date),
    });
    expect(transactionMock.update).toHaveBeenCalledWith(
      parentRef,
      expect.objectContaining({
        firebaseUid: 'firebase-parent-1',
        canAccessApp: true,
        invitationStatus: 'accepted',
      }),
    );
    expect(usersDoc.set).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'parent', parentAccountId: 'parent-1' }),
      { merge: true },
    );
    expect(firebaseAuthMock.createCustomToken).toHaveBeenCalledWith(
      'firebase-parent-1',
      { role: 'parent' },
    );
    expect(result).toEqual({
      parentId: 'parent-1',
      patientIds: ['patient-1'],
      patient: {
        id: 'patient-1',
        displayName: 'Danny',
        age: 7,
        avatarUrl: null,
      },
      token: 'custom-token',
      role: 'parent',
    });
  });

  it('converges on the shared uid when a concurrent accept already created the auth user', async () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60);
    const invitationDoc = createDoc('invitation-1');
    const invitationData = {
      id: 'invitation-1',
      parentId: 'parent-1',
      patientId: 'patient-1',
      therapistId: 'therapist-1',
      tokenHash: 'f0f0f0',
      status: 'pending',
      expiresAt: futureDate,
      createdAt: new Date(),
      acceptedAt: null,
    };
    const invitationSnapshot = {
      data: () => invitationData,
      ref: invitationDoc,
      exists: true,
    };

    const parentRef = createDoc('parent-1');
    const parentData = {
      id: 'parent-1',
      therapistId: 'therapist-1',
      patientIds: ['patient-1'],
      canAccessApp: false,
      invitationStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      firebaseUid: null,
      fullName: 'Linda Doe',
      email: 'mom@example.com',
      phone: null,
      relationship: 'mother',
    };
    parentRef.get.mockResolvedValue(createSnapshot(parentData));

    const patientData = {
      id: 'patient-1',
      displayName: 'Danny',
      age: 7,
      avatarUrl: null,
    };
    const patientRef = createDoc('patient-1');
    const usersDoc = createDoc('shared-uid');

    firestoreMock.collection.mockImplementation((name: string) => {
      if (name === 'parentInvitations') {
        return {
          where: jest.fn(() => ({
            limit: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({
                empty: false,
                docs: [invitationSnapshot],
              }),
            }),
          })),
        };
      }
      if (name === 'parentAccounts') return { doc: jest.fn(() => parentRef) };
      if (name === 'patients') return { doc: jest.fn(() => patientRef) };
      if (name === 'users') return { doc: jest.fn(() => usersDoc) };
      return { doc: jest.fn() };
    });

    // Race: no user on first lookup, createUser loses the race, second lookup
    // finds the winner's user -> both converge on the same shared uid.
    firebaseAuthMock.getUserByEmail
      .mockRejectedValueOnce({ code: 'auth/user-not-found' })
      .mockResolvedValueOnce({ uid: 'shared-uid' });
    firebaseAuthMock.createUser.mockRejectedValue({
      code: 'auth/email-already-exists',
    });

    transactionMock.get
      .mockResolvedValueOnce(invitationSnapshot)
      .mockResolvedValueOnce(createSnapshot(parentData))
      .mockResolvedValueOnce(createSnapshot(patientData));

    const dto = new AcceptParentInvitationDto();
    dto.token = 'raw-token';

    const result = await service.acceptInvitation(dto);

    expect(firebaseAuthMock.createUser).toHaveBeenCalled();
    expect(firebaseAuthMock.getUserByEmail).toHaveBeenCalledTimes(2);
    expect(transactionMock.update).toHaveBeenCalledWith(
      parentRef,
      expect.objectContaining({ firebaseUid: 'shared-uid' }),
    );
    expect(firebaseAuthMock.createCustomToken).toHaveBeenCalledWith(
      'shared-uid',
      { role: 'parent' },
    );
    expect(result.token).toBe('custom-token');
  });
});
