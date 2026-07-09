import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: '123456789',
    description: 'Israeli T.Z / ID number',
  })
  @IsString()
  @IsNotEmpty()
  israeliId: string;

  @ApiProperty({
    example: 'test1234!',
    description: 'Password stored in Firebase Auth',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}