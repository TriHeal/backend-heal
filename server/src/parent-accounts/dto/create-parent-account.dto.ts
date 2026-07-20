import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
  MinLength,
} from 'class-validator';
import { ParentRelationship } from '../entities/parent-account.entity';

export class CreateParentAccountDto {
  @ApiProperty({ example: 'patient-1' })
  @IsString()
  @MinLength(1)
  patientId: string;

  @ApiProperty({ example: 'Ava Johnson' })
  @IsString()
  @MinLength(1)
  fullName: string;

  @ApiProperty({
    enum: ['mother', 'father', 'guardian', 'other'],
    example: 'mother',
  })
  @IsIn(['mother', 'father', 'guardian', 'other'])
  relationship: ParentRelationship;

  @ApiPropertyOptional({ example: 'mom@example.com' })
  @ValidateIf((o) => o.requestAppAccess || o.email != null)
  @IsEmail()
  @IsNotEmpty()
  email?: string | null;

  @ApiPropertyOptional({ example: '+972501234567' })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiProperty({ example: true, default: false })
  @IsBoolean()
  requestAppAccess: boolean;
}
