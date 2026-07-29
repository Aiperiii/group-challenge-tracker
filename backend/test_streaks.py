from datetime import datetime, timezone, date
from zoneinfo import ZoneInfo
from types import SimpleNamespace

from streaks import calculate_streak


# --- Test helpers -----------------------------------------------------------

def make_checkin(local_day: date, tz_name: str):
    """Build a fake check-in whose UTC timestamp lands on `local_day` in `tz_name`."""
    # Noon local time is safely inside the day in any timezone, then stored as UTC.
    local_noon = datetime(local_day.year, local_day.month, local_day.day, 12, 0, tzinfo=ZoneInfo(tz_name))
    return SimpleNamespace(checked_in_at=local_noon.astimezone(timezone.utc))


class FakeDB:
    """A stand-in for the database session that returns preset check-ins."""
    def __init__(self, checkins):
        self._checkins = checkins

    def query(self, *args, **kwargs):
        return self

    def filter(self, *args, **kwargs):
        return self

    def all(self):
        return self._checkins


def run_case(name, local_days, tz_name, today, expected_current, expected_longest):
    """Run one scenario and report pass/fail."""
    user = SimpleNamespace(id=1, timezone=tz_name)
    checkins = [make_checkin(d, tz_name) for d in local_days]
    db = FakeDB(checkins)

    result = calculate_streak(db, user, challenge_id=1, today=today)

    ok = result["current_streak"] == expected_current and result["longest_streak"] == expected_longest
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}")
    if not ok:
        print(f"        expected current={expected_current}, longest={expected_longest}")
        print(f"        got      current={result['current_streak']}, longest={result['longest_streak']}")


# --- The scenarios ----------------------------------------------------------

if __name__ == "__main__":
    tz = "America/Chicago"
    today = date(2026, 8, 10)
    d = date  # shorthand

    # 1. Checked in today + 3 days before = 4-day current streak
    run_case("Clean 4-day streak ending today",
             [d(2026, 8, 7), d(2026, 8, 8), d(2026, 8, 9), d(2026, 8, 10)],
             tz, today, 4, 4)

    # 2. Checked in through yesterday (grace period): alive at 3, NOT inflated to 4
    run_case("3-day streak ending yesterday (grace period)",
             [d(2026, 8, 7), d(2026, 8, 8), d(2026, 8, 9)],
             tz, today, 3, 3)

    # 3. Last check-in 2 days ago: current broken -> 0, but longest was 3
    run_case("Streak broken (last check-in 2 days ago)",
             [d(2026, 8, 6), d(2026, 8, 7), d(2026, 8, 8)],
             tz, today, 0, 3)

    # 4. Gap: long run earlier, short run now -> current 2, longest 4
    run_case("Gap: long run earlier, short run now",
             [d(2026, 7, 1), d(2026, 7, 2), d(2026, 7, 3), d(2026, 7, 4), d(2026, 8, 9), d(2026, 8, 10)],
             tz, today, 2, 4)

    # 5. Single check-in today
    run_case("Single check-in today",
             [d(2026, 8, 10)],
             tz, today, 1, 1)

    # 6. No check-ins at all
    run_case("No check-ins",
             [],
             tz, today, 0, 0)

    # 7. Timezone edge: a late-night check-in that would land on the wrong UTC day
    #    Bishkek (UTC+6). A check-in near local midnight should still count on its LOCAL day.
    run_case("Timezone (Bishkek) clean 2-day streak",
             [d(2026, 8, 9), d(2026, 8, 10)],
             "Asia/Bishkek", today, 2, 2)