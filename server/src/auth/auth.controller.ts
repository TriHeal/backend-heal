import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService, AuthenticatedUser, LoginResponse } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { CurrentUser } from './current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with Israeli T.Z and Firebase password' })
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.loginWithIsraeliId(dto.israeliId, dto.password);
  }

  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-id-token')
  @ApiOperation({ summary: 'Return the authenticated user profile' })
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}