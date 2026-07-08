import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { Roles } from './roles.decorator';
import { Role } from './role.enum';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('credentials')
  @UseGuards(FirebaseAuthGuard)
  @Roles(Role.Therapist)
  createCredential(@Body() dto: CreateCredentialDto) {
    return this.authService.createCredential(dto);
  }
}
