import { Inject, Injectable } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { FIRESTORE } from '../firebase/firebase.constants';
import { CreatePatientDto } from './dto/create-patient.dto';

@Injectable()
export class PatientsService {
  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore) {}

  async create(
    dto: CreatePatientDto,
    therapistUid: string,
  ): Promise<{ patientId: string }> {
    const now = FieldValue.serverTimestamp();

    const patientRef = await this.firestore.collection('patients').add({
      therapistId: therapistUid,
      displayName: dto.displayName,
      age: dto.age,
      avatarUrl: dto.avatarUrl ?? null,
      status: 'active',
      enrolledAt: now,
      createdAt: now,
      updatedAt: now,
      parents: [],
      childUid: null,
    });

    return { patientId: patientRef.id };
  }
}
