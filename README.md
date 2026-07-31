# Group Challenge Tracker

A real-time group habit-and-challenge tracker with timezone-correct streaks and live leaderboards. Friends form a group, create shared challenges (like "30-Day Gym"), check in each day, and watch a **midnight reveal** push the updated leaderboard to everyone at once.

> **Status:** Backend complete (auth, groups, challenges, check-ins, streak engine, real-time reveal, concurrency handling). Frontend (React) in progress.

---

## What it does

- **Accounts & groups** — users register, log in, and join groups via invite codes.
- **Challenges** — group members create shared challenges (boolean, numeric, or text check-in types) with durations and goals.
- **Daily check-ins** — one check-in per user per challenge per day, enforced in each user's *local* timezone.
- **Streak engine** — current and longest streaks, calculated correctly across timezones and daylight-saving boundaries, with a "today or yesterday" grace period.
- **Live leaderboards** — members ranked by current streak.
- **The midnight reveal** — a scheduled job recalculates every member's streak at midnight and **broadcasts the updated leaderboard in real time** to all connected clients over WebSockets.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI |
| Database | PostgreSQL (via SQLAlchemy) |
| Real-time | WebSockets |
| Scheduling | APScheduler |
| Auth | JWT (from scratch) + bcrypt |
| Frontend | React (in progress) |

---

## Architecture highlights

These are the parts I'm most proud of, and where most of the engineering went:

**Timezone-correct data model.** Every timestamp is stored in UTC (`TIMESTAMPTZ`, with the database connection pinned to UTC), and all day-boundary logic converts to each user's local timezone before comparing dates. This means a check-in at 11:30 PM in one timezone is correctly counted for *that* local day, not misfiled to the next UTC day — the subtle bug that would otherwise silently break streaks.

**Authentication built from scratch.** bcrypt password hashing (with per-password salts), JWT tokens with explicit expiry and a pinned signing algorithm, a reusable dependency for protecting routes, and anti–user-enumeration on login. Response schemas act as allow-lists so sensitive fields (like password hashes) can never leak.

**A tested streak engine.** The streak calculation is a pure, dependency-injected function with a full unit-test suite covering clean streaks, the grace period, broken streaks, historical gaps, and multiple timezones. Streaks are computed on check-in and stored (compute-on-write), then recalculated at midnight to handle decay (a streak dropping to zero after a missed day).

**Real-time reveal over WebSockets.** A connection manager tracks WebSocket connections per group and broadcasts updates to all of them. Connections are authenticated (via a query-parameter token, since browsers can't set headers on WebSockets) and authorized (group membership checked before the connection is accepted). Reconnecting clients are immediately caught up with the current leaderboard.

**Concurrency-safe midnight job.** A check-in near midnight can race the midnight recalculation — a read-modify-write race that could overwrite a valid streak. This is solved with row-level locking (`SELECT ... FOR UPDATE`) so the operations serialize instead of clobbering each other, plus a unique constraint to cover the insert-race case (since you can't lock a row that doesn't exist yet). The lock was verified empirically by forcing the race with two concurrent database sessions.

---

## Project structure

```
group-challenge-tracker/
├── backend/
│   ├── main.py              # FastAPI app + all endpoints (HTTP + WebSocket)
│   ├── models.py            # SQLAlchemy models (6 tables)
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── database.py          # Engine, session factory, get_db dependency
│   ├── auth.py              # Password hashing/verification
│   ├── token_utils.py       # JWT creation + auth dependencies
│   ├── streaks.py           # Streak calculation + storage (with row locking)
│   ├── midnight.py          # Scheduled reveal job + leaderboard building
│   ├── websocket_manager.py # WebSocket connection manager
│   ├── utils.py             # Invite codes, timezone helpers
│   ├── create_tables.py     # Creates database tables from the models
│   ├── test_streaks.py      # Streak engine unit tests
│   ├── test_lock.py         # Concurrency (row lock) demonstration test
│   └── requirements.txt     # Python dependencies
├── frontend/                # React app (in progress)
└── docs/                    # Detailed weekly development recaps
```

---

## Running it locally

### Prerequisites
- Python 3.12+
- PostgreSQL
- Node.js (for the frontend)

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file in `backend/` with:

```
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/challenge_tracker
SECRET_KEY=<a long random string>
```

Create the database and tables:

```bash
createdb challenge_tracker
python3 create_tables.py
```

Run the server:

```bash
uvicorn main:app --reload
```

The API and interactive docs are then available at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```
