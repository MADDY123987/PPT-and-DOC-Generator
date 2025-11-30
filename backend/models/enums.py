from enum import Enum

class SlideLayout(str, Enum):
    title = "title"
    bullet = "bullet"
    two_column = "two_column"
    image = "image"

class DocumentType(str, Enum):
    DOCX = "docx"
    PPTX = "pptx"
