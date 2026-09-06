import { IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DailyBookingsQueryDto {
  @ApiProperty({ example: '2026-09-08', format: 'date' })
  @IsDateString({ strict: true })
  date: string;
}
