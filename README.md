# Learning Centre Scheduler

NestJS + SQLite internal API for safely coordinating one-to-one lessons.

## Run locally

```bash
npm install
copy .env.example .env
npm run migration:run
npm run start:dev
```

The API is served beneath `/api`. `POST /api/bookings` always rejects a student time overlap with HTTP 409. Room buffer collisions are rejected unless `override` is explicitly `true`; overrides never bypass student conflicts.

Interactive OpenAPI documentation is available at `http://localhost:3000/api/docs` while the service is running.

## API

```http
POST /api/bookings
Content-Type: application/json

{
  "studentName": "Nguyen An",
  "tutorId": "tutor-014",
  "roomId": "room-2",
  "startTime": "2026-09-08T09:00:00.000Z",
  "duration": 60,
  "shared": false,
  "override": false
}
```

```http
GET /api/bookings/daily?date=2026-09-08
```

## Historical CSV import

Run `npm run seed:legacy -- path/to/export.csv`, or omit the argument to use `lessons_export.csv` in the project root. The importer detects common column aliases, supplies missing metadata, reports skipped rows, and writes directly to SQLite so legacy conflicts do not block history import.

Run migrations before importing.
