# backend/routers/auth.py

from fastapi import Depends
from sqlalchemy.orm import Session

from core.dbutils import get_db
from models import models


def get_current_user(db: Session = Depends(get_db)) -> models.User:
    """
    TEMP AUTH STUB:
    - Returns the first user in the DB.
    - If no user exists, creates a dummy one.
    Replace this later with real authentication (JWT / Firebase).
    """
    user = db.query(models.User).first()
    if not user:
        user = models.User(
            email="demo@example.com",
            hashed_password="not_used",  # not used in this stub
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return user
