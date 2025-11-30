// src/components/ppt/SlideEditor.jsx
import React, { useEffect, useState } from "react";
import "./slide-editor.css";

export default function SlideEditor({
  index = 0,
  slide = {},
  presentationId,
  onLocalChange = () => {},
  onSave = () => {},
}) {
  const [title, setTitle] = useState(slide.title || "");
  const [bulletsText, setBulletsText] = useState((slide.bullets || []).join("\n"));

  useEffect(() => {
    setTitle(slide.title || "");
    setBulletsText((slide.bullets || []).join("\n"));
  }, [slide]);

  const handleLocal = (patch) => onLocalChange(index, patch);

  // Tab inserts two spaces inside bullets textarea (instead of moving focus)
  const handleBulletsKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.target;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const insert = "  ";
      const newValue = el.value.substring(0, start) + insert + el.value.substring(end);
      setBulletsText(newValue);
      handleLocal({ bullets: newValue.split("\n").map(s => s) }); // do not trim here
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + insert.length;
      });
    }
  };

  const handleSave = () => {
    const payload = {
      ...slide,
      title: (title || "").trim(), // trim only on save
      bullets: (bulletsText || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    onSave(index, payload);
  };

  const handleRevert = () => {
    setTitle(slide.title || "");
    setBulletsText((slide.bullets || []).join("\n"));
    onLocalChange(index, slide);
  };

  return (
    <div className="slide-editor-card" style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <strong style={{ color: "#e5e7eb" }}>Slide {index + 1}</strong>
        <small style={{ color: "#9ca3af" }}>{(slide.layout || "text").toUpperCase()}</small>
      </div>

      <div style={{ marginTop: 8 }}>
        <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#cbd5e1" }}>Title</label>
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); handleLocal({ title: e.target.value }); }}
          placeholder="Slide title"
          style={{
            width: "100%", padding: 8, borderRadius: 8, border: "1px solid #1f2937",
            background: "#020617", color: "#e5e7eb", caretColor: "#eef2ff", outline: "none", boxSizing: "border-box"
          }}
        />
      </div>

      <div style={{ marginTop: 10 }}>
        <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#cbd5e1" }}>Bullets (one per line)</label>
        <textarea
          rows={4}
          wrap="soft"
          value={bulletsText}
          onKeyDown={handleBulletsKeyDown}
          onChange={(e) => {
            setBulletsText(e.target.value);
            // update local but DO NOT trim user text; preserve spaces while typing
            handleLocal({ bullets: e.target.value.split("\n").map(s => s) });
          }}
          placeholder="First bullet\nSecond bullet\n..."
          style={{
            width: "100%", padding: 8, borderRadius: 8, border: "1px solid #1f2937",
            background: "#020617", color: "#e5e7eb", caretColor: "#eef2ff", outline: "none",
            boxSizing: "border-box", whiteSpace: "pre-wrap", lineHeight: 1.45, resize: "vertical"
          }}
        />
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <button
          onClick={handleSave}
          style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #4f46e5", background: "#4f46e5", color: "#fff", cursor: "pointer" }}
        >
          Save
        </button>

        <button
          onClick={handleRevert}
          style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #374151", background: "transparent", color: "#e5e7eb", cursor: "pointer" }}
        >
          Revert
        </button>

        <div style={{ marginLeft: "auto", alignSelf: "center", color: "#9ca3af", fontSize: 12 }}>
          {presentationId ? `ID: ${presentationId}` : "Local"}
        </div>
      </div>
    </div>
  );
}
