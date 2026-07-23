import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ParentAccountsController } from './parent-accounts.controller';
import { ParentInvitationsController } from './parent-invitations.controller';
import { ParentSessionsController } from './parent-sessions.controller';
import { ParentAccountsService } from './parent-accounts.service';
import { ParentSessionsService } from './parent-sessions.service';
import { ParentEmailService } from './parent-email.service';

@Module({
  imports: [AuthModule],
  controllers: [
    ParentAccountsController,
    ParentInvitationsController,
    ParentSessionsController,
  ],
  providers: [ParentAccountsService, ParentSessionsService, ParentEmailService],
  exports: [ParentAccountsService],
})
export class ParentAccountsModule {}
