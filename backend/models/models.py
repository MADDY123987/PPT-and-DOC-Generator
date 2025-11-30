from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, ForeignKey
from core.dbutils import Base
from sqlalchemy.orm import declarative_mixin, relationship
from datetime import datetime
from models.enums import DocumentType


@declarative_mixin
class Timestamp:
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        nullable=False,
    )


# ------------------- PRESENTATION MODEL (PPT) -------------------
class Presentation(Timestamp, Base):
    __tablename__ = "presentations"

    presentation_id = Column(Integer, primary_key=True, autoincrement=True)

    # link PPT to your local User
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    topic = Column(String)
    content = Column(JSON)
    configuration = Column(JSON, nullable=True)
    pptx_path = Column(String, nullable=True)

    # relationship back to User
    owner = relationship("User", back_populates="presentations")


# ---------------------- USER MODEL ----------------------
class User(Timestamp, Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)

    # all Word/docx projects of this user
    projects = relationship(
        "Project",
        back_populates="owner",
        cascade="all, delete",
    )

    # all PPT presentations of this user
    presentations = relationship(
        "Presentation",
        back_populates="owner",
        cascade="all, delete",
    )


# ---------------------- PROJECT MODEL (DOCX) ----------------------
class Project(Timestamp, Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)

    # link doc project to User
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String, nullable=False)
    topic = Column(Text, nullable=False)
    doc_type = Column(String, nullable=False)   # "docx" or "pptx"

    # total number of pages for this Word document (optional for old data)
    num_pages = Column(Integer, nullable=True)

    owner = relationship("User", back_populates="projects")
    sections = relationship(
        "Section",
        back_populates="project",
        cascade="all, delete",
    )


# ---------------------- SECTION MODEL ----------------------
class Section(Timestamp, Base):
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    title = Column(String, nullable=False)
    order_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=True)
    feedback = Column(String, nullable=True)
    comment = Column(Text, nullable=True)
    history = Column(JSON, nullable=True)

    # page-wise positioning
    # page_number: which page this section belongs to (1-based)
    page_number = Column(Integer, nullable=True)
    # section_index: position within that page (1–3)
    section_index = Column(Integer, nullable=True)

    project = relationship("Project", back_populates="sections")
