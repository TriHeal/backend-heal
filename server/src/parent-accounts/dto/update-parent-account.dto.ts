import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ParentRelationship } from '../entities/parent-account.entity';

export class UpdateParentAccountDto {
  @ApiPropertyOptional({ example: 'Linda Doe' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  @ApiPropertyOptional({
    enum: ['mother', 'father', 'guardian', 'other'],
    example: 'mother',
  })
  @IsOptional()
  @IsIn(['mother', 'father', 'guardian', 'other'])
  relationship?: ParentRelationship;

  @ApiPropertyOptional({
    example: 'parent@example.com',
    nullable: true,
  })
  @ValidateIf((dto) => dto.email !== undefined && dto.email !== null)
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({
    example: '+972501234567',
    nullable: true,
  })
  @ValidateIf((dto) => dto.phone !== undefined && dto.phone !== null)
  @IsString()
  phone?: string | null;
}
