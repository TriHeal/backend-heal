import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';
import { ActivitiesService } from './activities.service';

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
}
