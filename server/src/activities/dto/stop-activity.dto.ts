import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, Min } from 'class-validator';

export class StopActivityDto {
  @ApiPropertyOptional({
    description: 'Final activity-specific data to persist',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Number of interruptions during the activity',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  interruptionCount?: number;
}
