import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AcceptParentInvitationDto {
  @ApiProperty({ example: 'b1d2c3token' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
