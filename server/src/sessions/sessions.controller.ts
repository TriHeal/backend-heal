import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { AuthenticatedUser } from '../auth/auth.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SessionsService } from './sessions.service';
import { Roles } from 'src/auth/roles.decorator';
import { Role } from 'src/auth/role.enum';

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-id-token')
  @ApiOperation({ summary: 'Create a live therapy session' })
  create(
    @Body() dto: CreateSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessionsService.create(dto, user.uid);
  }

  @Get()
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-id-token')
  @ApiOperation({ summary: 'Get all sessions for theraphist' })
  findAllForTherapist(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessionsService.findAllForTherapist(user.uid);
  }

  @Get(':id')
  @UseGuards(FirebaseAuthGuard)
  @Roles(Role.Therapist)
  @ApiBearerAuth('firebase-id-token')
  @ApiOperation({ summary: 'Get one session by ID for authenticated therapist' })
  findOne(
    @Param('id') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessionsService.findOne(sessionId, user.uid);
  }
}