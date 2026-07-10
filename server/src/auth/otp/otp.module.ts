import { Module } from '@nestjs/common';
import { AuthModule } from '../auth.module';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';

@Module({
  imports: [AuthModule],
  controllers: [OtpController],
  providers: [OtpService],
})
export class OtpModule {}
