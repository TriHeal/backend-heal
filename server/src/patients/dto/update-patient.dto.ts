import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import type {
  PatientSex,
  PatientStatus,
} from '../entities/patient.entity';

export class UpdatePatientDto {
  @ApiPropertyOptional({ example: 'Daniel' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  displayName?: string;

  @ApiPropertyOptional({ example: 8, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  age?: number;

  @ApiPropertyOptional({
    enum: ['male', 'female', 'unspecified'],
  })
  @IsOptional()
  @IsIn(['male', 'female', 'unspecified'])
  sex?: PatientSex;

  @ApiPropertyOptional({
    enum: ['active', 'paused', 'completed'],
  })
  @IsOptional()
  @IsIn(['active', 'paused', 'completed'])
  status?: PatientStatus;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  parentSharingEnabled?: boolean;
}