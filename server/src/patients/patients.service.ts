import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import { FIRESTORE } from '../firebase/firebase.constants';
import { CreatePatientDto } from './dto/create-patient.dto';
import { Patient } from './entities/patient.entity';

@Injectable()
export class PatientsService {
  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore) {}

  async create(dto: CreatePatientDto, therapistId: string) {
    const patientRef = this.firestore.collection('patients').doc();

    const patient: Patient= {
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

  async findAllByTherapist(therapistId: string) : Promise<Patient[]> {
    const snapshot = await this.firestore
      .collection('patients')
      .where('therapistId', '==', therapistId)
      .get();

    return snapshot.docs.map((doc) => doc.data() as Patient);
  }

  async findOne(patientId: string, therapistId: string) : Promise<Patient> {
    const doc = await this.firestore.collection('patients').doc(patientId).get();

    if (!doc.exists) {
      throw new NotFoundException('Patient not found');
    }

    const patient = doc.data() as Patient;

    if (patient?.therapistId !== therapistId) {
      throw new NotFoundException('Patient not found');
    }

    return patient;
  }
}