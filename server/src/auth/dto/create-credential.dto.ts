import { IsIn, IsString, MinLength } from 'class-validator';
import { Role } from '../role.enum';

export class CreateCredentialDto {
  @IsString()
  @MinLength(1)
  id: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsIn([Role.Therapist, Role.Parent, Role.Child])
  role: Role;
}
