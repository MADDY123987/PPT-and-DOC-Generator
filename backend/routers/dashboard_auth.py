# backend/routers/dashboard_auth.py

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.dbutils import get_db
from models import models
from .auth_bridge import get_current_user  # 👈 use the bridge
import json

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _make_summary_from_presentation(presentation_obj, char_limit=280):
    try:
        topic = (getattr(presentation_obj, "topic", "") or "").strip()
    except Exception:
        topic = ""

    content = getattr(presentation_obj, "content", None)
    short = ""

    try:
        if isinstance(content, list) and len(content) > 0:
            first = content[0]
            if isinstance(first, dict):
                title = (first.get("title") or "").strip()
                if title:
                    short = title
                else:
                    bullets = first.get("bullets") or []
                    if isinstance(bullets, list) and len(bullets) > 0:
                        first_b = str(bullets[0]).strip()
                        if first_b:
                            short = first_b
                    else:
                        desc = (first.get("description") or "").strip()
                        if desc:
                            short = desc
            elif isinstance(first, str) and first.strip():
                short = first.strip()
        elif isinstance(content, str) and content.strip():
            try:
                parsed = json.loads(content)
                if isinstance(parsed, list) and parsed:
                    f = parsed[0]
                    if isinstance(f, dict):
                        title = (f.get("title") or "").strip()
                        if title:
                            short = title
                        else:
                            bullets = f.get("bullets") or []
                            if bullets and isinstance(bullets, list) and len(bullets) > 0:
                                short = str(bullets[0]).strip()
            except Exception:
                short = content.strip()[:char_limit]
    except Exception:
        short = ""

    candidate = (short or topic or "").strip()
    if not candidate:
        candidate = f"Presentation #{getattr(presentation_obj, 'presentation_id', '')}"

    if len(candidate) > char_limit:
        cut = candidate[:char_limit]
        last_space = cut.rfind(" ")
        if last_space > int(char_limit * 0.5):
            cut = cut[:last_space]
        candidate = cut + "..."
    return candidate


@router.get("/items")
def get_dashboard_items(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Secure: Return PPT + DOCX items for the authenticated user.
    We now use the bridged local User (integer id).
    """

    user_id = current_user.id  # integer local id

    presentations = (
        db.query(models.Presentation)
        .filter(models.Presentation.owner_id == user_id)
        .order_by(models.Presentation.created_at.desc())
        .all()
    )

    projects = (
        db.query(models.Project)
        .filter(models.Project.owner_id == user_id)
        .order_by(models.Project.created_at.desc())
        .all()
    )

    return {
        "presentations": [
            {
                "id": p.presentation_id,
                "title": p.topic,
                "summary": _make_summary_from_presentation(p),
                "type": "pptx",
                "created_at": p.created_at,
                "download_endpoint": f"/api/v1/presentations/{p.presentation_id}/download",
                "content": p.content,
            }
            for p in presentations
        ],
        "projects": [
            {
                "id": pr.id,
                "title": pr.title,
                "summary": (pr.title or "")[:280],
                "type": (pr.doc_type or "").lower(),
                "created_at": pr.created_at,
                "download_endpoint": f"/api/v1/documents/{pr.id}/export",
            }
            for pr in projects
        ],
    }
@router.get("/debug")
def debug_dashboard(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.id
    ppt_count = db.query(models.Presentation).filter(models.Presentation.owner_id == user_id).count()
    doc_count = db.query(models.Project).filter(models.Project.owner_id == user_id).count()

    return {
        "user_id": user_id,
        "email": current_user.email,
        "ppt_count": ppt_count,
        "doc_count": doc_count,
    }
