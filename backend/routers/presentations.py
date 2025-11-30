from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from core.dbutils import get_db
from models.models import Presentation, User
from models.schemas import PresentationCreate, PresentationOut, ConfigurationUpdate
from services.content_generator import generate_content_with_gemini
from services.pptx_generator import build_pptx

# ✅ your real auth dependency (same style as documents.py)
from .auth_bridge import get_current_user

import re

router = APIRouter(tags=["Presentations"])
# In main.py you already mount with:
# app.include_router(presentations.router, prefix="/api/v1/presentations", tags=["presentations"])


# ---------- SlideUpdate schema (for editing a single slide) ----------
class SlideUpdate(BaseModel):
    title: Optional[str] = None
    bullets: Optional[List[str]] = None
    left: Optional[str] = None
    right: Optional[str] = None
    image_url: Optional[str] = None


# ---------- PresentationUpdate schema (for editing whole deck) ----------
class PresentationUpdate(BaseModel):
    topic: Optional[str] = None
    content: Optional[list] = None  # list of slide dicts
    configuration: Optional[dict] = None


def _sanitize_generated_content(content: list | None, original_prompt: str | None) -> list:
    """
    Remove or neutralize obvious copies of the original prompt from model-generated content.

    - If slides are plain strings, wrap into dicts.
    - Remove fields that look like the prompt (starts with prompt snippet).
    - Remove bullets that repeat the prompt.
    - Defensive: if content is None or not list, return an empty list.
    """
    if not content:
        return []

    prompt_norm = (original_prompt or "").strip().lower()
    # use a short slice for "startswith" checks to avoid weird long comparisons
    prompt_check = (prompt_norm[:120]).strip() if prompt_norm else ""

    cleaned = []
    for slide in content:
        # If slide is string: convert to dict
        if isinstance(slide, str):
            s_text = slide.strip()
            if not s_text:
                continue
            # skip if it looks like the prompt
            if prompt_check and s_text.lower().startswith(prompt_check):
                continue
            cleaned.append({"layout": "bullet", "title": "", "bullets": [s_text]})
            continue

        # If slide is not a dict, try to stringify safely
        if not isinstance(slide, dict):
            try:
                s = str(slide)
                if s.strip():
                    if prompt_check and s.strip().lower().startswith(prompt_check):
                        continue
                    cleaned.append({"layout": "bullet", "title": "", "bullets": [s.strip()]})
            except Exception:
                continue
            continue

        # slide is a dict: operate on a shallow copy
        slide_copy = dict(slide)

        # keys that commonly contain the bulk text
        text_keys = ("title", "description", "content", "text", "caption", "summary")

        for k in text_keys:
            if k in slide_copy and isinstance(slide_copy[k], str):
                val = slide_copy[k].strip()
                if not val:
                    slide_copy.pop(k, None)
                    continue
                # if it starts exactly with the prompt (or contains whole prompt), remove it
                if prompt_check and val.lower().startswith(prompt_check):
                    slide_copy.pop(k, None)
                else:
                    # also strip excessive whitespace and clean up repeated newlines
                    slide_copy[k] = re.sub(r"\n{3,}", "\n\n", val)

        # clean bullets
        if "bullets" in slide_copy and isinstance(slide_copy["bullets"], list):
            filtered = []
            for b in slide_copy["bullets"]:
                if not isinstance(b, str):
                    filtered.append(b)
                    continue
                b_text = b.strip()
                if not b_text:
                    continue
                if prompt_check and b_text.lower().startswith(prompt_check):
                    # skip bullet that repeats prompt
                    continue
                filtered.append(b_text)
            slide_copy["bullets"] = filtered

        # If slide_copy after cleanup is essentially empty, skip it
        has_text = False
        for k in ("title", "description", "content", "text", "bullets", "caption"):
            val = slide_copy.get(k)
            if isinstance(val, str) and val.strip():
                has_text = True
                break
            if isinstance(val, list) and any(str(x).strip() for x in val):
                has_text = True
                break

        if not has_text:
            # skip empty slide
            continue

        cleaned.append(slide_copy)

    return cleaned


@router.post("/", response_model=PresentationOut, summary="Create a new presentation")
def create_presentation(
    presentation: PresentationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new PPT presentation for the current user.

    If `custom_content` is provided from the frontend, we trust that content
    (e.g. user-edited slides) and store it directly. Otherwise we call Gemini.
    This endpoint sanitizes model output to avoid storing the original prompt text inside slides.
    """
    if presentation.custom_content:
        raw_content = [slide.dict() for slide in presentation.custom_content]
    else:
        # If Gemini fails (429 etc.), generate_content_with_gemini must raise and be handled by caller
        raw_content = generate_content_with_gemini(
            presentation.topic,
            presentation.num_slides,
        )

    # Sanitize the generated content to remove prompt echoes and obvious duplicates
    try:
        cleaned_content = _sanitize_generated_content(raw_content, presentation.topic)
    except Exception:
        # Defensive fallback: use raw content if sanitize fails
        cleaned_content = raw_content or []

    db_presentation = Presentation(
        topic=presentation.topic,
        content=cleaned_content,
        owner_id=current_user.id,
    )
    db.add(db_presentation)
    db.commit()
    db.refresh(db_presentation)
    return db_presentation


@router.put(
    "/{presentation_id}",
    response_model=PresentationOut,
    summary="Overwrite presentation topic/content/configuration",
)
def update_presentation(
    presentation_id: int,
    update: PresentationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Overwrite a presentation's topic/content/configuration for the current user.
    """
    presentation = (
        db.query(Presentation)
        .filter(
            Presentation.presentation_id == presentation_id,
            Presentation.owner_id == current_user.id,
        )
        .first()
    )
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")

    data = update.dict(exclude_unset=True)

    if "topic" in data and data["topic"] is not None:
        presentation.topic = data["topic"]

    if "content" in data and data["content"] is not None:
        # frontend sends list[dict] with fields: layout, title, bullets, etc.
        presentation.content = data["content"]

    if "configuration" in data and data["configuration"] is not None:
        presentation.configuration = data["configuration"]

    db.commit()
    db.refresh(presentation)
    return presentation


@router.post(
    "/{presentation_id}/configure",
    response_model=PresentationOut,
    summary="Configure a presentation",
)
def configure_presentation(
    presentation_id: int,
    config: ConfigurationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update configuration (theme, etc.) for a PPT owned by the current user.
    """
    presentation = (
        db.query(Presentation)
        .filter(
            Presentation.presentation_id == presentation_id,
            Presentation.owner_id == current_user.id,
        )
        .first()
    )
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")

    presentation.configuration = config.dict()
    db.commit()
    db.refresh(presentation)
    return presentation


@router.get(
    "/{presentation_id}",
    response_model=PresentationOut,
    summary="Get a presentation",
)
def get_presentation(
    presentation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get a single PPT for the current user.
    """
    presentation = (
        db.query(Presentation)
        .filter(
            Presentation.presentation_id == presentation_id,
            Presentation.owner_id == current_user.id,
        )
        .first()
    )
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")
    return presentation


@router.put(
    "/{presentation_id}/slides/{slide_index}",
    response_model=PresentationOut,
    summary="Update a single slide in the presentation",
)
def update_slide(
    presentation_id: int,
    slide_index: int,
    slide_update: SlideUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Edit one slide (title/bullets/text/image) of a PPT owned by the current user.
    """
    presentation = (
        db.query(Presentation)
        .filter(
            Presentation.presentation_id == presentation_id,
            Presentation.owner_id == current_user.id,
        )
        .first()
    )
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")

    slides = presentation.content or []
    if slide_index < 0 or slide_index >= len(slides):
        raise HTTPException(status_code=404, detail="Slide index out of range")

    slide = slides[slide_index]
    update_data = slide_update.dict(exclude_unset=True)

    # Only overwrite fields that are provided in the request
    for key, value in update_data.items():
        if value is not None:
            slide[key] = value

    slides[slide_index] = slide
    presentation.content = slides
    db.commit()
    db.refresh(presentation)
    return presentation


@router.get(
    "/{presentation_id}/download",
    summary="Download the generated PPTX",
)
def download_pptx(
    presentation_id: int,
    db: Session = Depends(get_db),
):
    """
    Generate & download the PPTX file for a presentation by its ID.

    ⚠ Dev-friendly version:
       - No auth required
       - No owner check
    """

    # Look up by ID only (no owner_id filter)
    presentation = (
        db.query(Presentation)
        .filter(Presentation.presentation_id == presentation_id)
        .first()
    )
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")

    # Generate PPTX with current configuration + current content
    config = presentation.configuration or {}
    pptx_path = build_pptx(
        presentation.presentation_id,
        presentation.content,
        config,
    )
    presentation.pptx_path = pptx_path
    db.commit()

    return FileResponse(
        path=pptx_path,
        filename=f"presentation_{presentation.presentation_id}.pptx",
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
    )
