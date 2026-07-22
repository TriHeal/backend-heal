import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import { ParentAccountsService } from './parent-accounts.service';
import { CreateParentAccountDto } from './dto/create-parent-account.dto';
import { AuthenticatedUser } from '../auth/auth.service';
import { UpdateParentAccountDto } from './dto/update-parent-account.dto';

@ApiTags('parent-accounts')
@ApiBearerAuth('firebase-id-token')
@Controller('parent-accounts')
@UseGuards(FirebaseAuthGuard)
export class ParentAccountsController {
  constructor(private readonly parentAccountsService: ParentAccountsService) {}

  @Post()
  @Roles(Role.Therapist)
  @ApiOperation({
    summary: 'Create a parent account and optionally invite them to the app',
  })
  @ApiResponse({ status: 201, description: 'Parent account created' })
  create(
    @Body() dto: CreateParentAccountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parentAccountsService.create(dto, user.uid);
  }

  @Get()
  @Roles(Role.Therapist)
  @ApiOperation({ summary: 'List parent accounts linked to a patient' })
  @ApiResponse({ status: 200, description: 'Parent accounts returned' })
  findAllByPatient(
    @Query('patientId') patientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parentAccountsService.findAllByPatient(patientId, user.uid);
  }

  @Patch(':id')
  @Roles(Role.Therapist)
  @ApiOperation({ summary: 'Update a parent account' })
  @ApiResponse({ status: 200, description: 'Parent account updated' })
  update(
    @Param('id') parentId: string,
    @Body() dto: UpdateParentAccountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parentAccountsService.update(parentId, dto, user.uid);
  }

  @Post(':id/resend-invitation')
  @Roles(Role.Therapist)
  @ApiOperation({ summary: 'Resend a parent app invitation' })
  @ApiResponse({ status: 200, description: 'Parent invitation resent' })
  resendInvitation(
    @Param('id') parentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parentAccountsService.resendInvitation(parentId, user.uid);
  }
}
