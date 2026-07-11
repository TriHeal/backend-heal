import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';
import { CurrentUser } from '../auth/current-user.decorator';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { AuthenticatedUser } from 'src/auth/auth.service';

@ApiTags('patients')
@ApiBearerAuth('firebase-id-token')
@Controller('patients')
@UseGuards(FirebaseAuthGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @Roles(Role.Therapist)
  @ApiOperation({
    summary: 'Create a patient (therapist-only)',
    description:
      'therapistId is derived from the authenticated token, not taken from the request body.',
  })
  create(
    @Body() dto: CreatePatientDto,
    @CurrentUser() user: { uid: string; role: Role },
  ) {
    return this.patientsService.create(dto, user.uid);
  }

  @Get()
  @Roles(Role.Therapist)
  @ApiOperation({
    summary: 'Get all paints for therapist(therapist-only)',
    description:
      'therapistId is derived from the authenticated token, not taken from the request body.',
  })
  findAllForTherapist( @CurrentUser() user: AuthenticatedUser
  ) {
    return this.patientsService.findAllByTherapist(user.uid);
  }

  @Get(':id')
  @Roles(Role.Therapist)
  @ApiOperation({ summary: 'Get one patient by ID for authenticated therapist' })
  findOne(
    @Param('id') patientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patientsService.findOne(patientId, user.uid);
  }
}
