import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTherapySessionDto {
  @ApiProperty({
    example: 'patient_123',
    description: 'Patient ID for the live therapy session',
  })
  @IsString()
  @IsNotEmpty()
  patientId: string;
}