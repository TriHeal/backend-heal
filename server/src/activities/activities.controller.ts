import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { StartActivityDto } from './dto/start-activity.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from 'src/auth/firebase-auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { Role } from 'src/auth/role.enum';
import { ActivitiesService } from './activities.service';
import { StopActivityDto } from './dto/stop-activity.dto';

@ApiTags('activities')
@ApiBearerAuth('firebase-id-token')
@Controller('activities')
@UseGuards(FirebaseAuthGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get('catalog')
  @Roles(Role.Therapist)
  @ApiOperation({
    summary: 'Get available therapeutic activities catalog',
  })
  findCatalog() {
    return this.activitiesService.findCatalog();
  }

  @Post('sessions/:sessionId/start')
  @Roles(Role.Therapist)
  @ApiOperation({ summary: 'Start an activity in a live therapy session' })
  start(
    @Param('sessionId') sessionId: string,
    @Body() dto: StartActivityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.activitiesService.start(sessionId, dto, user.uid);
  }

  @Post('sessions/:sessionId/stop')
  @Roles(Role.Therapist)
  @ApiOperation({ summary: 'Stop the currently active activity' })
  stop(
    @Param('sessionId') sessionId: string,
    @Body() dto: StopActivityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.activitiesService.stop(sessionId, dto, user.uid);
  }
}
