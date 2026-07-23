import { Module } from '@nestjs/common';
import { AuthModule } from '../auth.module';
import { ParentAccountsModule } from '../../parent-accounts/parent-accounts.module';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';

@Module({
  imports: [AuthModule, ParentAccountsModule],
  controllers: [OtpController],
  providers: [OtpService],
})
export class OtpModule {}
