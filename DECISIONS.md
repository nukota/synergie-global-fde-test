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

1. Enforce max 6 lessons per tutor per day.
2. 16:00 cut-off versioning (highlighting late changes).
3. Conflict detection (Preventing double bookings).
4. Cancellation flow (Freeing slots vs No-shows).
5. Read-only daily dashboard for the owner.

**The Choice: Conflict Detection (Feature 3)**

- **Why:** The owner explicitly stated that a student being double-booked is a catastrophic failure ("if the system allows it, the system is broken"). Solving this immediately removes the highest-stakes daily pain and restores trust in the system.
- **What is left broken:** Mai can still assign a tutor 7 lessons, and changes after 16:00 will still silently overwrite the schedule. These are operational headaches, but not critical failures like a double-booked student.

## Phase 3: Design and build that one

**Data Model Snippet:**

```json
{
  "id": "uuid",
  "student_id": "string",
  "tutor_id": "string",
  "room_id": "string",
  "start_time": "datetime",
  "end_time": "datetime",
  "status": "enum (ACTIVE, CANCELLED, NO_SHOW)"
}
```
