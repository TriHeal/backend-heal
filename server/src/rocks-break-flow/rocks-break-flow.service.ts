import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import type { Database } from 'firebase-admin/database';
import { FIRESTORE, REALTIME_DB } from '../firebase/firebase.constants';
import { CreateRocksBreakFlowDto } from './dto/create-rocks-break-flow.dto';
import { RocksBreakFlow } from './entities/rocks-break-flow.entity';
import { TherapySession } from '../therapy-sessions/entities/therapy-session.entity';

@Injectable()
export class RocksBreakFlowService {
  constructor(
    @Inject(FIRESTORE)
    private readonly firestore: Firestore,

    @Inject(REALTIME_DB)
    private readonly realtimeDb: Database,
  ) {}

  async create(
    sessionId: string,
    dto: CreateRocksBreakFlowDto,
    therapistId: string,
  ): Promise<RocksBreakFlow> {
    const sessionDoc = await this.firestore
      .collection('sessions')
      .doc(sessionId)
      .get();

    if (!sessionDoc.exists) {
      throw new NotFoundException('Session not found');
    }

    const session = sessionDoc.data() as TherapySession;

    if (session.therapistId !== therapistId) {
      throw new NotFoundException('Session not found');
    }

    const event: RocksBreakFlow = {
      event_title: dto.event_title,
      think: dto.think,
      actual: dto.actual,
      sessionId,
      therapistId,
      createdAt: new Date().toISOString(),
    };

    await this.realtimeDb
      .ref(`liveSessions/${sessionId}/currentActivity`)
      .set(event);

    return event;
  }
}
