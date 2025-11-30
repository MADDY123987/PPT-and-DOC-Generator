# backend/services/content_generator.py
import logging
import json
import re
from typing import List, Dict, Any, Optional

import google.generativeai as genai

from core.config import Config
from models import enums

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # adjust as needed

# ---------------- Gemini Setup ----------------
# ensure Config.GEMINI_API_KEY exists and is non-empty
if not getattr(Config, "GEMINI_API_KEY", None):
    logger.error("GEMINI_API_KEY is not set in Config or environment. Word generation may fail.")
# Use exact attribute (no GEMMINI typo)
genai.configure(api_key=Config.GEMINI_API_KEY)

# One shared model used by PPT + DOCX helpers
model = genai.GenerativeModel("gemini-2.0-flash")


# ---------------------
# Helpers
# ---------------------
def _get_raw_text_from_resp(resp) -> str:
    """
    Try multiple ways to extract textual content from the model response object.
    Some SDKs put data in resp.text, resp.output, or repr(resp) contains content.
    """
    try:
        raw = getattr(resp, "text", None)
        if raw:
            return str(raw)
    except Exception:
        pass

    try:
        raw = getattr(resp, "output", None)
        if raw:
            return str(raw)
    except Exception:
        pass

    try:
        return str(resp)
    except Exception:
        return ""


def _safe_parse_model_json(resp_text: str) -> Optional[Any]:
    """
    Try multiple strategies to obtain JSON from resp_text:
      1) direct json.loads(resp_text)
      2) strip triple-backtick fences and try again
      3) find first JSON-array/object substring using regex and parse it
    Return parsed object or None.
    """
    if not resp_text:
        return None

    # 1) direct attempt
    try:
        return json.loads(resp_text)
    except Exception:
        pass

    # 2) strip triple-backtick fences and try again
    try:
        cleaned = re.sub(r"```(?:json)?", "", resp_text).strip()
        return json.loads(cleaned)
    except Exception:
        pass

    # 3) find first JSON array/object substring
    try:
        m = re.search(r"(\[.*\]|\{.*\})", resp_text, flags=re.DOTALL)
        if m:
            candidate = m.group(1)
            return json.loads(candidate)
    except Exception as e:
        logger.warning("JSON substring parse failed: %s -- raw start: %.400s", e, resp_text)

    logger.warning("Failed to parse any JSON from model output (len=%d).", len(resp_text))
    return None


def _plain_text_to_sections_by_headings(raw: str, headings: List[str]) -> List[Dict[str, Any]]:
    """
    Look for each heading in raw text and capture the block after it until next heading.
    If not found, take sequential paragraphs.
    """
    out = []
    text = (raw or "").replace("\r\n", "\n").replace("\r", "\n")

    # Normalize whitespace for easier matching
    norm_text = text

    for h in headings:
        # Try to find heading on its own line and grab following block up to next heading or double newline
        pattern = re.compile(
            rf"(?:^|\n){re.escape(h)}\s*\n(.*?)(?=(?:\n\S|\Z))",
            flags=re.DOTALL | re.IGNORECASE,
        )
        m = pattern.search(norm_text)
        if m:
            content = m.group(1).strip()
            content = re.sub(r"\n\s*\n+", "\n\n", content).strip()
            out.append({"heading": h, "order_index": len(out) + 1, "content": content})
        else:
            out.append({"heading": h, "order_index": len(out) + 1, "content": ""})

    # If all empty, try to split raw into paragraphs and assign sequentially
    if all(not s["content"].strip() for s in out):
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n+", text) if p.strip()]
        if paragraphs:
            for i, s in enumerate(out):
                s["content"] = paragraphs[i] if i < len(paragraphs) else ""
    return out


def _fallback_generate_sections(topic: str, section_headings: List[str], target_sections: int) -> List[Dict[str, Any]]:
    """
    Create simple fallback sections if Gemini call fails.
    - If section_headings provided, use them.
    - Otherwise generate generic headings.
    """
    out = []
    if section_headings:
        headings = section_headings[:max(1, len(section_headings))]
    else:
        headings = [f"Section {i+1}" for i in range(target_sections)]

    for idx, h in enumerate(headings[:target_sections]):
        content = (
            f"{h}\n\n"
            "This is fallback auto-generated content. The AI service was unavailable or returned an"
            " unexpected response. Replace this with a proper draft or try generating again.\n\n"
            "Key points:\n- Outline 1\n- Outline 2\n- Practical example or implication."
        )
        out.append({"heading": h, "order_index": idx + 1, "content": content})
    return out


# -------------------------------------------------------
# 1️⃣ PPT CONTENT GENERATION  (with normalization)
# -------------------------------------------------------
def generate_content_with_gemini(topic: str, num_slides: int) -> List[Dict[str, Any]]:
    """
    Generate PPT slide content for a topic using Gemini and normalize
    the output into our SlideContent schema.
    (Kept behavior same; only improved raw extraction when reading resp)
    """
    prompt = f"""
You are an expert presentation designer and educator.

Goal:
Create a highly engaging, logically structured PowerPoint deck on the topic "{topic}" with EXACTLY {num_slides} slides.

Audience:
Beginner to intermediate learners who want clear explanations and practical insights.

Overall flow of the presentation:
- Start with a strong, clear introduction.
- Then explain the core concepts step by step.
- Include practical examples / use-cases.
- Highlight benefits AND challenges / limitations.
- End with a concise summary and call-to-action or next steps.

Content & layout rules:
1. Slide 1 MUST be a pure title slide introducing the topic (no bullets, just a strong title).
2. Slide {num_slides} MUST be a summary / conclusion / call-to-action slide.
3. Other slides should mix these layouts intelligently:
   - Use "title" layout for big section headers or key messages.
   - Use "bullet" layout to explain concepts, lists, pros/cons, or step-by-step flows.
   - Use "two_column" layout for comparisons (Before vs After, Pros vs Cons, Concept vs Example, Theory vs Practice, etc.).
   - Use "image" layout when a diagram / workflow / architecture / chart would help.
4. Avoid repeating the same sentence or idea across different slides.
5. For bullet slides:
   - Use between 3 and 6 bullet points.
   - Each bullet should be an informative sentence, roughly 12–25 words.
   - Do NOT use one-word bullets. Every bullet must carry real information.
6. For two_column slides:
   - The "left" side should focus on explanation, definitions or theory.
   - The "right" side should focus on examples, comparisons, pros/cons, or practical implications.
7. For image slides:
   - Focus on writing a good, descriptive CAPTION (10–30 words) for the image.
   - The backend will choose the actual image URL.
8. Use simple, modern, professional English. No fluff, no marketing buzzwords.
9. Wherever useful, include:
   - Real-world examples
   - Mini use-cases
   - Short scenarios or analogies
10. Do NOT write things like "This slide explains..." or mention "PowerPoint" or "slide" inside the content.

Output format:
Return ONLY a JSON array (no markdown, no backticks, no extra commentary).
"""
    try:
        resp = model.generate_content(prompt)
        raw = _get_raw_text_from_resp(resp)
        json_clean = re.sub(r"```json|```", "", raw).strip()
        data = _safe_parse_model_json(json_clean)

        if not isinstance(data, list):
            raise RuntimeError(f"Model returned {type(data)}; expected list")

        normalized_slides: List[Dict[str, Any]] = []

        for idx, slide in enumerate(data):
            if not isinstance(slide, dict):
                continue

            # If already in our layout format, keep as-is (with cleanup)
            if "layout" in slide:
                layout = slide.get("layout")
                if layout == enums.SlideLayout.title.value or layout == "title":
                    normalized_slides.append(
                        {
                            "layout": enums.SlideLayout.title.value,
                            "title": slide.get("title", ""),
                        }
                    )
                elif layout == enums.SlideLayout.bullet.value or layout == "bullet":
                    normalized_slides.append(
                        {
                            "layout": enums.SlideLayout.bullet.value,
                            "title": slide.get("title", ""),
                            "bullets": slide.get("bullets") or [],
                        }
                    )
                elif layout == enums.SlideLayout.two_column.value or layout == "two_column":
                    normalized_slides.append(
                        {
                            "layout": enums.SlideLayout.two_column.value,
                            "title": slide.get("title", ""),
                            "left": slide.get("left", ""),
                            "right": slide.get("right", ""),
                        }
                    )
                elif layout == enums.SlideLayout.image.value or layout == "image":
                    normalized_slides.append(
                        {
                            "layout": enums.SlideLayout.image.value,
                            "title": slide.get("title", ""),
                            "caption": slide.get("caption", slide.get("title", "")),
                        }
                    )
                continue

            # Fallback: Gemini generic format -> our layouts
            title = slide.get("title", "")
            content = slide.get("content")
            image = slide.get("image")
            notes = slide.get("notes")

            # List of bullet-like strings → Bullet slide
            if isinstance(content, list):
                bullets = [str(b).strip() for b in content if str(b).strip()]
                normalized_slides.append(
                    {
                        "layout": enums.SlideLayout.bullet.value,
                        "title": title,
                        "bullets": bullets,
                    }
                )
            # Has image description → Image slide
            elif image:
                normalized_slides.append(
                    {
                        "layout": enums.SlideLayout.image.value,
                        "title": title,
                        "caption": notes or str(image),
                    }
                )
            else:
                # Default to title slide
                normalized_slides.append(
                    {
                        "layout": enums.SlideLayout.title.value,
                        "title": title,
                    }
                )

        # Ensure we have exactly num_slides slides
        if len(normalized_slides) < num_slides:
            for i in range(len(normalized_slides), num_slides):
                normalized_slides.append(
                    {
                        "layout": enums.SlideLayout.title.value,
                        "title": f"Slide {i + 1}",
                    }
                )
        elif len(normalized_slides) > num_slides:
            normalized_slides = normalized_slides[:num_slides]

        # Ensure image slides have caption + image_url
        for idx, s in enumerate(normalized_slides):
            if s.get("layout") == enums.SlideLayout.image.value or s.get("layout") == "image":
                if not s.get("caption") or not isinstance(s.get("caption"), str):
                    s["caption"] = (s.get("title", "") or "")[:120]

                seed = re.sub(r"[^a-zA-Z0-9]", "", f"{topic}_{idx}") or f"slide_{idx}"
                s["image_url"] = f"https://picsum.photos/seed/{seed}/1200/800"

        return normalized_slides

    except Exception as e:
        logger.exception("Gemini PPT content generation failed: %s", e)
        raise RuntimeError("Gemini content generation failed")


# -------------------------------------------------------
# 2️⃣ WORD (.DOCX) CONTENT GENERATION – UPDATED (robust)
# -------------------------------------------------------
def generate_word_sections_with_gemini(
    topic: str,
    section_headings: List[str],
    num_pages: int = 1,
    sections_per_page: int = None,
) -> List[Dict[str, Any]]:
    """
    Generate initial content for a Word document.

    Robust: logs model outputs and falls back to safe placeholders if model fails.
    """
    # Determine how many sections we should generate if no headings supplied
    if not section_headings:
        if sections_per_page and sections_per_page > 0:
            target_sections = max(1, int(num_pages) * int(sections_per_page))
        else:
            target_sections = max(1, int(num_pages) if num_pages > 0 else 1)
    else:
        target_sections = max(1, len(section_headings))

    try:
        if not section_headings:
            prompt = f"""
You are an expert business writer. MAIN TOPIC: {topic}

The user did NOT provide section headings. Propose exactly {target_sections} concise subtopic headings (each 3-6 words)
that together form a logical document flow for the MAIN TOPIC. For each proposed heading, write substantive
content of ~200-350 words (about 2-4 short paragraphs). The content must be information-dense with relevant examples
or practical implications where helpful.

STRICT OUTPUT (JSON array only):
Return a JSON array of {target_sections} objects exactly like:
[
  {{
    "heading": "Proposed heading 1",
    "order_index": 1,
    "content": "Paragraph1\\nParagraph2\\nParagraph3"
  }},
  ...
]
"""
        else:
            headings_str = "\n".join(f"- {h}" for h in section_headings)
            prompt = f"""
You are an expert business writer creating a professional Word document.

MAIN TOPIC:
{topic}

The document will have the following SECTIONS (in this exact order):
{headings_str}

For EACH heading, write substantial content: target ~200-350 words per heading (roughly 2–4 short paragraphs).
Do NOT output headings again; return a JSON array of objects like:

[
  {{
    "heading": "Exactly one heading from the provided list",
    "order_index": <1-based index>,
    "content": "Paragraph1\\nParagraph2"
  }},
  ...
]
"""

        logger.debug("Calling Gemini for word sections (topic=%s target=%d)", topic, target_sections)
        resp = model.generate_content(prompt)
        raw_text = _get_raw_text_from_resp(resp)
        logger.debug("Gemini raw response (len=%d): %.3000s", len(raw_text), raw_text)

        sections = _safe_parse_model_json(raw_text)
        if not isinstance(sections, list):
            logger.warning("Gemini returned non-list or unparsable JSON. Attempting plain-text extraction.")
            if section_headings:
                sections = _plain_text_to_sections_by_headings(raw_text, section_headings)
            else:
                paras = [p.strip() for p in re.split(r"\n\s*\n+", raw_text) if p.strip()]
                sections = [
                    {"heading": f"Section {i+1}", "order_index": i + 1, "content": paras[i] if i < len(paras) else ""}
                    for i in range(target_sections)
                ]

        # If still not a list, fall back
        if not isinstance(sections, list):
            logger.error("Final sections is not a list after parsing attempts; using fallback generator.")
            return _fallback_generate_sections(topic, section_headings, target_sections)

    except Exception as e:
        logger.exception("Gemini Word content generation (initial) failed: %s", e)
        return _fallback_generate_sections(topic, section_headings, target_sections)

    # --- normalize & sanitize sections (defensive) ---
    cleaned_sections: List[Dict[str, Any]] = []
    try:
        for s in sections:
            if not isinstance(s, dict):
                continue
            heading = s.get("heading", "") or ""
            order_index = int(s.get("order_index") or 0)
            content = s.get("content", "") or ""
            # Convert escaped '\n' into real newlines and normalise whitespace
            content = content.replace("\\n", "\n").replace("\r\n", "\n").replace("\r", "\n").strip()
            # Remove common "Page" or "Section" prefixes
            content = re.sub(r"^(Page|page)\s*\d+\s*[-–]\s*(Section|section)\s*\d+\s*\n*", "", content)
            content = re.sub(r"^(Section|section)\s*\d+\s*[:\-]\s*", "", content)
            first_line, *rest = content.split("\n", 1)
            if first_line.strip() == topic.strip() or first_line.strip() == heading.strip():
                content = rest[0] if rest else ""
            cleaned_sections.append({
                "heading": heading,
                "order_index": order_index,
                "content": content.strip()
            })
    except Exception as e:
        logger.exception("Error while normalizing Gemini output: %s", e)
        return _fallback_generate_sections(topic, section_headings, target_sections)

    # Ensure order_index present & consistent
    for idx, s in enumerate(cleaned_sections):
        if not s.get("order_index"):
            s["order_index"] = idx + 1

    cleaned_sections.sort(key=lambda x: x["order_index"])

    # Expand short sections (best-effort)
    final_sections: List[Dict[str, Any]] = []
    for s in cleaned_sections:
        content = s.get("content", "") or ""
        word_count = len(re.findall(r"\w+", content))
        if word_count < 40:
            try:
                expand_prompt = f"""
You previously provided a short draft for this section.

Main topic: {topic}
Section heading: {s['heading']}

Current text:
\"\"\"{content}\"\"\" 

Please expand and rewrite this section to be more substantial:
- Target roughly 200-300 words, 2-4 short paragraphs.
- Keep the meaning, add examples or practical points.
- Output plain text only with '\\n' between paragraphs.
"""
                resp2 = model.generate_content(expand_prompt)
                expanded_raw = _get_raw_text_from_resp(resp2)
                expanded = re.sub(r"```json|```", "", expanded_raw).strip()
                expanded = expanded.replace("\\n", "\n").strip()
                if len(re.findall(r"\w+", expanded)) > word_count:
                    s["content"] = expanded
            except Exception as e:
                logger.warning("Failed to expand short section '%s': %s", s.get("heading"), e)
        final_sections.append(s)

    # If model returned fewer sections than expected, pad with fallback
    if len(final_sections) < target_sections:
        logger.warning("Model returned %d sections but %d expected. Padding with fallback.", len(final_sections), target_sections)
        missing = target_sections - len(final_sections)
        extra = _fallback_generate_sections(topic, [], missing)
        current_len = len(final_sections)
        for i, e in enumerate(extra):
            e["order_index"] = current_len + i + 1
            final_sections.append(e)

    # Trim to target_sections if too many
    if len(final_sections) > target_sections:
        final_sections = final_sections[:target_sections]

    return final_sections


def refine_word_section_with_gemini(
    topic: str,
    heading: str,
    current_content: str,
    instruction: str,
) -> str:
    """
    Refine a single section; fail-safe: if Gemini fails, return current_content.
    """
    prompt = f"""
You are revising ONE section of a professional business Word document.

Main topic: {topic}
Section heading: {heading}

Current section content:
\"\"\"{current_content}\"\"\" 

User refinement instruction:
\"\"\"{instruction}\"\"\" 

Rewrite ONLY this section according to the instruction.

Rules:
- Keep meaning and key information intact.
- Apply the user's style/length instructions carefully.
- Output plain text only.
- Use '\\n' for paragraph breaks.
- Do NOT add the heading, section numbers, or any meta commentary.
"""
    try:
        resp = model.generate_content(prompt)
        raw = _get_raw_text_from_resp(resp)
        refined = re.sub(r"```json|```", "", raw).strip()
        refined = refined.replace("\\n", "\n").strip()
        return refined
    except Exception as e:
        logger.exception("Gemini Word refinement failed for heading '%s': %s", heading, e)
        # fallback: return original content unchanged (so UX doesn't break)
        return current_content
