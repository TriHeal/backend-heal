import {
  BadRequestException,
  HttpException,
  Injectable,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { FIRESTORE } from '../firebase/firebase.constants';
import { CreateParentAccountDto } from './dto/create-parent-account.dto';
import { AcceptParentInvitationDto } from './dto/accept-parent-invitation.dto';
import { ParentEmailService } from './parent-email.service';
import { ParentAccount } from './entities/parent-account.entity';
import { ParentInvitation } from './entities/parent-invitation.entity';
import { Patient } from '../patients/entities/patient.entity';

export interface AcceptParentInvitationResult {
  parentId: string;
  patientIds: string[];
  patient: Pick<Patient, 'id' | 'displayName' | 'age' | 'avatarUrl'>;
}

export interface CreateParentAccountResult {
  parent: ParentAccount;
  emailSent: boolean;
  invitationFailed: boolean;
}

import { UpdateParentAccountDto } from './dto/update-parent-account.dto';

@Injectable()
export class ParentAccountsService {
  private readonly logger = new Logger(ParentAccountsService.name);

  constructor(
    @Inject(FIRESTORE) private readonly firestore: Firestore,
    private readonly emailService: ParentEmailService,
  ) {}

  async create(
    dto: CreateParentAccountDto,
    therapistId: string,
  ): Promise<CreateParentAccountResult> {
    const parentRef = this.firestore.collection('parentAccounts').doc();
    const patientRef = this.firestore.collection('patients').doc(dto.patientId);
    const invitationRef = dto.requestAppAccess
      ? this.firestore.collection('parentInvitations').doc()
      : null;
    const now = new Date();
    let rawToken: string | null = null;

    const parentAccount: ParentAccount = {
      id: parentRef.id,
      therapistId,
      firebaseUid: null,
      fullName: dto.fullName,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      relationship: dto.relationship,
      canAccessApp: false,
      patientIds: [dto.patientId],
      invitationStatus: dto.requestAppAccess ? 'pending' : 'not_requested',
      createdAt: now,
      updatedAt: now,
    };

    await this.firestore.runTransaction(async (transaction) => {
      const patientSnapshot = await transaction.get(patientRef);

      if (!patientSnapshot.exists) {
        throw new NotFoundException('Patient not found');
      }

      const patient = patientSnapshot.data() as Patient;

      if (patient.therapistId !== therapistId) {
        throw new NotFoundException('Patient not found');
      }

      const updatedPatient: Patient = {
        ...patient,
        parentIds: Array.from(
          new Set([...(patient.parentIds ?? []), parentRef.id]),
        ),
        updatedAt: now,
      };

      transaction.set(parentRef, parentAccount);
      transaction.set(patientRef, updatedPatient);

      if (dto.requestAppAccess && invitationRef) {
        rawToken = this.generateToken();
        const tokenHash = this.hashToken(rawToken);
        const invitation: ParentInvitation = {
          id: invitationRef.id,
          parentId: parentRef.id,
          patientId: dto.patientId,
          therapistId,
          tokenHash,
          status: 'pending',
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          createdAt: now,
          acceptedAt: null,
        };

        transaction.set(invitationRef, invitation);
      }
    });

    if (!dto.requestAppAccess || !rawToken) {
      return {
        parent: parentAccount,
        emailSent: false,
        invitationFailed: false,
      };
    }

    try {
      const baseUrl = process.env.PARENT_INVITE_BASE_URL;
      if (!baseUrl) {
        throw new Error('PARENT_INVITE_BASE_URL is not configured');
      }

      const inviteUrl = `${baseUrl}/parent/activate?token=${encodeURIComponent(
        rawToken,
      )}`;

      await this.emailService.sendParentInvitationEmail({
        to: dto.email as string,
        parentFullName: dto.fullName,
        patientName: await this.loadPatientDisplayName(dto.patientId),
        inviteUrl,
      });

      return {
        parent: parentAccount,
        emailSent: true,
        invitationFailed: false,
      };
    } catch (error) {
      const updatedAt = new Date();
      const failedParentAccount: ParentAccount = {
        ...parentAccount,
        invitationStatus: 'failed',
        updatedAt,
      };

      try {
        await this.firestore
          .collection('parentAccounts')
          .doc(parentAccount.id)
          .update({
            invitationStatus: 'failed',
            updatedAt,
          });
      } catch (updateError) {
        this.logger.error(
          'Failed to mark parent account invitation as failed',
          updateError instanceof Error
            ? updateError.message
            : String(updateError),
        );
      }

      this.logger.error(
        'Failed to send parent invitation email',
        error instanceof Error ? error.message : String(error),
      );

      return {
        parent: failedParentAccount,
        emailSent: false,
        invitationFailed: true,
      };
    }
  }

  async findAllByPatient(
    patientId: string,
    therapistId: string,
  ): Promise<ParentAccount[]> {
    const patientSnapshot = await this.firestore
      .collection('patients')
      .doc(patientId)
      .get();

    if (!patientSnapshot.exists) {
      throw new NotFoundException('Patient not found');
    }

    const patient = patientSnapshot.data() as Patient;

    if (patient.therapistId !== therapistId) {
      throw new NotFoundException('Patient not found');
    }

    const parentSnapshot = await this.firestore
      .collection('parentAccounts')
      .where('therapistId', '==', therapistId)
      .where('patientIds', 'array-contains', patientId)
      .get();

    return parentSnapshot.docs.map(
      (document) => document.data() as ParentAccount,
    );
  }

  async update(
    parentId: string,
    dto: UpdateParentAccountDto,
    therapistId: string,
  ): Promise<ParentAccount> {
    const parentRef = this.firestore.collection('parentAccounts').doc(parentId);

    const parentSnapshot = await parentRef.get();

    if (!parentSnapshot.exists) {
      throw new NotFoundException('Parent not found');
    }

    const parent = parentSnapshot.data() as ParentAccount;

    if (parent.therapistId !== therapistId) {
      throw new NotFoundException('Parent not found');
    }

    const updatedParent: ParentAccount = {
      ...parent,
      ...(dto.fullName !== undefined && { fullName: dto.fullName }),
      ...(dto.relationship !== undefined && {
        relationship: dto.relationship,
      }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      updatedAt: new Date(),
    };

    await parentRef.set(updatedParent);

    return updatedParent;
  }

  async resendInvitation(
  parentId: string,
  therapistId: string,
): Promise<{ emailSent: true }> {
  const parentRef = this.firestore
    .collection('parentAccounts')
    .doc(parentId);

  const parentSnapshot = await parentRef.get();

  if (!parentSnapshot.exists) {
    throw new NotFoundException('Parent not found');
  }

  const parent = parentSnapshot.data() as ParentAccount;

  if (parent.therapistId !== therapistId) {
    throw new NotFoundException('Parent not found');
  }

  if (!parent.email) {
    throw new BadRequestException('Parent email is required');
  }

  if (parent.canAccessApp) {
    throw new BadRequestException('Parent already has app access');
  }

  const patientId = parent.patientIds[0];

  if (!patientId) {
    throw new NotFoundException('Connected patient not found');
  }

  const invitationRef = this.firestore
    .collection('parentInvitations')
    .doc();

  const rawToken = this.generateToken();
  const now = new Date();

  const invitation: ParentInvitation = {
    id: invitationRef.id,
    parentId: parent.id,
    patientId,
    therapistId,
    tokenHash: this.hashToken(rawToken),
    status: 'pending',
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    createdAt: now,
    acceptedAt: null,
  };

    await invitationRef.set(invitation);

    const baseUrl = process.env.PARENT_INVITE_BASE_URL;

    if (!baseUrl) {
      throw new HttpException(
        'PARENT_INVITE_BASE_URL is not configured',
        500,
      );
    }

    const inviteUrl =
      `${baseUrl}/parent/activate?token=${encodeURIComponent(rawToken)}`;

    try {
      await this.emailService.sendParentInvitationEmail({
        to: parent.email,
        parentFullName: parent.fullName,
        patientName: await this.loadPatientDisplayName(patientId),
        inviteUrl,
      });

      await parentRef.update({
        invitationStatus: 'pending',
        updatedAt: now,
      });

      return { emailSent: true };
    } catch (error) {
      await parentRef.update({
        invitationStatus: 'failed',
        updatedAt: new Date(),
      });

      this.logger.error(
        'Failed to resend parent invitation email',
        error instanceof Error ? error.message : String(error),
      );

      throw new HttpException(
        'Parent invitation could not be sent',
        500,
      );
    }
  }

  async acceptInvitation(
    dto: AcceptParentInvitationDto,
  ): Promise<AcceptParentInvitationResult> {
    const tokenHash = this.hashToken(dto.token);

    const invitationsQuery = await this.firestore
      .collection('parentInvitations')
      .where('tokenHash', '==', tokenHash)
      .limit(1)
      .get();

    if (invitationsQuery.empty) {
      throw new BadRequestException('Invalid or expired token');
    }

    const invitationRef = invitationsQuery.docs[0].ref;

    const result = await this.firestore.runTransaction(async (transaction) => {
      const invitationSnapshot = await transaction.get(invitationRef);

      if (!invitationSnapshot.exists) {
        throw new BadRequestException('Invalid or expired token');
      }

      const invitation = invitationSnapshot.data() as ParentInvitation;
      const now = new Date();
      const expiresAt = this.extractDate(invitation.expiresAt);

      if (invitation.status !== 'pending') {
        throw new BadRequestException('Invalid or expired token');
      }

      if (expiresAt <= now) {
        transaction.update(invitationRef, {
          status: 'expired',
        });

        return null;
      }

      const parentRef = this.firestore
        .collection('parentAccounts')
        .doc(invitation.parentId);

      const parentSnapshot = await transaction.get(parentRef);

      if (!parentSnapshot.exists) {
        throw new NotFoundException('Parent not found');
      }

      const parent = parentSnapshot.data() as ParentAccount;

      const patientId = parent.patientIds[0];

      if (!patientId) {
        throw new NotFoundException('Connected patient not found');
      }

      const patientRef = this.firestore.collection('patients').doc(patientId);
      const patientSnapshot = await transaction.get(patientRef);

      if (!patientSnapshot.exists) {
        throw new NotFoundException('Connected patient not found');
      }

      const patient = patientSnapshot.data() as Patient;

      transaction.update(invitationRef, {
        status: 'accepted',
        acceptedAt: now,
      });

      transaction.update(parentRef, {
        canAccessApp: true,
        invitationStatus: 'accepted',
        updatedAt: now,
      });

      return {
        parentId: parent.id,
        patientIds: parent.patientIds,
        patient: {
          id: patient.id,
          displayName: patient.displayName,
          age: patient.age,
          avatarUrl: patient.avatarUrl,
        },
      };
    });

    if (!result) {
      throw new BadRequestException('Invalid or expired token');
    }

    return result;
  }

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private extractDate(value: unknown): Date {
    if (value instanceof Date) {
      return value;
    }

    if (
      value &&
      typeof value === 'object' &&
      typeof (value as any).toDate === 'function'
    ) {
      return (value as any).toDate();
    }

    return new Date(value as string);
  }

  private async loadPatientDisplayName(patientId: string): Promise<string> {
    const snapshot = await this.firestore
      .collection('patients')
      .doc(patientId)
      .get();

    if (!snapshot.exists) {
      throw new HttpException('Patient data unavailable', 500);
    }

    const patient = snapshot.data() as Patient;
    return patient.displayName;
  }
}
