import {
  BadRequestException,
  HttpException,
  Injectable,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { FIREBASE_AUTH, FIRESTORE } from '../firebase/firebase.constants';
import { Role } from '../auth/role.enum';
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
  token: string;
  role: Role;
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
    @Inject(FIREBASE_AUTH) private readonly firebaseAuth: Auth,
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

      this.logDevInviteUrl(dto.email, inviteUrl);

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
    const parentRef = this.firestore.collection('parentAccounts').doc(parentId);

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

    const invitationRef = this.firestore.collection('parentInvitations').doc();

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
      throw new HttpException('PARENT_INVITE_BASE_URL is not configured', 500);
    }

    const inviteUrl = `${baseUrl}/parent/activate?token=${encodeURIComponent(rawToken)}`;

    this.logDevInviteUrl(parent.email, inviteUrl);

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

      throw new HttpException('Parent invitation could not be sent', 500);
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
    const invitation = invitationsQuery.docs[0].data() as ParentInvitation;

    // Cheap pre-checks so we don't provision a Firebase identity for an
    // obviously invalid token. The transaction below re-validates against races.
    if (invitation.status !== 'pending') {
      throw new BadRequestException('Invalid or expired token');
    }

    if (this.extractDate(invitation.expiresAt) <= new Date()) {
      await invitationRef.update({ status: 'expired' });
      throw new BadRequestException('Invalid or expired token');
    }

    const parentRef = this.firestore
      .collection('parentAccounts')
      .doc(invitation.parentId);
    const parentSnapshot = await parentRef.get();

    if (!parentSnapshot.exists) {
      throw new NotFoundException('Parent not found');
    }

    // Firebase Auth calls cannot run inside a Firestore transaction, so resolve
    // the parent's uid up front. It is reused across a parent's multiple
    // children so they share a single Firebase identity.
    const firebaseUid = await this.resolveParentFirebaseUid(
      parentSnapshot.data() as ParentAccount,
    );

    // Provision the login BEFORE the invitation is consumed. Both steps are
    // idempotent, so if either fails the invitation stays 'pending' and the
    // client can safely retry — rather than bricking a half-provisioned parent
    // (invitation consumed but no users/{uid} doc / no token ever issued).
    await this.firestore.collection('users').doc(firebaseUid).set(
      {
        role: Role.Parent,
        parentAccountId: invitation.parentId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const token = await this.firebaseAuth.createCustomToken(firebaseUid, {
      role: Role.Parent,
    });

    const result = await this.firestore.runTransaction(async (transaction) => {
      const invitationSnapshot = await transaction.get(invitationRef);

      if (!invitationSnapshot.exists) {
        throw new BadRequestException('Invalid or expired token');
      }

      const currentInvitation = invitationSnapshot.data() as ParentInvitation;
      const now = new Date();
      const expiresAt = this.extractDate(currentInvitation.expiresAt);

      if (currentInvitation.status !== 'pending') {
        throw new BadRequestException('Invalid or expired token');
      }

      if (expiresAt <= now) {
        transaction.update(invitationRef, {
          status: 'expired',
        });

        return null;
      }

      const currentParentSnapshot = await transaction.get(parentRef);

      if (!currentParentSnapshot.exists) {
        throw new NotFoundException('Parent not found');
      }

      const parent = currentParentSnapshot.data() as ParentAccount;

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
        firebaseUid,
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

    return {
      ...result,
      token,
      role: Role.Parent,
    };
  }

  /**
   * Resolve (and if needed provision) the Firebase Auth uid for a parent.
   * Deduped by email so one real parent shares a single uid across all their
   * parentAccount docs — which is what lets uid -> patients resolution find
   * every child.
   */
  private async resolveParentFirebaseUid(
    parent: ParentAccount,
  ): Promise<string> {
    if (parent.firebaseUid) {
      return parent.firebaseUid;
    }

    if (parent.email) {
      try {
        const existing = await this.firebaseAuth.getUserByEmail(parent.email);
        return existing.uid;
      } catch (error) {
        if ((error as { code?: string }).code !== 'auth/user-not-found') {
          throw error;
        }
      }

      // No user yet — create one, but tolerate a concurrent acceptance that
      // wins the race (e.g. two of this parent's children accepted at once):
      // fall back to the now-existing user so both converge on one shared uid
      // instead of surfacing an unhandled auth/email-already-exists (500).
      try {
        const created = await this.firebaseAuth.createUser({
          email: parent.email,
        });
        return created.uid;
      } catch (error) {
        if ((error as { code?: string }).code === 'auth/email-already-exists') {
          const existing = await this.firebaseAuth.getUserByEmail(parent.email);
          return existing.uid;
        }
        throw error;
      }
    }

    const created = await this.firebaseAuth.createUser({});
    return created.uid;
  }

  /**
   * All patient ids linked to a logged-in parent, resolved via
   * parentAccounts.firebaseUid (a parent may have several parentAccount docs,
   * one per child, all sharing the same uid).
   */
  async findPatientIdsForParentUid(parentUid: string): Promise<string[]> {
    const snapshot = await this.firestore
      .collection('parentAccounts')
      .where('firebaseUid', '==', parentUid)
      .get();

    const patientIds = new Set<string>();
    for (const doc of snapshot.docs) {
      const parent = doc.data() as ParentAccount;
      for (const patientId of parent.patientIds ?? []) {
        patientIds.add(patientId);
      }
    }

    return Array.from(patientIds);
  }

  /**
   * Throw unless the logged-in parent owns the given patient. Returns
   * NotFound (not Forbidden) to avoid leaking which patient ids exist,
   * mirroring the therapist ownership checks elsewhere.
   */
  async assertParentOwnsPatient(
    parentUid: string,
    patientId: string,
  ): Promise<void> {
    const patientIds = await this.findPatientIdsForParentUid(parentUid);

    if (!patientIds.includes(patientId)) {
      throw new NotFoundException('Patient not found');
    }
  }

  // Dev-only convenience: surface the raw invite link (which is otherwise only
  // sent by email) in the server logs so the flow can be tested without Resend.
  // Silent in production (Render sets NODE_ENV=production).
  private logDevInviteUrl(
    email: string | null | undefined,
    inviteUrl: string,
  ): void {
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(
        `[dev] Parent invite link for ${email ?? 'parent'}: ${inviteUrl}`,
      );
    }
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
