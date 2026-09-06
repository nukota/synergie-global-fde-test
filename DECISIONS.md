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
3. Shared/Group Booking (Exam Season): Allow adding another student to an existing booking slot.
4. Tutor Load Enforcement: System validation to block more than 6 lessons per tutor daily.
5. Daily Dashboard: A read-only "today at a glance" view for the owner and receptionist.
6. Tutor Notifications: Reliable, automated alerts for late cancellations and schedule updates.
7. Data Importer: Tooling to safely ingest and sanitize the existing legacy spreadsheet.

**The Choice: Safe Booking Lifecycle (Conflict Detection)**

- **Why it wins:** The owner clearly stated that a double-booked student is unacceptable ("if the system allows it, the system is broken"). Fixing this instantly resolves the most critical, client-facing risk.

- **What is left broken:** Choosing this means delaying other administrative features:
  - Tutor Overload: The system will not enforce the 6-lesson daily limit per tutor, so Mai can still manually break this rule when desperate.

  - Silent Overwrites: Schedule changes made after the 16:00 cut-off will still quietly overwrite the schedule rather than preserving a visible history of what the tutor was originally told.

  - Group/Shared Bookings: The system will not natively support adding a second student to an existing booking slot for exam-season group sessions.

  - Tutor Confusion: Without automated notifications, tutors may still suffer from receiving multiple confusing schedule messages from reception.

## Phase 3: Design and build that one

**Data Model (SQLite)**
To support Conflict Detection and safe booking lifecycles with minimal setup time, the core schema is the `Booking` table stored in SQLite:

- `id` (String/UUID, Primary Key)
- `student_id` (String)
- `tutor_id` (String)
- `room_id` (String)
- `start_time` (Timestamp/Datetime)
- `duration` (Integer)
- `status` (String/Enum: ACTIVE, CANCELLED, NO_SHOW)
- `cancelled_at` (Timestamp/Datetime, Nullable)
- `created_at` (Timestamp/Datetime)
- `shared` (Boolean)

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

## Phase 4: Reflect

**What I would build next with another week**

1. **A Refined Front-End Interface:** I built a simple UI in this MVP to allow users to create bookings and view the schedule (either all bookings or filtered by date). With another week, I would upgrade this into a refined, production-ready dashboard with better visual indicators for schedule gaps and tutor workloads.
2. **Tutor Load & Late Cancellation Logic:** Currently, the system does not actively block a tutor from exceeding the "Max 6 lessons per day" rule. Additionally, while bookings can be marked `CANCELLED` or `NO_SHOW`, the system doesn't yet calculate if a cancellation happened within the 4-hour penalty window. I would build out the logic to enforce these limits and automate the penalty tracking.
3. **Automated Notifications:** Integration with a messaging API (like Twilio or WhatsApp) to automatically alert tutors when a schedule changes, directly solving the "tutor confusion" pain point.
4. **Audit Logging (The 16:00 Rule):** A proper audit table to capture exactly _who_ moved a booking and _when_, making the schedule finalization process completely transparent.

**What I know is weak**

- **CSV Seeding Resilience:** The current import script is basic and assumes the legacy CSV data is relatively consistent. If the file contains extreme malformations or completely broken date formats, the script might fail rather than gracefully skipping or logging the bad rows.

**Where my AI assistant helped**
I used an AI assistant (e.g., Gemini/Codex) to:

- Scaffold the initial NestJS boilerplate and SQLite/TypeORM configuration.
- Generate the logic for reading and parsing the CSV file in the seed script.
- Draft the initial markdown structure for this document and the CLI commands in the `README.md`.
- Refine and check my wordings across this `DECISIONS.md` document and the `README.md` to ensure clarity, flow, and professionalism.
- _Note: The architectural decisions, conflict-detection logic rules, and schema design were entirely my own work. I also review, debug and clarify all the code generated by AI_

**One suggestion I threw away — and why I was right to**

- **The Idea:** Implementing a full **Event Sourcing** architecture to track every single change to a booking, ensuring 100% historical accuracy for the 16:00 cut-off rule.
- **Why I threw it away:** It is severe over-engineering for a 2.5-hour MVP. Event sourcing introduces massive complexity in data querying and system design.
- **Why I was right:** The business doesn't need an enterprise-grade event stream; Mai just needs to know what she originally told the tutor. The "cancel-and-recreate" pattern (marking the old row `CANCELLED` and creating a new one) perfectly solves the business requirement with a fraction of the technical debt and time cost.
