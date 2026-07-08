import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MinLength, Min } from 'class-validator';

export class CreatePatientDto {
  @ApiProperty({ example: 'Daniel' })
  @IsString()
  @MinLength(1)
  displayName: string;

  @ApiProperty({ example: 8, minimum: 0 })
  @IsInt()
  @Min(0)
  age: number;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
