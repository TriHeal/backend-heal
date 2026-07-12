import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { FirebaseModule } from './firebase/firebase.module';
import { AuthModule } from './auth/auth.module';
import { OtpModule } from './auth/otp/otp.module';
import { PatientsModule } from './patients/patients.module';
import { HealthController } from './health/health.controller';
import { TherapySessionsModule } from './therapy-sessions/therapy-sessions.module';
import { RocksBreakFlowModule } from './rocks-break-flow/rocks-break-flow.module';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 60 }],
    }),
    FirebaseModule,
    AuthModule,
    OtpModule,
    PatientsModule,
    TherapySessionsModule,
    RocksBreakFlowModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
