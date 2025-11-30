# backend/routers/auth_bridge.py

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from core.dbutils import get_db
from models import models
from auth.users import current_active_user


def get_current_user(
    db: Session = Depends(get_db),
    auth_user = Depends(current_active_user),
) -> models.User:
    """
    Bridge between FastAPI-Users auth user and local SQLAlchemy User.

    - Uses the email from FastAPI-Users user (auth_user.email)
    - Finds/creates a local models.User row with that email
    - Returns the local models.User (with integer id)
    """

    email = getattr(auth_user, "email", None)
    if not email:
        raise HTTPException(status_code=401, detail="Authenticated user has no email")

    # Look up local user by email
    user = db.query(models.User).filter(models.User.email == email).first()

    # If no local row yet, create one
    if not user:
        user = models.User(
            email=email,
            hashed_password="not_used",  # not used here; FastAPI-Users manages real auth
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return user
