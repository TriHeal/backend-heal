import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'demo-therapist-1' })
  @IsString()
  @MinLength(1)
  id: string;

  @ApiProperty({ example: 'a-strong-password' })
  @IsString()
  @MinLength(1)
  password: string;
}
