import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import { FIRESTORE } from '../firebase/firebase.constants';
import { CreatePatientDto } from './dto/create-patient.dto';

@Injectable()
export class PatientsService {
  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore) {}

  async create(dto: CreatePatientDto, therapistId: string) {
    const patientRef = this.firestore.collection('patients').doc();

    const patient = {
      id: patientRef.id,
      therapistId,
      displayName: dto.displayName,
      age: dto.age,
      avatarUrl: dto.avatarUrl ?? null,
      status: 'active',
      parentIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await patientRef.set(patient);

    return patient;
  }

  async findAllByTherapist(therapistId: string) {
    const snapshot = await this.firestore
      .collection('patients')
      .where('therapistId', '==', therapistId)
      .get();

    return snapshot.docs.map((doc) => doc.data());
  }

  async findOne(patientId: string, therapistId: string) {
    const doc = await this.firestore.collection('patients').doc(patientId).get();

    if (!doc.exists) {
      throw new NotFoundException('Patient not found');
    }

    const patient = doc.data();

    if (patient?.therapistId !== therapistId) {
      throw new NotFoundException('Patient not found');
    }

    return patient;
  }
}