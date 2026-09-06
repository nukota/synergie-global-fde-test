import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { databasePath } from './database.options';
import { Booking } from '../bookings/booking.entity';
import { CreateBookings1710000000000 } from './migrations/1710000000000-create-bookings';
import { RenameStudentId1710000000001 } from './migrations/1710000000001-rename-student-id';

export default new DataSource({
  type: 'sqlite',
  database: databasePath,
  entities: [Booking],
  migrations: [CreateBookings1710000000000, RenameStudentId1710000000001],
  synchronize: false,
});
