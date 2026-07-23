import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { WatchChildSessionDto } from './dto/watch-child-session.dto';
import { ParentSessionsService } from './parent-sessions.service';

@ApiTags('parent-sessions')
@ApiBearerAuth('firebase-id-token')
@Controller('parent/sessions')
@UseGuards(FirebaseAuthGuard)
export class ParentSessionsController {
  constructor(private readonly parentSessionsService: ParentSessionsService) {}

  @Post('watch')
  @Roles(Role.Parent)
  @ApiOperation({
    summary:
      "Bind the parent to a specific child's active session (parent-only)",
    description:
      "Verifies the authenticated parent owns the given child (patientId), resolves that child's active therapy session, registers the parent as a live participant, and returns the RTDB path to subscribe to. The child is taken from the request body so a parent with multiple children binds to the right one.",
  })
  @ApiResponse({ status: 201, description: 'Parent bound to the live session' })
  watch(
    @Body() dto: WatchChildSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parentSessionsService.watchChildSession(
      user.uid,
      dto.patientId,
    );
  }
}
