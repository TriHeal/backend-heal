import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class GenerateOtpDto {
  @ApiProperty({ example: 'abc123patientId' })
  @IsString()
  @MinLength(1)
  patientId: string;
}
