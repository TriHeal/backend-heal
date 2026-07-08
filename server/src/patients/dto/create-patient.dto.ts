import { IsInt, IsOptional, IsString, MinLength, Min } from 'class-validator';

export class CreatePatientDto {
  @IsString()
  @MinLength(1)
  displayName: string;

  @IsInt()
  @Min(0)
  age: number;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
