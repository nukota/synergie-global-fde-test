import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from './booking-status.enum';

@Entity({ name: 'bookings' })
@Index('IDX_bookings_student_start', ['studentName', 'startTime'])
@Index('IDX_bookings_room_start', ['roomId', 'startTime'])
@Index('IDX_bookings_status_start', ['status', 'startTime'])
export class Booking {
  @ApiProperty({ example: 'd0d55a14-418a-4b44-9f2d-11d59e6f7e62', description: 'Generated booking UUID.' })
  @PrimaryColumn({ name: 'lesson_id', type: 'varchar' })
  lessonId: string;

  @ApiProperty({ example: 'Nguyen An' })
  @Column({ name: 'student_name', type: 'varchar' })
  studentName: string;

  @ApiProperty({ example: 'tutor-014' })
  @Column({ name: 'tutor_id', type: 'varchar' })
  tutorId: string;

  @ApiProperty({ example: 'room-2' })
  @Column({ name: 'room_id', type: 'varchar' })
  roomId: string;

  @ApiProperty({ example: '2026-09-08T09:00:00.000Z', format: 'date-time' })
  @Column({ name: 'start_time', type: 'datetime' })
  startTime: Date;

  @ApiProperty({ example: 60, enum: [60, 90] })
  @Column({ type: 'integer' })
  duration: number;

  @ApiProperty({ enum: BookingStatus, example: BookingStatus.ACTIVE })
  @Column({ type: 'varchar', default: BookingStatus.ACTIVE })
  status: BookingStatus;

  @ApiPropertyOptional({ example: '2026-09-07T12:00:00.000Z', format: 'date-time', nullable: true })
  @Column({ name: 'cancelled_at', type: 'datetime', nullable: true })
  cancelledAt: Date | null;

  @ApiProperty({ example: '2026-09-01T08:00:00.000Z', format: 'date-time' })
  @Column({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @ApiProperty({ example: false, description: 'Reserved for future shared/group lessons.' })
  @Column({ type: 'boolean', default: false })
  shared: boolean;
}
