import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { Booking } from './booking.entity';
import { BookingStatus } from './booking-status.enum';
import { CreateBookingDto } from './dto/create-booking.dto';

const ROOM_BUFFER_MINUTES = 30;

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(input: CreateBookingDto): Promise<Booking> {
    const startTime = new Date(input.startTime);
    this.assertWithinOperatingHours(startTime, input.duration);

    // Keep validation and insertion in one transaction so an accepted booking is committed
    // atomically. TypeORM owns the transaction lifecycle for SQLite connections.
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const studentConflict = await this.findStudentConflict(
        queryRunner.manager.getRepository(Booking),
        input.studentName,
        startTime,
        input.duration,
      );
      if (studentConflict) {
        throw new ConflictException({
          code: 'STUDENT_TIME_CONFLICT',
          message: 'This student already has an active lesson that overlaps this time.',
          conflictingLessonId: studentConflict.lessonId,
        });
      }

      if (!input.override) {
        const roomConflict = await this.findRoomBufferConflict(
          queryRunner.manager.getRepository(Booking),
          input.roomId,
          startTime,
          input.duration,
        );
        if (roomConflict) {
          throw new ConflictException({
            code: 'ROOM_BUFFER_CONFLICT',
            message: `Room bookings require a ${ROOM_BUFFER_MINUTES}-minute gap. Set override=true only for an approved exception.`,
            conflictingLessonId: roomConflict.lessonId,
          });
        }
      }

      const booking = queryRunner.manager.create(Booking, {
        lessonId: randomUUID(),
        studentName: input.studentName.trim(),
        tutorId: input.tutorId.trim(),
        roomId: input.roomId.trim(),
        startTime,
        duration: input.duration,
        status: BookingStatus.ACTIVE,
        cancelledAt: null,
        createdAt: new Date(),
        shared: input.shared ?? false,
      });
      const saved = await queryRunner.manager.save(booking);
      await queryRunner.commitTransaction();
      return saved;
    } catch (error: unknown) {
      try {
        await queryRunner.rollbackTransaction();
      } catch {
        // Preserve the original error if the transaction could not be started.
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findDailyActive(date: string): Promise<Booking[]> {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const nextDay = new Date(dayStart);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    return this.bookings
      .createQueryBuilder('booking')
      .where('booking.status = :status', { status: BookingStatus.ACTIVE })
      .andWhere('booking.start_time >= :dayStart', { dayStart: this.sqliteDate(dayStart) })
      .andWhere('booking.start_time < :nextDay', { nextDay: this.sqliteDate(nextDay) })
      .orderBy('booking.start_time', 'ASC')
      .getMany();
  }

  async findAll(date?: string): Promise<Booking[]> {
    const query = this.bookings.createQueryBuilder('booking').orderBy('booking.start_time', 'DESC');
    if (date) {
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const nextDay = new Date(dayStart);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      query.where('booking.start_time >= :dayStart', { dayStart: this.sqliteDate(dayStart) })
        .andWhere('booking.start_time < :nextDay', { nextDay: this.sqliteDate(nextDay) });
    }
    return query.getMany();
  }

  private async findStudentConflict(
    repository: Repository<Booking>,
    studentName: string,
    startTime: Date,
    duration: number,
  ): Promise<Booking | null> {
    const endTime = new Date(startTime.getTime() + duration * 60_000);
    return repository
      .createQueryBuilder('booking')
      .where('booking.student_name = :studentName', { studentName: studentName.trim() })
      .andWhere('booking.status = :status', { status: BookingStatus.ACTIVE })
      .andWhere('booking.start_time < :endTime', { endTime: this.sqliteDate(endTime) })
      .andWhere("datetime(booking.start_time, '+' || booking.duration || ' minutes') > :startTime", {
        startTime: this.sqliteDate(startTime),
      })
      .orderBy('booking.start_time', 'ASC')
      .getOne();
  }

  private async findRoomBufferConflict(
    repository: Repository<Booking>,
    roomId: string,
    startTime: Date,
    duration: number,
  ): Promise<Booking | null> {
    const candidateEndWithBuffer = new Date(
      startTime.getTime() + (duration + ROOM_BUFFER_MINUTES) * 60_000,
    );
    return repository
      .createQueryBuilder('booking')
      .where('booking.room_id = :roomId', { roomId: roomId.trim() })
      .andWhere('booking.status = :status', { status: BookingStatus.ACTIVE })
      .andWhere('booking.start_time < :candidateEndWithBuffer', {
        candidateEndWithBuffer: this.sqliteDate(candidateEndWithBuffer),
      })
      .andWhere(
        "datetime(booking.start_time, '+' || (booking.duration + :buffer) || ' minutes') > :startTime",
        { buffer: ROOM_BUFFER_MINUTES, startTime: this.sqliteDate(startTime) },
      )
      .orderBy('booking.start_time', 'ASC')
      .getOne();
  }

  private assertWithinOperatingHours(startTime: Date, duration: number): void {
    if (Number.isNaN(startTime.getTime())) {
      throw new BadRequestException('startTime must be a valid ISO-8601 datetime.');
    }
    if (
      (startTime.getUTCMinutes() !== 0 && startTime.getUTCMinutes() !== 30) ||
      startTime.getUTCSeconds() !== 0 ||
      startTime.getUTCMilliseconds() !== 0
    ) {
      throw new BadRequestException('Lessons must start on the hour or half-hour.');
    }
    const weekday = startTime.getUTCDay();
    if (weekday === 1) {
      throw new BadRequestException('The learning centre is closed on Mondays.');
    }
    const startMinutes = startTime.getUTCHours() * 60 + startTime.getUTCMinutes();
    const endMinutes = startMinutes + duration;
    if (startMinutes < 9 * 60 || endMinutes > 21 * 60) {
      throw new BadRequestException('Lessons must run between 09:00 and 21:00 UTC.');
    }
  }

  private sqliteDate(date: Date): string {
    return date.toISOString().replace('T', ' ').replace('Z', '');
  }
}
