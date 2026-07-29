import secrets 
import string
from datetime import datetime
from zoneinfo import ZoneInfo

def generate_invite_code(length : int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    invite_code = "".join(secrets.choice(alphabet) for _ in range(length))
    return invite_code

def local_date_of(moment : datetime, timezone_name : str):
    """Converts UTC moment into the given timezone and returns justs the calendar date."""
    return moment.astimezone(ZoneInfo(timezone_name)).date()