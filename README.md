# Group Challenge Tracker

A real-time group habit-and-challenge tracker with timezone-correct streaks and live leaderboards. Friends form a group, create shared challenges (like "30-Day Gym"), check in each day, and watch the leaderboard update live as everyone checks in — with each member's streak tracked in their own timezone.

**Demo video:** [Watch on YouTube]_(https://www.youtube.com/watch?v=APlLcFilvmI)_


Full walkthrough: register, log in, create a group and challenges, check in across all three challenge types.

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
| Frontend | React (Vite), plain CSS with design tokens |

---

## Architecture highlights

**Timezone-correct streaks.** Timestamps are stored in UTC and converted to each user's local timezone before comparing dates, so a late-night check-in counts for the right local day instead of silently breaking the streak.

**Authentication from scratch.** bcrypt hashing, JWT tokens with expiry and a pinned algorithm, a reusable route-protection dependency, and response schemas that act as allow-lists so password hashes can't leak.

**A tested streak engine.** A pure, dependency-injected function with unit tests covering clean streaks, the grace period, breaks, gaps, and multiple timezones — computed on check-in and recalculated at midnight for decay.

**Real-time leaderboards over WebSockets.** A connection manager broadcasts to authenticated, authorized per-group connections; every check-in pushes a fresh leaderboard, and the midnight job broadcasts recalculated standings.

**Concurrency-safe midnight job.** Row-level locking (`SELECT ... FOR UPDATE`) plus a unique constraint prevent a near-midnight check-in from racing the recalculation — verified with two concurrent database sessions.

**A custom frontend design system.** Plain CSS with design tokens (the whole theme in a handful of variables), reusable component classes, and a responsive mobile-to-two-column layout; the client validates for speed while the server enforces the rules.

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
---
## What I'd build next

- Delete/leave flows for challenges and groups (creator-only permissions, with cascade handling)
- Client-side routing (React Router) for shareable URLs and browser navigation
- A momentum/recommendation layer: smarter scoring and challenge suggestions

