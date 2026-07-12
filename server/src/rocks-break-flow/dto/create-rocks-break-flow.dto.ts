import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsNotEmpty, IsString } from 'class-validator';

export class CreateRocksBreakFlowDto {
  @ApiProperty({
    example: 'The rock of self-doubt',
    description: 'Title of the rock-break event',
  })
  @IsString()
  @IsNotEmpty()
  event_title: string;

  @ApiProperty({
    example: ['I always mess this up', 'No one believes in me'],
    description: 'The automatic/negative thoughts the child had',
    type: [String],
  })
  @IsString({ each: true })
  @ArrayNotEmpty()
  think: string[];

  @ApiProperty({
    example: ['I made a mistake, but I can fix it', 'My friends support me'],
    description: 'The reframed, reality-based thoughts',
    type: [String],
  })
  @IsString({ each: true })
  @ArrayNotEmpty()
  actual: string[];
}
