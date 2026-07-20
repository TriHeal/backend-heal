import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ParentAccountsController } from './parent-accounts.controller';
import { ParentInvitationsController } from './parent-invitations.controller';
import { ParentAccountsService } from './parent-accounts.service';
import { ParentEmailService } from './parent-email.service';

@Module({
  imports: [AuthModule],
  controllers: [ParentAccountsController, ParentInvitationsController],
  providers: [ParentAccountsService, ParentEmailService],
})
export class ParentAccountsModule {}
