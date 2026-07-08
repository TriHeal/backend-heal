import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { Roles } from './roles.decorator';
import { Role } from './role.enum';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Log in with a custom ID + password',
    description:
      'Returns a Firebase custom token. Exchange it client-side via signInWithCustomToken to get an ID token.',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('credentials')
  @UseGuards(FirebaseAuthGuard)
  @Roles(Role.Therapist)
  @ApiBearerAuth('firebase-id-token')
  @ApiOperation({ summary: 'Provision a login credential (therapist-only)' })
  createCredential(@Body() dto: CreateCredentialDto) {
    return this.authService.createCredential(dto);
  }
}
