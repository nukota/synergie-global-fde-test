import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class RenameStudentId1710000000001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!await queryRunner.hasColumn('bookings', 'student_id')) return;
    await queryRunner.dropIndex('bookings', 'IDX_bookings_student_start');
    await queryRunner.renameColumn('bookings', 'student_id', 'student_name');
    await queryRunner.createIndex('bookings', new TableIndex({ name: 'IDX_bookings_student_start', columnNames: ['student_name', 'start_time'] }));
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    if (!await queryRunner.hasColumn('bookings', 'student_name')) return;
    await queryRunner.dropIndex('bookings', 'IDX_bookings_student_start');
    await queryRunner.renameColumn('bookings', 'student_name', 'student_id');
    await queryRunner.createIndex('bookings', new TableIndex({ name: 'IDX_bookings_student_start', columnNames: ['student_id', 'start_time'] }));
  }
}
