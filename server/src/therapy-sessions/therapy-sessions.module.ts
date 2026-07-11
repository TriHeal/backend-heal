import { Module } from '@nestjs/common';
import { TherapySessionsController } from './therapy-sessions.controller';
import { TherapySessionsService } from './therapy-sessions.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
imports: [AuthModule],
  controllers: [TherapySessionsController],
  providers: [TherapySessionsService],
})
export class TherapySessionsModule {}