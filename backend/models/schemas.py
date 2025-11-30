from pydantic import BaseModel, Field, field_validator
import re
from typing import Optional, List, Dict, Union
from models.enums import SlideLayout, DocumentType  


# ---------------------- PPT SCHEMAS ----------------------

class TitleSlide(BaseModel):
    layout: SlideLayout
    title: str


class BulletSlide(BaseModel):
    layout: SlideLayout
    title: str
    bullets: List[str]


class TwoColumnSlide(BaseModel):
    layout: SlideLayout
    title: str
    left: str
    right: str


class ImageSlide(BaseModel):
    layout: SlideLayout
    title: str
    image_url: str


SlideContent = Union[TitleSlide, BulletSlide, TwoColumnSlide, ImageSlide]


class PresentationCreate(BaseModel):
    topic: str
    num_slides: Optional[int] = Field(
        default=5, ge=1, le=20, description="Number of slides (min 1, max 20)"
    )
    custom_content: Optional[List[SlideContent]] = None


# ---- Styling / configuration ----

# Extended to support the fonts we use in themes
ALLOWED_FONTS = {
    "Arial",
    "Calibri",
    "Times New Roman",
    "Segoe UI",
    "Poppins",
}

HEX_COLOR_REGEX = re.compile(r"^#(?:[0-9a-fA-F]{3}){1,2}$")


class ConfigurationUpdate(BaseModel):
    """
    Configuration for presentation styling.

    theme_id is used to pick a PPT template (ppt1, ppt2, ...)
    The other fields are optional extras you can still use if needed.
    """
    theme_id: Optional[str] = None
    font_name: Optional[str] = None
    font_color: Optional[str] = None
    background_color: Optional[str] = None
    accent_color: Optional[str] = None

    @field_validator("font_name")
    def validate_font(cls, v):
        if v and v not in ALLOWED_FONTS:
            raise ValueError(
                f"Font '{v}' is not supported. Allowed fonts: {', '.join(ALLOWED_FONTS)}"
            )
        return v

    @field_validator("font_color")
    def validate_font_color(cls, v):
        if v and not HEX_COLOR_REGEX.match(v):
            raise ValueError(
                f"Font color '{v}' is not a valid hex color (e.g., #RRGGBB)"
            )
        return v

    @field_validator("background_color")
    def validate_background_color(cls, v):
        if v and not HEX_COLOR_REGEX.match(v):
            raise ValueError(
                f"Background color '{v}' is not a valid hex color (e.g., #RRGGBB)"
            )
        return v

    @field_validator("accent_color")
    def validate_accent_color(cls, v):
        if v and not HEX_COLOR_REGEX.match(v):
            raise ValueError(
                f"Accent color '{v}' is not a valid hex color (e.g., #RRGGBB)"
            )
        return v


class PresentationOut(BaseModel):
    presentation_id: int
    topic: str
    content: List[SlideContent]
    configuration: Optional[Dict]

    class Config:
        orm_mode = True


# ------------------------------------------------------------------
# 👇 WORD (.DOCX) SCHEMAS – PROJECT / PAGES / SECTIONS
# ------------------------------------------------------------------

class SectionBase(BaseModel):
    title: str
    order_index: int
    content: Optional[str] = ""
    # NEW: page + section index on that page (1–3)
    page_number: Optional[int] = None
    section_index: Optional[int] = None


class SectionCreate(SectionBase):
    """Used when creating a new Word project with sections."""
    pass


class SectionOut(SectionBase):
    id: int
    feedback: Optional[str] = None
    comment: Optional[str] = None

    class Config:
        orm_mode = True


# NEW: config for one page → its section headings
class PageSectionConfig(BaseModel):
    page_number: int
    # list of section titles for this page (up to 3 in UI)
    sections: List[str]


class ProjectBase(BaseModel):
    title: str
    topic: str
    doc_type: DocumentType   # "docx" or "pptx"


class ProjectCreate(ProjectBase):
    """
    For Word projects:
    - Existing simple mode: 'sections' list (flat).
    - New advanced mode: 'pages' + 'num_pages' for page-wise layout.
    Both are optional so we don't break old code.
    """
    sections: List[SectionCreate] = []
    num_pages: Optional[int] = None
    pages: Optional[List[PageSectionConfig]] = None


class ProjectOut(ProjectBase):
    id: int
    sections: List[SectionOut]

    class Config:
        orm_mode = True


class SectionRefineRequest(BaseModel):
    """Body for refining a single section (used in /refine endpoint)."""
    prompt: str


class SectionFeedbackRequest(BaseModel):
    """Body for like/dislike + comment on a section."""
    feedback: str   # e.g., "like" or "dislike"
    comment: Optional[str] = None
