import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiConflictResponse, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Booking } from './booking.entity';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { DailyBookingsQueryDto } from './dto/daily-bookings-query.dto';
import { AllBookingsQueryDto } from './dto/all-bookings-query.dto';

@ApiTags('bookings')
@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a booking' })
  @ApiCreatedResponse({ type: Booking })
  @ApiConflictResponse({
    description: 'The student overlaps an active lesson, or the room violates its 30-minute buffer.',
  })
  create(@Body() input: CreateBookingDto): Promise<Booking> {
    return this.bookingService.create(input);
  }

  @Get()
  @ApiOperation({ summary: 'List all bookings, optionally filtered by start date' })
  @ApiOkResponse({ type: Booking, isArray: true })
  findAll(@Query() query: AllBookingsQueryDto): Promise<Booking[]> {
    return this.bookingService.findAll(query.date);
  }

  @Get('daily')
  @ApiOperation({ summary: 'List active bookings starting on a UTC calendar date' })
  @ApiOkResponse({ type: Booking, isArray: true })
  findDaily(@Query() query: DailyBookingsQueryDto): Promise<Booking[]> {
    return this.bookingService.findDailyActive(query.date);
  }
}
