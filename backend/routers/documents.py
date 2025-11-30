from typing import List, Dict
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import logging

from core.dbutils import get_db
from .auth_bridge import get_current_user

from models import models, schemas, enums
from services.content_generator import (
    generate_word_sections_with_gemini,
    refine_word_section_with_gemini,
)
from services.docx_generator import build_docx_file

logger = logging.getLogger(__name__)

# Make sure router exists BEFORE any @router decorators
router = APIRouter(tags=["Documents"])


@router.post("/", response_model=schemas.ProjectOut)
def create_word_project(
    project_in: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Create a new Word (.docx) project and generate initial content.

    NOTE: we return a plain JSON-friendly dict (not raw ORM object) so the frontend
    always receives 'sections' as a flat list with page_number / order_index.
    """
    if project_in.doc_type != enums.DocumentType.DOCX:
        raise HTTPException(
            status_code=400,
            detail="doc_type must be 'docx' for this endpoint",
        )

    # ---- Create project row ----
    project = models.Project(
        owner_id=current_user.id,
        title=project_in.title,
        topic=project_in.topic,
        doc_type=project_in.doc_type,
        num_pages=project_in.num_pages,
    )
    db.add(project)
    db.flush()  # assign project.id for FK use

    # helper to build response later
    def build_response_dict(proj_id: int):
        # query sections for this project (ordered)
        secs = (
            db.query(models.Section)
            .filter(models.Section.project_id == proj_id)
            .order_by(
                models.Section.page_number,
                models.Section.section_index,
                models.Section.order_index,
            )
            .all()
        )

        sections_list = []
        for s in secs:
            sections_list.append(
                {
                    "id": s.id,
                    # ProjectOut / frontend expects 'title' for each section
                    "title": s.title,
                    # keep 'heading' as alias for backward compatibility if needed
                    "heading": s.title,
                    "content": s.content or "",
                    "page_number": s.page_number or 1,
                    "order_index": s.order_index or 0,
                }
            )

        return {
            "id": proj_id,
            "title": project.title,
            "topic": project.topic,
            # include doc_type field (matches schemas.ProjectOut)
            "doc_type": project.doc_type,
            "num_pages": project.num_pages or 1,
            "sections": sections_list,
            # frontend expects a download endpoint; use full API path
            "download_url": f"/api/v1/documents/{proj_id}/export",
        }

    try:
        # 1️⃣ NEW PAGE-BASED MODE (pages provided)
        if project_in.pages and project_in.num_pages:
            flat_headings: List[str] = []
            for page_cfg in sorted(project_in.pages, key=lambda p: p.page_number):
                for title in page_cfg.sections:
                    flat_headings.append(title)

            generated_sections = generate_word_sections_with_gemini(
                topic=project_in.topic,
                section_headings=flat_headings,
            )

            content_by_heading: Dict[str, str] = {
                s.get("heading", s.get("title")): s.get("content", "") for s in generated_sections
            }

            global_order_index = 1
            for page_cfg in sorted(project_in.pages, key=lambda p: p.page_number):
                page_number = page_cfg.page_number
                # keep up to 3 per page or whatever your UI expects
                section_titles = page_cfg.sections[:3]

                for idx, title in enumerate(section_titles, start=1):
                    content = content_by_heading.get(title, "") or ""

                    if not content.strip():
                        content = refine_word_section_with_gemini(
                            topic=project_in.topic,
                            heading=title,
                            current_content="",
                            instruction="Write a clear, professional section for this heading.",
                        )

                    section = models.Section(
                        project_id=project.id,
                        title=title,
                        order_index=global_order_index,
                        page_number=page_number,
                        section_index=idx,
                        content=content,
                        history=[
                            {
                                "version": 1,
                                "content": content,
                                "prompt": "initial generation",
                            }
                        ],
                    )
                    db.add(section)
                    global_order_index += 1

            db.commit()
            db.refresh(project)
            return build_response_dict(project.id)

        # 2️⃣ OLD FLAT SECTION MODE
        sorted_sections = sorted(project_in.sections, key=lambda s: s.order_index)
        headings = [s.title for s in sorted_sections]

        generated_sections = generate_word_sections_with_gemini(
            topic=project_in.topic,
            section_headings=headings,
        )

        content_by_heading = {s.get("heading", s.get("title")): s.get("content", "") for s in generated_sections}

        sections_db: List[models.Section] = []
        for section_in in sorted_sections:
            content = content_by_heading.get(section_in.title, "") or ""

            if not content.strip():
                content = refine_word_section_with_gemini(
                    topic=project_in.topic,
                    heading=section_in.title,
                    current_content="",
                    instruction="Write a clear, professional section for this heading.",
                )

            section = models.Section(
                project_id=project.id,
                title=section_in.title,
                order_index=section_in.order_index,
                content=content,
                # default page_number/section_index left as null or 1
            )
            db.add(section)
            sections_db.append(section)

        db.commit()
        db.refresh(project)

        return build_response_dict(project.id)

    except Exception as e:
        db.rollback()
        logger.exception("Failed creating project: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}", response_model=schemas.ProjectOut)
def get_word_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Fetch a single Word project with all its sections.
    We return a JSON-friendly dict (same shape as create route).
    """
    project = (
        db.query(models.Project)
        .filter(
            models.Project.id == project_id,
            models.Project.owner_id == current_user.id,
        )
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Build same response shape as create endpoint
    secs = (
        db.query(models.Section)
        .filter(models.Section.project_id == project.id)
        .order_by(
            models.Section.page_number,
            models.Section.section_index,
            models.Section.order_index,
        )
        .all()
    )

    sections_list = []
    for s in secs:
        sections_list.append(
            {
                "id": s.id,
                # ProjectOut expects 'title'
                "title": s.title,
                # keep heading as alias for backward compatibility
                "heading": s.title,
                "content": s.content or "",
                "page_number": s.page_number or 1,
                "order_index": s.order_index or 0,
            }
        )

    return {
        "id": project.id,
        "title": project.title,
        "topic": project.topic,
        "doc_type": project.doc_type,
        "num_pages": project.num_pages or 1,
        "sections": sections_list,
        "download_url": f"/api/v1/documents/{project.id}/export",
    }


# -----------------------
# Export endpoint (DOCX)
# -----------------------
@router.get("/{project_id}/export")
def export_word_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Build a .docx from DB sections and return as FileResponse.
    This reads sections from DB (so it always uses persisted content, not request payload).
    """
    # fetch project & permission check
    project = (
        db.query(models.Project)
        .filter(models.Project.id == project_id, models.Project.owner_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # fetch sections (ordered)
    secs = (
        db.query(models.Section)
        .filter(models.Section.project_id == project.id)
        .order_by(
            models.Section.page_number,
            models.Section.section_index,
            models.Section.order_index,
        )
        .all()
    )

    # convert to simple list of dicts expected by docx helper
    sections = []
    for s in secs:
        sections.append({
            "heading": s.title,
            "content": s.content or "",
            # keep numeric page info if present; docx helper will distribute if missing
            "page_number": s.page_number or None,
            "order_index": s.order_index or 0,
        })

    # import helpers from docx generator
    try:
        from services.docx_generator import distribute_sections_across_pages, build_docx_file
    except Exception:
        logger.exception("Failed importing docx generator helpers")
        raise HTTPException(status_code=500, detail="Server misconfiguration")

    # Ensure num_pages has a reasonable fallback
    num_pages = project.num_pages if project.num_pages and project.num_pages > 0 else 1
    pages = distribute_sections_across_pages(sections, num_pages)

    # debug: log per-page content lengths
    try:
        page_debug = {p: [len(s.get("content", "")) for s in secs] for p, secs in pages.items()}
        logger.debug("Export pages for project %s: %s", project.id, page_debug)
    except Exception:
        pass

    try:
        file_path = build_docx_file(project.id, project.title, pages)
    except Exception as e:
        logger.exception("Failed building docx file: %s", e)
        raise HTTPException(status_code=500, detail="Failed generating DOCX")

    # Return the file to the user
    try:
        return FileResponse(
            path=str(file_path),
            filename=file_path.name,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    except Exception as e:
        logger.exception("Failed returning FileResponse: %s", e)
        raise HTTPException(status_code=500, detail="Failed returning DOCX file")
