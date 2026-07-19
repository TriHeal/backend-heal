import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import type { PatientSex } from '../entities/patient.entity';

export class CreatePatientDto {
  @ApiProperty({ example: 'Daniel' })
  @IsString()
  @MinLength(1)
  displayName: string;

  @ApiProperty({ example: 8, minimum: 0 })
  @IsInt()
  @Min(0)
  age: number;

  @ApiProperty({
    enum: ['male', 'female', 'unspecified'],
    example: 'male',
  })
  @IsIn(['male', 'female', 'unspecified'])
  sex: PatientSex;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  parentSharingEnabled?: boolean;
}