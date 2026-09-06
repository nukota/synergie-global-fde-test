import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class AllBookingsQueryDto {
  @ApiPropertyOptional({ example: '2026-09-08', format: 'date', description: 'Optional start-date filter.' })
  @IsOptional()
  @IsDateString({ strict: true })
  date?: string;
}
