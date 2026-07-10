import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OtpService } from './otp.service';
import { GenerateOtpDto } from './dto/generate-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { FirebaseAuthGuard } from '../firebase-auth.guard';
import { Roles } from '../roles.decorator';
import { Role } from '../role.enum';

@ApiTags('otp')
@Controller('auth/otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post('generate')
  @UseGuards(FirebaseAuthGuard)
  @Roles(Role.Therapist, Role.Parent)
  @ApiBearerAuth('firebase-id-token')
  @ApiOperation({
    summary: 'Generate a one-time device-connect code (parent/therapist-only)',
    description:
      'Called when a parent (from their dashboard) or therapist connects a child device. Returns a 6-digit code to display, valid for 15 minutes and single-use.',
  })
  generate(@Body() dto: GenerateOtpDto) {
    return this.otpService.generate(dto);
  }

  @Post('verify')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Verify a one-time device-connect code',
    description:
      'Called by the child device. Returns a Firebase custom token. Exchange it client-side via signInWithCustomToken to get an ID token.',
  })
  verify(@Body() dto: VerifyOtpDto) {
    return this.otpService.verify(dto);
  }
}
