from sqlalchemy.orm import Session

from models import Group, GroupMember, Challenge, Streak, User
from streaks import update_stored_streak
from websocket_manager import ConnectionManager
from database import SessionLocal

async def reveal_group(db : Session, manager : ConnectionManager, group_id : int):
    """Recalculate streaks for a group's challenges and broadcast the updated leaderboard."""
    # find all challenges in this group
    challenges = db.query(Challenge).filter(Challenge.group_id == group_id).all()
    # find all members of this group
    members = db.query(GroupMember).filter(GroupMember.group_id == group_id).all()

    # recalculate every member's streak for every challenge (keeps stored values fresh)
    for challenge in challenges:
        for member in members:
            user = db.query(User).filter(User.id == member.user_id).first()
            if user is not None:
                update_stored_streak(db, user, challenge.id)

    # build the leaderboard for each challenge and broadcast it
    for challenge in challenges:
        rows = (
            db.query(Streak, User)
            .join(User, Streak.user_id == User.id)
            .filter(Streak.challenge_id == challenge.id)
            .order_by(Streak.current_streak.desc())
            .all()
        )
        leaderboard = [
            {
                "rank": i + 1,
                "user_id": user.id,
                "email": user.email,
                "name" : user.name,
                "current_streak": streak.current_streak,
                "longest_streak": streak.longest_streak,
            }
            for i, (streak, user) in enumerate(rows)
        ]

        await manager.broadcast(group_id, {
            "type": "midnight_reveal",
            "challenge_id": challenge.id,
            "challenge_name": challenge.name,
            "leaderboard": leaderboard,
        })            

async def reveal_all_groups(manager: ConnectionManager):
    """The scheduled job: run the reveal for every group."""
    db = SessionLocal()
    try:
        groups = db.query(Group).all()
        for group in groups:
            await reveal_group(db, manager, group.id)
    finally:
        db.close()

def build_leaderboards(db: Session, group_id: int) -> list[dict]:
    """Build the current leaderboard message for every challenge in a group."""
    challenges = db.query(Challenge).filter(Challenge.group_id == group_id).all()
    messages = []
    for challenge in challenges:
        rows = (
            db.query(Streak, User)
            .join(User, Streak.user_id == User.id)
            .filter(Streak.challenge_id == challenge.id)
            .order_by(Streak.current_streak.desc())
            .all()
        )
        leaderboard = [
            {
                "rank": i + 1,
                "user_id": user.id,
                "email": user.email,
                "name" : user.name,
                "current_streak": streak.current_streak,
                "longest_streak": streak.longest_streak,
            }
            for i, (streak, user) in enumerate(rows)
        ]
        messages.append({
            "type": "leaderboard_state",
            "challenge_id": challenge.id,
            "challenge_name": challenge.name,
            "leaderboard": leaderboard,
        })
    return messages