import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { AuthenticatedUser } from '../auth/auth.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';
import { CreateRocksBreakFlowDto } from './dto/create-rocks-break-flow.dto';
import { RocksBreakFlowService } from './rocks-break-flow.service';

@ApiTags('rocks-break-flow')
@Controller('therapy-sessions/:id/rocks-break-flow')
export class RocksBreakFlowController {
  constructor(private readonly rocksBreakFlowService: RocksBreakFlowService) {}

  @Post()
  @UseGuards(FirebaseAuthGuard)
  @Roles(Role.Therapist)
  @ApiBearerAuth('firebase-id-token')
  @ApiOperation({
    summary: 'Submit a rock-break event for a live session (therapist-only)',
    description:
      'Validates the therapist owns the session, then writes the event to the ' +
      'Realtime Database so the patient app can pick it up via a live listener.',
  })
  create(
    @Param('id') sessionId: string,
    @Body() dto: CreateRocksBreakFlowDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rocksBreakFlowService.create(sessionId, dto, user.uid);
  }
}
