import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ParentAccountsService } from './parent-accounts.service';
import { AcceptParentInvitationDto } from './dto/accept-parent-invitation.dto';

@ApiTags('parent-invitations')
@Controller('parent-invitations')
export class ParentInvitationsController {
  constructor(private readonly parentAccountsService: ParentAccountsService) {}

  @Post('accept')
  @ApiOperation({ summary: 'Accept a parent invitation token' })
  @ApiResponse({ status: 200, description: 'Parent invitation accepted' })
  accept(@Body() dto: AcceptParentInvitationDto) {
    return this.parentAccountsService.acceptInvitation(dto);
  }
}
