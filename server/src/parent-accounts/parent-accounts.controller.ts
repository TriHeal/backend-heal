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
import { ParentAccountsService } from './parent-accounts.service';
import { CreateParentAccountDto } from './dto/create-parent-account.dto';
import { AuthenticatedUser } from '../auth/auth.service';

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
}
