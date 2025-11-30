import React from "react";
import SlideEditor from "./SlideEditor";
import "./slide-editor.css";

export default function SlideGenerator({
  presentation,
  presentationId,
  loading,
  themeName,
  setThemeName,
  PPT_THEMES = {},
  onThumbError = () => {},
  renderThumbSrc = () => "/mnt/data/fallback.png",
  onLocalChange = () => {},
  onSaveSlide = () => {},
  onApplyTheme = () => {},
  onReset = () => {},
  downloadUrl = null,
}) {
  if (!presentation) {
    return (
      <div className="card ppt-step-card">
        <h3>Slides will appear here after generation</h3>
        <p className="meta-line">Generate a presentation from the editor above. After generation you'll be able to review slides, apply a theme and export as PPTX.</p>
      </div>
    );
  }

  return (
    <>
      <div className="card ppt-step-card">
        <h3>2️⃣ Review & Edit Slides</h3>
        <p className="meta-line" style={{ color: "#9ca3af", marginBottom: 8 }}>
          <strong>Presentation ID:</strong> {presentation.presentation_id || presentationId || "local"} • <strong>Topic:</strong> {presentation.topic || "—"}
        </p>

        {loading && <p style={{ color: "#9ca3af" }}>Loading slides…</p>}

        <div className="slides-list">
          {Array.isArray(presentation.content) && presentation.content.length > 0 ? (
            presentation.content.map((slide, idx) => (
              <div className="slide-item" key={idx}>
                <SlideEditor
                  index={idx}
                  slide={slide}
                  presentationId={presentationId}
                  onLocalChange={(i, updated) => onLocalChange(i, updated)}
                  onSave={(i, payload) => onSaveSlide(i, payload)}
                />
              </div>
            ))
          ) : (
            <div style={{ padding: 12, color: "#9ca3af" }}>No slides present in this presentation (empty content array).</div>
          )}
        </div>
      </div>

      <div className="card ppt-step-card">
        <h3>3️⃣ Pick PPT Design Theme</h3>
        <p className="card-caption" style={{ color: "#9ca3af" }}>Apply one of your predefined themes — backend will handle colors, fonts and layout tweaks.</p>

        <div style={{ color: "#cbd5e1", fontSize: 12, marginBottom: 8 }}>Loaded themes: {Object.keys(PPT_THEMES).length}</div>

        <div className="field-grid" style={{ alignItems: "flex-start" }}>
          <div className="theme-picker-grid" role="list">
            {Object.keys(PPT_THEMES).map((name) => {
              const meta = PPT_THEMES[name];
              return (
                <button
                  key={name}
                  type="button"
                  className={`theme-thumb ${themeName === name ? "selected" : ""}`}
                  onClick={() => setThemeName(name)}
                  aria-pressed={themeName === name}
                  title={name}
                >
                  <img src={renderThumbSrc(meta)} alt={`${name} preview`} onError={onThumbError} />
                  <div className="theme-thumb-label">{name}</div>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 6 }}>Selected theme preview</div>
            <div className="theme-preview-large">
              <img
                src={(PPT_THEMES[themeName] && (PPT_THEMES[themeName].preview || PPT_THEMES[themeName].thumb)) || renderThumbSrc()}
                alt="Selected theme preview"
                onError={onThumbError}
              />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button className="secondary-action" onClick={onApplyTheme} disabled={loading || !presentationId}>
            {loading ? "Applying..." : "Apply Design Theme"}
          </button>
          <button className="secondary-action" onClick={onReset}>🔄 Start over</button>
        </div>
      </div>

      <div className="card ppt-step-card">
        <h3>4️⃣ Export</h3>
        {downloadUrl ? (
          <>
            <button className="export-button" onClick={() => window.open(downloadUrl, "_blank")}>⬇️ Export PPTX</button>
            <button className="secondary-action" style={{ marginLeft: 8 }} onClick={onReset}>🔄 Start over</button>
          </>
        ) : (
          <p style={{ color: "#9ca3af" }}>Generate slides first to get a download link.</p>
        )}
      </div>
    </>
  );
}
