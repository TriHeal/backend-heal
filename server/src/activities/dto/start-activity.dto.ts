import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ActivityType } from '../activity-type.enum';
import { ActivityCategory } from '../entities/activity.entity';

export class StartActivityDto {
  @ApiProperty({ enum: ActivityType })
  @IsEnum(ActivityType)
  activityType: ActivityType;

  @ApiProperty({ enum: ActivityCategory })
  @IsEnum(ActivityCategory)
  activityCategory: ActivityCategory;
}