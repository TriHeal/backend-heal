import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class WatchChildSessionDto {
  @ApiProperty({
    example: 'patient-1',
    description:
      "The child (patient) to watch. Must be one of the authenticated parent's linked children.",
  })
  @IsString()
  @MinLength(1)
  patientId: string;
}
