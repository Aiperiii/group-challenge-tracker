import time
import threading
from datetime import datetime

from database import SessionLocal
from models import Streak


def timestamp():
    return datetime.now().strftime("%H:%M:%S.%f")[:-3]


# Pick a streak row to fight over. Adjust these to a real row in your DB.
CHALLENGE_ID = 2
USER_ID = 3


def session_a():
    db = SessionLocal()
    try:
        print(f"[{timestamp()}] A: trying to lock the row...")
        row = db.query(Streak).filter(
            Streak.challenge_id == CHALLENGE_ID,
            Streak.user_id == USER_ID,
        ).with_for_update().first()
        print(f"[{timestamp()}] A: GOT THE LOCK. Holding it for 5 seconds...")
        time.sleep(5)  # simulate a long read-calculate-write
        db.commit()    # releases the lock
        print(f"[{timestamp()}] A: committed and released the lock.")
    finally:
        db.close()


def session_b():
    time.sleep(1)  # start shortly after A, so A grabs the lock first
    db = SessionLocal()
    try:
        print(f"[{timestamp()}] B: trying to lock the SAME row...")
        row = db.query(Streak).filter(
            Streak.challenge_id == CHALLENGE_ID,
            Streak.user_id == USER_ID,
        ).with_for_update().first()
        print(f"[{timestamp()}] B: GOT THE LOCK (only possible after A released).")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    # Run A and B "at the same time" using two threads.
    ta = threading.Thread(target=session_a)
    tb = threading.Thread(target=session_b)
    ta.start()
    tb.start()
    ta.join()
    tb.join()
    print("Done.")