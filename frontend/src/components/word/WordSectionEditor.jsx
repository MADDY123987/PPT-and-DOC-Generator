// src/components/word/WordSectionEditor.jsx
import React, { useState, useEffect } from "react";

const DEFAULT_PROMPT =
  "Make this more concise and formal, around 150 words.";

function WordSectionEditor({
  section,
  onRefine,
  onFeedback,
  onUpdateContent, // <-- NEW: parent can persist edited content
}) {
  // fixed default prompt (you can later make this editable if you want)
  const [prompt] = useState(DEFAULT_PROMPT);

  const [reaction, setReaction] = useState(section.reaction || null); // "like" | "dislike" | null
  const [comment, setComment] = useState(section.comment || "");
  const [feedbackStatus, setFeedbackStatus] = useState(
    "Feedback not saved yet"
  );

  // local editable copy of section body
  const [body, setBody] = useState(section.content || "");

  // if parent reloads section from server, sync into local state
  useEffect(() => {
    setBody(section.content || "");
  }, [section.id, section.content]);

  const handleReactionClick = (type) => {
    const next = reaction === type ? null : type; // toggle
    setReaction(next);

    if (onFeedback) {
      onFeedback(section.id, { reaction: next, comment });
      setFeedbackStatus("Feedback saved");
    } else {
      setFeedbackStatus("Feedback stored locally");
    }
  };

  const handleCommentBlur = () => {
    if (onFeedback) {
      onFeedback(section.id, { reaction, comment });
      setFeedbackStatus("Feedback saved");
    } else {
      setFeedbackStatus("Feedback stored locally");
    }
  };

  const handleBodyBlur = () => {
    // tell parent that the section text changed (for saving to DB)
    if (onUpdateContent) {
      onUpdateContent(section.id, body);
    }
  };

  const handleRefineClick = () => {
    if (!onRefine) return;

    // we pass the current edited body so backend refines THIS text
    // parent can ignore third argument if it doesn’t need it
    onRefine(section.id, prompt, body);
  };

  return (
    <div className="word-section-card">
      {/* Header row */}
      <div className="word-section-header">
        <span className="word-section-badge">
          Section {section.order_index}
        </span>
        <span className="word-section-title">
          {section.title || "Section title"}
        </span>
      </div>

      {/* Editable content box */}
      <div className="word-section-preview">
        <div className="wsp-title">
          {section.title || "Section Title"}
        </div>

        {/* THIS is now editable */}
        <textarea
          className="wsp-body-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={handleBodyBlur}
          rows={6}
          placeholder="Generated content will appear here"
        />
      </div>

      {/* Feedback block: like / dislike / comment */}
      <div className="word-feedback-row">
        <div className="word-feedback-buttons">
          <button
            type="button"
            className={
              reaction === "like"
                ? "word-feedback-btn active"
                : "word-feedback-btn"
            }
            onClick={() => handleReactionClick("like")}
          >
            👍 Like
          </button>
          <button
            type="button"
            className={
              reaction === "dislike"
                ? "word-feedback-btn active"
                : "word-feedback-btn"
            }
            onClick={() => handleReactionClick("dislike")}
          >
            👎 Dislike
          </button>

          <span className="word-feedback-status">{feedbackStatus}</span>
        </div>

        <textarea
          className="word-feedback-comment"
          placeholder="Add a comment or note for this section (saved automatically)…"
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={handleCommentBlur}
        />
      </div>

      {/* Footer action */}
      <div className="word-section-footer">
        <button className="word-refine-btn" onClick={handleRefineClick}>
          💡 Refine Section
        </button>
      </div>
    </div>
  );
}

export default WordSectionEditor;
