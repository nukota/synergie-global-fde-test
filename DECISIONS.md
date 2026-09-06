# Bright Path - Technical Decisions

## Phase 1: Read the situation

**Questions for the owner:**

| QUESTION FOR THE OWNER                                                                     | SCENARIO & IMPACT ON THE BUILD                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Are tutors paid directly based on this system's data?**                                  | **If yes:** Schema requires explicit billing statuses (`CANCELLED_EARLY_FREE`, `CANCELLED_LATE_PAID`, `NO_SHOW_PAID`) to ensure accurate compensation under the 4-hour rule.<br><br>**If no:** Data model remains simple. Cancellations don't need complex financial tracking flags.                                                                                                                                                                              |
| **How should we handle historical data (the seed export) that violates new strict rules?** | **If we enforce rules on new bookings only (Recommended):** System allows raw import of messy history to retain operational records. Conflict detection logic strictly intercepts and blocks only new `POST/PUT` requests.<br><br>**If the system must reject old conflicting data:** I must write a data-sanitization script to quarantine overlapping historical records into a separate **"Conflict Review"** table for manual resolution by the receptionist. |

**Inconsistencies & Readings:**

- **The Exam Season Contradiction:** The rules state a room holds one lesson and a tutor can only be in one room. However, Mai states that she puts two students with one tutor in the same room/slot during exam season.
- **Reading:** I will prioritize the owner's strict rule against double-booking a _student_ ("student booked into two places at once"), but I must build flexibility into the tutor/room overlap to accommodate Mai's exam season reality.

**Assumptions:**

- "Mid-morning to mid-evening" means 09:00 to 21:00.
- Bookings only occur on the hour or half-hour, making time-overlap calculations simpler.
- Configurable 30-minute buffer: The centre requires a buffer time between lessons in the same room. Implemented as a simple config variable for easy adjustment later.

## Phase 2: Choose what to build

**Potential Features:**

1. Safe Booking Lifecycle: Create, move, or cancel with strict conflict detection to prevent double bookings.
2. 16:00 Cut-off Versioning: Audit trail to highlight late changes instead of silently overwriting the schedule.
3. Tutor Load Enforcement: System validation to block more than 6 lessons per tutor daily.
4. Daily Dashboard: A read-only "today at a glance" view for the owner and receptionist.
5. Tutor Notifications: Reliable, automated alerts for late cancellations and schedule updates.
6. Data Importer: Tooling to safely ingest and sanitize the existing legacy spreadsheet.

**The Choice: Safe Booking Lifecycle (Conflict Detection)**

- **Why it wins:** The owner clearly stated that a double-booked student is unacceptable ("if the system allows it, the system is broken"). Fixing this instantly resolves the most critical, client-facing risk.

- **What is left broken:** Choosing this means delaying other administrative features:
  - Tutor Overload: The system will not enforce the 6-lesson daily limit per tutor, so Mai can still manually break this rule when desperate.

  - Silent Overwrites: Schedule changes made after the 16:00 cut-off will still quietly overwrite the schedule rather than preserving a visible history of what the tutor was originally told.

  - Tutor Confusion: Without automated notifications, tutors may still suffer from receiving multiple confusing schedule messages from reception.

## Phase 3: Design and build that one

**Data Model (SQLite)**
To support Conflict Detection and safe booking lifecycles with minimal setup time, the core schema is the `Booking` table stored in SQLite:

- `id` (String/UUID, Primary Key)
- `student_id` (String)
- `tutor_id` (String)
- `room_id` (String)
- `start_time` (Timestamp/Datetime)
- `end_time` (Timestamp/Datetime)
- `status` (String/Enum: ACTIVE, CANCELLED, NO_SHOW)
- `cancelled_at` (Timestamp/Datetime, Nullable)
- `created_at` (Timestamp/Datetime)

**Handling Cancelled or Moved Bookings (The 16:00 Rule)**
To respect the rule that schedule changes must be visible rather than quietly overwritten:

- I strictly prohibit modifying the `start_time`, `end_time`, or `tutor_id` of an existing record.
- If a booking is cancelled, its `status` is updated to `CANCELLED`.
- If a booking is _moved_, the original booking is marked as `CANCELLED`, and a completely _new_ booking record is created for the new time. This preserves the exact history of what the tutor was originally told, paving the way for the 16:00 cut-off audit trail.

**Enforcement: Database vs. Code**

| RULE                                  | ENFORCED IN                     | WHY                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Opening days (Closed Monday)**   | Code                            | Calculating weekdays is trivial in application logic. Enforcing "no Mondays" via a database constraint is too rigid and requires schema migrations if the business ever decides to open on Mondays.                                                                                                                                                            |
| **2. Tutor load (Max 6 per day)**     | Code                            | Enforcing a maximum limit requires aggregating and counting existing rows. Standard SQL `CHECK` constraints cannot easily perform cross-row aggregations.                                                                                                                                                                                                      |
| **3. Late cancellation & No-show**    | Database (State) & Code (Logic) | The database enforces the outcome via a strict `status` ENUM (`CANCELLED` vs `NO_SHOW`) so the system knows whether to free the room or not. The application code calculates if the cancellation occurred outside the 4-hour window.                                                                                                                           |
| **4. The 16:00 cut-off & visibility** | Database (Schema level)         | To ensure late changes are visible, the database schema dictates a "cancel-and-recreate" approach. Updates to times or tutors are handled by marking the old row as `CANCELLED` and inserting a new row, preserving the history in the database.                                                                                                               |
| **5. Rooms (No overlaps)**            | Code                            | The receptionist explicitly breaks the one-room/one-tutor rule during exam season by putting two students in the same room. If enforced via Database Unique Constraints, the database would throw hard errors and block this exception. Code-level enforcement strictly blocks student double-bookings while allowing a conditional override for tutors/rooms. |

**API Shape**

- `POST /api/bookings`: Creates a new booking. Runs the overlap detection logic before saving.
- `GET /api/bookings/daily?date=YYYY-MM-DD`: Returns the active schedule for the owner/receptionist dashboard.

**The Rejected Endpoint**

- `PUT /api/bookings/:id` or `PATCH /api/bookings/:id` (for updating times/tutors).
- **Why I rejected it:** Modifying the core fields of a booking in place destroys the history of the schedule. To satisfy the requirement that late changes must be visible as changes[cite: 1], the system must force a "cancel and recreate" flow rather than a direct update.
