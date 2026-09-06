import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';
import { Booking } from '../bookings/booking.entity';

export const databasePath = process.env.DATABASE_PATH ?? join(process.cwd(), 'data', 'learning-centre.sqlite');

export const databaseOptions: TypeOrmModuleOptions = {
  type: 'sqlite',
  database: databasePath,
  entities: [Booking],
  synchronize: false,
  migrationsRun: false,
  extra: { busyTimeout: 5_000 },
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
};
