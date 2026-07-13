import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ActivityType } from '../../activities/activity-type.enum';

export class CreateTherapySessionActivityDto {
  @ApiProperty({
    enum: ActivityType,
    example: ActivityType.Breathing,
    description: 'Selected activity type for this therapy session',
  })
  @IsEnum(ActivityType)
  type: ActivityType;

  @ApiProperty({
    example: 1,
    description: 'Activity order inside the therapy session',
  })
  @IsInt()
  @Min(1)
  order: number;
}

export class CreateTherapySessionDto {
  @ApiProperty({
    example: 'patient_123',
    description: 'Patient ID for the live therapy session',
  })
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @ApiPropertyOptional({
    type: [CreateTherapySessionActivityDto],
    description: 'Activities selected by the therapist for this session',
    example: [
      { type: ActivityType.Breathing, order: 1 },
      { type: ActivityType.EventProcessing, order: 2 },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTherapySessionActivityDto)
  activities?: CreateTherapySessionActivityDto[];
}