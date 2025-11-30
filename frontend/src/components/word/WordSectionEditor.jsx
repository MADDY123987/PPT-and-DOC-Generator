import React, { useEffect, useState, useRef, useCallback } from "react";
import PropTypes from "prop-types";

/**
 * WordSectionEditor (keeps autosave + refine flows)
 *
 * Props:
 * - section: { id, order_index, title, content, reaction, comment }
 * - onRefine(sectionId, prompt, body)
 * - onFeedback(sectionId, { reaction, comment })
 * - onUpdateContent(sectionId, body)
 */

const DEFAULT_PROMPT = "Make this more concise and formal, around 150 words.";
const AUTOSAVE_DEBOUNCE_MS = 900;
const SOFT_CHAR_LIMIT = 800;

export default function WordSectionEditor({
  section,
  onRefine,
  onFeedback,
  onUpdateContent,
}) {
  const [prompt] = useState(DEFAULT_PROMPT);

  // local editable copy
  const [body, setBody] = useState(section.content || "");
  const originalRef = useRef(section.content || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("Not saved");
  const [reaction, setReaction] = useState(section.reaction || null);
  const [comment, setComment] = useState(section.comment || "");
  const [refineLoading, setRefineLoading] = useState(false);
  const [refineError, setRefineError] = useState("");
  const autosaveTimer = useRef(null);
  const lastSavedAt = useRef(null);

  // sync when parent re-loads section
  useEffect(() => {
    setBody(section.content || "");
    originalRef.current = section.content || "";
    setReaction(section.reaction || null);
    setComment(section.comment || "");
    setSaveMessage("Not saved");
    lastSavedAt.current = null;
  }, [section.id, section.content, section.reaction, section.comment]);

  // Debounced autosave: call onUpdateContent after user stops typing
  useEffect(() => {
    if (!onUpdateContent) {
      setSaveMessage("Local edit (not persisted)");
      return;
    }

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);

    setIsSaving(true);
    setSaveMessage("Saving...");

    autosaveTimer.current = setTimeout(async () => {
      try {
        await Promise.resolve(onUpdateContent(section.id, body));
        lastSavedAt.current = new Date();
        setSaveMessage(lastSavedAt.current ? `Saved • ${lastSavedAt.current.toLocaleTimeString()}` : "Saved");
      } catch (err) {
        console.error("Autosave error:", err);
        setSaveMessage("Save failed");
      } finally {
        setIsSaving(false);
      }
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
    };
  }, [body, onUpdateContent, section.id]);

  const handleReactionClick = (type) => {
    const next = reaction === type ? null : type;
    setReaction(next);

    try {
      if (onFeedback) {
        onFeedback(section.id, { reaction: next, comment });
        setSaveMessage("Feedback saved");
      } else {
        setSaveMessage("Feedback (local)");
      }
    } catch (err) {
      console.error("onFeedback error:", err);
      setSaveMessage("Feedback failed");
    }
  };

  const handleCommentBlur = () => {
    try {
      if (onFeedback) {
        onFeedback(section.id, { reaction, comment });
        setSaveMessage("Feedback saved");
      } else {
        setSaveMessage("Feedback (local)");
      }
    } catch (err) {
      console.error("onFeedback error:", err);
      setSaveMessage("Feedback failed");
    }
  };

  const handleRefineClick = async () => {
    if (!onRefine) return;
    setRefineError("");
    setRefineLoading(true);

    try {
      // allow parent to refine current edited body (important)
      const result = onRefine(section.id, prompt, body);
      const maybe = await Promise.resolve(result);
      if (typeof maybe === "string") {
        setBody(maybe);
        if (onUpdateContent) {
          await Promise.resolve(onUpdateContent(section.id, maybe));
          lastSavedAt.current = new Date();
          setSaveMessage(`Saved • ${lastSavedAt.current.toLocaleTimeString()}`);
        }
      }
    } catch (err) {
      console.error("Refine error:", err);
      setRefineError(err?.message || "Refine failed");
    } finally {
      setRefineLoading(false);
    }
  };

  const handleRevert = () => {
    const original = originalRef.current || "";
    setBody(original);
    setSaveMessage("Reverted to original");
    if (onUpdateContent) {
      Promise.resolve(onUpdateContent(section.id, original))
        .then(() => {
          lastSavedAt.current = new Date();
          setSaveMessage(`Saved • ${lastSavedAt.current.toLocaleTimeString()}`);
        })
        .catch((e) => {
          console.error("Revert save failed", e);
          setSaveMessage("Revert save failed");
        });
    }
  };

  const handleKeyDown = useCallback(
    (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!refineLoading && body.trim()) handleRefineClick();
      }
    },
    [body, refineLoading]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const charCount = body.length;

  return (
    <article className="word-section-card" aria-labelledby={`section-title-${section.id}`}>
      <header className="word-section-header">
        <div>
          <span className="word-section-badge">Section {section.order_index}</span>
          <h3 id={`section-title-${section.id}`} className="word-section-title">{section.title || "Section title"}</h3>
        </div>

        <div className="word-section-meta" aria-hidden>
          <div className="save-meta">
            <span className="save-message" title={saveMessage}>{isSaving ? "Saving…" : saveMessage}</span>
          </div>
        </div>
      </header>

      <div className="word-section-preview">
        <div className="wsp-title">{section.title || "Section Title"}</div>

        <textarea
          className="wsp-body-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="Generated content will appear here"
          aria-label={`Edit content for section ${section.order_index}`}
        />

        <div className="wsp-footer-row">
          <div className="wsp-charcount" aria-live="polite">
            {charCount} chars {charCount > SOFT_CHAR_LIMIT ? "• Consider shortening" : ""}
          </div>

          <div className="wsp-actions">
            <button type="button" className="word-refine-btn" onClick={handleRefineClick} disabled={refineLoading || !body.trim()} aria-busy={refineLoading} title="Refine text (Ctrl/Cmd+Enter)">
              {refineLoading ? "Refining…" : "💡 Refine Section"}
            </button>

            <button type="button" className="word-revert-btn" onClick={handleRevert} title="Revert to original generated text">↺ Revert</button>
          </div>
        </div>

        {refineError && <div className="word-error" role="alert">{refineError}</div>}
      </div>

      <div className="word-feedback-row">
        <div className="word-feedback-buttons" role="group" aria-label="Feedback">
          <button type="button" className={reaction === "like" ? "word-feedback-btn active" : "word-feedback-btn"} onClick={() => handleReactionClick("like")} aria-pressed={reaction === "like"} title="Like">👍 Like</button>

          <button type="button" className={reaction === "dislike" ? "word-feedback-btn active" : "word-feedback-btn"} onClick={() => handleReactionClick("dislike")} aria-pressed={reaction === "dislike"} title="Dislike">👎 Dislike</button>

          <span className="word-feedback-status" aria-hidden>{/* spare */}</span>
        </div>

        <textarea className="word-feedback-comment" placeholder="Add a comment or note for this section (saved automatically)…" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} onBlur={handleCommentBlur} aria-label={`Comment for section ${section.order_index}`} />
      </div>
    </article>
  );
}

WordSectionEditor.propTypes = {
  section: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    order_index: PropTypes.number,
    title: PropTypes.string,
    content: PropTypes.string,
    reaction: PropTypes.oneOf(["like", "dislike", null]),
    comment: PropTypes.string,
  }).isRequired,
  onRefine: PropTypes.func,
  onFeedback: PropTypes.func,
  onUpdateContent: PropTypes.func,
};
