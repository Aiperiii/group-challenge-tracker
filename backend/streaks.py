from datetime import timedelta, datetime,timezone
from sqlalchemy.orm import Session
from models import CheckIn, User, Streak
from utils import local_date_of

def calculate_streak(db : Session, user : User, challenge_id : int, today = None):
    """ Calculates user's current streak and longest streak for 
    the challenge in the user's local timezone."""

    all_check_ins = db.query(CheckIn).filter(CheckIn.user_id == user.id, 
    CheckIn.challenge_id == challenge_id).all()

    local_dates = sorted({local_date_of(ch_in.checked_in_at, user.timezone) for ch_in in all_check_ins})

    if not local_dates:
        return {"current_streak" : 0, "longest_streak" : 0}

    if today is None:
        today_date = local_date_of(datetime.now(timezone.utc), user.timezone)
    else:
        today_date = today

    # current_streak : anchored to today or yesterday
    most_recent = local_dates[-1]

    if(most_recent < today_date - timedelta(days = 1)):
        current_streak = 0
    else:
        current_streak = 1 # most_recent is today OR yesterday — streak alive, start counting
        # count backward from most_recent
        for i in range(len(local_dates) - 1, 0, -1):
            if local_dates[i] - local_dates[i - 1] == timedelta(days = 1):
                current_streak += 1
            else:
                break

    longest_streak = 1
    current_run = 1
    for i in range(1, len(local_dates)):
        if(local_dates[i] - local_dates[i-1] == timedelta(days = 1)):
            current_run += 1
        else:
            longest_streak = max(longest_streak, current_run)
            current_run = 1
    longest_streak = max(longest_streak, current_run)

    return {"current_streak": current_streak, "longest_streak": longest_streak}


def update_stored_streak(db : Session, user : User, challenge_id : int):
    """Recalculate user's streak and save it into the streaks table."""

    results = calculate_streak(db, user, challenge_id)

    # find an existing streak row for this user+challenge or make a new one (upsert)
    streaks_row = db.query(Streak).filter(Streak.user_id == user.id, Streak.challenge_id == challenge_id).first()
    if streaks_row is None:
        streaks_row = Streak(challenge_id = challenge_id, user_id = user.id)
        db.add(streaks_row)
    
    streaks_row.current_streak = results["current_streak"]
    streaks_row.longest_streak = results["longest_streak"]
    streaks_row.last_calculated_at = datetime.now(timezone.utc)

    db.commit()
    return results
