import { randomUUID } from 'crypto';
import { access, mkdir, readFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { parse } from 'csv-parse/sync';
import dataSource from '../database/data-source';
import { databasePath } from '../database/database.options';
import { Booking } from '../bookings/booking.entity';
import { BookingStatus } from '../bookings/booking-status.enum';

type CsvRow = Record<string, string>;

const aliases = {
  lessonId: ['lessonid', 'bookingid', 'appointmentid', 'recordid', 'id'],
  studentName: ['studentname', 'student', 'learnername', 'learner', 'pupil'],
  tutorId: ['tutorid', 'tutorname', 'tutor', 'teacherid', 'teachername', 'teacher'],
  roomId: ['roomid', 'roomname', 'room', 'classroom', 'location'],
  startTime: ['starttime', 'lessonstart', 'lessonstarttime', 'datetime', 'dateandtime', 'scheduledat'],
  date: ['lessondate', 'bookingdate', 'date'],
  time: ['lessontime', 'bookingtime', 'start', 'time'],
  duration: ['durationminutes', 'durationmins', 'durationmin', 'duration', 'lengthminutes', 'length'],
  status: ['status', 'bookingstatus', 'lessonstatus'],
  cancelledAt: ['cancelledat', 'canceledat', 'cancellationtime'],
  createdAt: ['createdat', 'created', 'createdtime', 'importedat'],
  shared: ['shared', 'isgroup', 'groupbooking', 'group', 'sharedlesson'],
} as const;

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function columnFor(headers: string[], candidates: readonly string[]): string | undefined {
  const exact = headers.find((header) => candidates.includes(normalized(header)));
  if (exact) return exact;
  return headers.find((header) => {
    const clean = normalized(header);
    return candidates.some((candidate) => clean.length > 3 && (clean.includes(candidate) || candidate.includes(clean)));
  });
}

function valueFor(row: CsvRow, columns: Record<string, string | undefined>, key: keyof typeof aliases): string | undefined {
  const column = columns[key];
  const value = column ? row[column]?.trim() : undefined;
  return value || undefined;
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d{5}(?:\.\d+)?$/.test(trimmed)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + Number(trimmed) * 86_400_000);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  const dayFirst = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dayFirst) {
    const [, day, month, year, hour = '0', minute = '0', second = '0'] = dayFirst;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parseStartTime(row: CsvRow, columns: Record<string, string | undefined>): Date | undefined {
  const direct = parseDate(valueFor(row, columns, 'startTime'));
  if (direct) return direct;
  const date = valueFor(row, columns, 'date');
  const time = valueFor(row, columns, 'time');
  return parseDate([date, time].filter(Boolean).join(' '));
}

function parseDuration(value: string | undefined): number | undefined {
  if (!value) return 60;
  const match = value.match(/\d+/);
  if (!match) return undefined;
  const duration = Number(match[0]);
  return duration > 0 ? duration : undefined;
}

function parseStatus(value: string | undefined): BookingStatus {
  const clean = normalized(value ?? '');
  if (clean.includes('cancel')) return BookingStatus.CANCELLED;
  if (clean.includes('noshow') || clean === 'absent') return BookingStatus.NO_SHOW;
  return BookingStatus.ACTIVE;
}

function parseBoolean(value: string | undefined): boolean {
  return ['true', '1', 'yes', 'y', 'shared', 'group'].includes((value ?? '').trim().toLowerCase());
}

async function seed(): Promise<void> {
  const csvPath = resolve(process.cwd(), process.argv[2] ?? 'lessons_export.csv');
  try {
    await access(csvPath);
  } catch {
    throw new Error(`CSV file was not found: ${csvPath}. Pass a path or add lessons_export.csv at the project root.`);
  }

  const csv = await readFile(csvPath, 'utf8');
  const rows = parse(csv, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true, relax_quotes: true, trim: true }) as CsvRow[];
  if (rows.length === 0) {
    console.log('No data rows found; nothing imported.');
    return;
  }
  const headers = Object.keys(rows[0]);
  const columns = Object.fromEntries(Object.entries(aliases).map(([key, candidates]) => [key, columnFor(headers, candidates)])) as Record<keyof typeof aliases, string | undefined>;
  const missingIdentityColumns = ['studentName', 'tutorId', 'roomId'].filter((key) => !columns[key as keyof typeof aliases]);
  if (missingIdentityColumns.length > 0) {
    throw new Error(`Cannot import without columns for: ${missingIdentityColumns.join(', ')}. Found headers: ${headers.join(', ')}`);
  }

  const importStartedAt = new Date();
  await mkdir(dirname(databasePath), { recursive: true });
  await dataSource.initialize();
  const repository = dataSource.getRepository(Booking);
  let inserted = 0;
  const skipped: string[] = [];
  // This intentionally bypasses BookingService: historical exports may retain overlaps.
  for (const [index, row] of rows.entries()) {
    const line = index + 2;
    const studentName = valueFor(row, columns, 'studentName');
    const tutorId = valueFor(row, columns, 'tutorId');
    const roomId = valueFor(row, columns, 'roomId');
    const startTime = parseStartTime(row, columns);
    const duration = parseDuration(valueFor(row, columns, 'duration'));
    if (!studentName || !tutorId || !roomId || !startTime || !duration) {
      skipped.push(`line ${line}: missing or invalid student, tutor, room, start time, or duration`);
      continue;
    }
    try {
      await repository.insert({
        lessonId: valueFor(row, columns, 'lessonId') ?? randomUUID(),
        studentName,
        tutorId,
        roomId,
        startTime,
        duration,
        status: parseStatus(valueFor(row, columns, 'status')),
        cancelledAt: parseDate(valueFor(row, columns, 'cancelledAt')) ?? null,
        createdAt: parseDate(valueFor(row, columns, 'createdAt')) ?? importStartedAt,
        shared: parseBoolean(valueFor(row, columns, 'shared')),
      });
      inserted += 1;
    } catch (error: unknown) {
      skipped.push(`line ${line}: database rejected row (${error instanceof Error ? error.message : String(error)})`);
    }
  }
  await dataSource.destroy();
  console.log(`Imported ${inserted} historical booking(s) from ${csvPath}.`);
  if (skipped.length > 0) console.warn(`Skipped ${skipped.length} row(s):\n${skipped.join('\n')}`);
}

void seed().catch(async (error: unknown) => {
  if (dataSource.isInitialized) await dataSource.destroy();
  console.error(error);
  process.exitCode = 1;
});
