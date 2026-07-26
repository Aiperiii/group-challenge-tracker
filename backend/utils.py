import secrets 
import string

def generate_invite_code(length : int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    invite_code = "".join(secrets.choice(alphabet) for _ in range(length))
    return invite_code
