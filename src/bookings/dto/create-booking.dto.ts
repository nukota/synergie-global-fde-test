import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ example: 'Nguyen An' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  studentName: string;

  @ApiProperty({ example: 'tutor-014' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  tutorId: string;

  @ApiProperty({ example: 'room-2' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  roomId: string;

  @ApiProperty({ example: '2026-09-08T09:00:00.000Z', format: 'date-time' })
  @IsDateString({ strict: true })
  startTime: string;

  @ApiProperty({ example: 60, enum: [60, 90] })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @IsIn([60, 90])
  duration: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  shared?: boolean;

  /** Allows a room-buffer exception only. It never overrides student conflicts. */
  @ApiPropertyOptional({
    default: false,
    description: 'Bypasses only the room 30-minute buffer. Student overlaps always return 409.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  override?: boolean;
}
