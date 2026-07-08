import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';
import { Role } from '../role.enum';

export class CreateCredentialDto {
  @ApiProperty({ example: 'demo-parent-1' })
  @IsString()
  @MinLength(1)
  id: string;

  @ApiProperty({ example: 'a-strong-password', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: Role, example: Role.Parent })
  @IsIn([Role.Therapist, Role.Parent, Role.Child])
  role: Role;
}
