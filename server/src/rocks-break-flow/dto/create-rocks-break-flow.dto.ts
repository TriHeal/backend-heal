import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsNotEmpty, IsString } from 'class-validator';

export class CreateRocksBreakFlowDto {
  @ApiProperty({
    example: 'The rock of self-doubt',
    description: 'Title of the rock-break event',
  })
  @IsString()
  @IsNotEmpty()
  eventTitle: string;

  @ApiProperty({
    example: ['I always mess this up', 'No one believes in me'],
    description: 'The automatic/negative thoughts the child had',
    type: [String],
  })
  @IsString({ each: true })
  @ArrayNotEmpty()
  thoughts: string[];

  @ApiProperty({
    example: ['I made a mistake, but I can fix it', 'My friends support me'],
    description: 'The reframed, reality-based facts',
    type: [String],
  })
  @IsString({ each: true })
  @ArrayNotEmpty()
  facts: string[];
}
