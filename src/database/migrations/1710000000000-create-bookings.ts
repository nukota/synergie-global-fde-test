import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateBookings1710000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'bookings',
        columns: [
          { name: 'lesson_id', type: 'varchar', isPrimary: true },
          { name: 'student_name', type: 'varchar', isNullable: false },
          { name: 'tutor_id', type: 'varchar', isNullable: false },
          { name: 'room_id', type: 'varchar', isNullable: false },
          { name: 'start_time', type: 'datetime', isNullable: false },
          { name: 'duration', type: 'integer', isNullable: false },
          { name: 'status', type: 'varchar', isNullable: false, default: "'ACTIVE'" },
          { name: 'cancelled_at', type: 'datetime', isNullable: true },
          { name: 'created_at', type: 'datetime', isNullable: false },
          { name: 'shared', type: 'boolean', isNullable: false, default: '0' },
        ],
        checks: [
          { name: 'CHK_booking_duration_positive', expression: 'duration > 0' },
          {
            name: 'CHK_booking_status',
            expression: "status IN ('ACTIVE', 'CANCELLED', 'NO_SHOW')",
          },
        ],
      }),
    );
    await queryRunner.createIndices('bookings', [
      new TableIndex({ name: 'IDX_bookings_student_start', columnNames: ['student_name', 'start_time'] }),
      new TableIndex({ name: 'IDX_bookings_room_start', columnNames: ['room_id', 'start_time'] }),
      new TableIndex({ name: 'IDX_bookings_status_start', columnNames: ['status', 'start_time'] }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('bookings');
  }
}
