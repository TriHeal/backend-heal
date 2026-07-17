import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { AuthenticatedUser } from '../auth/auth.service';
import { CreateTherapySessionDto } from './dto/create-therapy-session.dto';
import { TherapySessionsService } from './therapy-sessions.service';
import { Roles } from 'src/auth/roles.decorator';
import { Role } from 'src/auth/role.enum';

@ApiTags('therapy-sessions')
@Controller('therapy-sessions')
export class TherapySessionsController {
  constructor(
    private readonly therapySessionsService: TherapySessionsService,
  ) {}

  @Post()
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-id-token')
  @ApiOperation({ summary: 'Create a live therapy session' })
  create(
    @Body() dto: CreateTherapySessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.therapySessionsService.create(dto, user.uid);
  }

  @Get()
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-id-token')
  @ApiOperation({ summary: 'Get all sessions for theraphist' })
  findAllForTherapist(@CurrentUser() user: AuthenticatedUser) {
    return this.therapySessionsService.findAllForTherapist(user.uid);
  }

  @Get(':id')
  @UseGuards(FirebaseAuthGuard)
  @Roles(Role.Therapist)
  @ApiBearerAuth('firebase-id-token')
  @ApiOperation({
    summary: 'Get one session by ID for authenticated therapist',
  })
  findOne(
    @Param('id') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.therapySessionsService.findOne(sessionId, user.uid);
  }

  @Post(':sessionId/end')
  @UseGuards(FirebaseAuthGuard)
  @Roles(Role.Therapist)
  @ApiBearerAuth('firebase-id-token')
  @ApiOperation({ summary: 'End an active therapy session' })
  end(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.therapySessionsService.end(sessionId, user.uid);
  }
}
