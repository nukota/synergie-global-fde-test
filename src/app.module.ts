import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingModule } from './bookings/booking.module';
import { databaseOptions } from './database/database.options';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(databaseOptions),
    BookingModule,
  ],
})
export class AppModule {}
