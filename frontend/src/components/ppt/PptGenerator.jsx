import React, { useEffect, useState } from "react";
import axios from "axios";
import { BASE_URL, PPT_THEMES } from "../../config";
import SlideEditor from "./SlideEditor";
import "./ppt.css";

console.log("PPT_THEMES keys =", Object.keys(PPT_THEMES));
const SAMPLE_IMAGE_PATH = "/mnt/data/cf6a33ff-d0bc-4e56-89d7-6a9513516d8a.png";

function PptGenerator() {
  const [topic, setTopic] = useState("");
  const [numSlides, setNumSlides] = useState(5);
  const [presentationId, setPresentationId] = useState(null);
  const [presentation, setPresentation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [themeName, setThemeName] = useState(Object.keys(PPT_THEMES)[0] || "");
  const [error, setError] = useState("");
  const [mode, setMode] = useState("editing"); // "editing" | "generating" | "generated"

  const getAuthHeaders = () => {
    const token = localStorage.getItem("authToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    if (!presentationId) return;

    const fetchPresentation = async () => {
      try {
        setLoading(true);
        const res = await axios.get(
          `${BASE_URL}/presentations/${presentationId}`,
          { headers: getAuthHeaders() }
        );
        const data = res.data;
        if (data?.content && Array.isArray(data.content)) {
          data.content = data.content.map((s) => {
            if (s.layout === "image" && !s.image_url) {
              return { ...s, image_url: SAMPLE_IMAGE_PATH };
            }
            return s;
          });
        }
        setPresentation(data);
        setMode("generated");
      } catch (err) {
        console.error(err);
        setError("Error loading presentation details.");
        setMode("editing");
      } finally {
        setLoading(false);
      }
    };

    fetchPresentation();
  }, [presentationId]);

  const handleGenerateSlides = async () => {
    setError("");
    if (!topic.trim()) {
      setError("Please enter a topic / prompt for the slides.");
      return;
    }

    try {
      setMode("generating");
      setLoading(true);
      window.scrollTo({ top: 0, behavior: "smooth" });

      const payload = { topic: topic.trim(), num_slides: Number(numSlides) };
      const res = await axios.post(`${BASE_URL}/presentations/`, payload, {
        headers: getAuthHeaders(),
      });

      setPresentationId(res.data.presentation_id);

      const pres = res.data;
      if (pres?.content && Array.isArray(pres.content)) {
        pres.content = pres.content.map((s) =>
          s.layout === "image" && !s.image_url
            ? { ...s, image_url: SAMPLE_IMAGE_PATH }
            : s
        );
      }
      setPresentation(pres);
      setMode("generated");
    } catch (err) {
      console.error(err);
      setError(
        (err.response && err.response.data) ||
          "Error generating slides. Check backend logs."
      );
      setMode("editing");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSlide = async (idx, updatedSlide) => {
    if (!presentationId) return;

    try {
      setLoading(true);
      const currentSlide =
        presentation?.content && presentation.content[idx]
          ? presentation.content[idx]
          : {};

      const payload = {
        ...currentSlide,
        ...updatedSlide,
      };

      await axios.put(
        `${BASE_URL}/presentations/${presentationId}/slides/${idx}`,
        payload,
        { headers: getAuthHeaders() }
      );

      const res = await axios.get(
        `${BASE_URL}/presentations/${presentationId}`,
        { headers: getAuthHeaders() }
      );
      setPresentation(res.data);

      try {
        if (window?.toastr && typeof window.toastr.success === "function") {
          window.toastr.success(`Slide ${idx + 1} updated!`);
        } else {
          alert(`Slide ${idx + 1} updated!`);
        }
      } catch {
        // ignore
      }
    } catch (err) {
      console.error(err);
      alert("Error updating slide. Check console / backend.");
    } finally {
      setLoading(false);
    }
  };

  const handleLocalSlideChange = (idx, updatedSlide) => {
    setPresentation((prev) => {
      if (!prev) return prev;
      const content = Array.isArray(prev.content) ? [...prev.content] : [];
      content[idx] = { ...(content[idx] || {}), ...updatedSlide };
      return { ...prev, content };
    });
  };

  const handleApplyTheme = async () => {
    if (!presentationId) {
      alert("Generate a presentation first to apply a theme.");
      return;
    }

    const themeMeta = PPT_THEMES[themeName];
    if (!themeMeta || !themeMeta.theme_id) {
      alert("Invalid theme selection.");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        theme_id: themeMeta.theme_id,
        preview_used: themeMeta.preview || themeMeta.thumb || null,
      };

      await axios.post(
        `${BASE_URL}/presentations/${presentationId}/configure`,
        payload,
        { headers: getAuthHeaders() }
      );

      const res = await axios.get(
        `${BASE_URL}/presentations/${presentationId}`,
        { headers: getAuthHeaders() }
      );
      setPresentation(res.data);

      alert("Design applied successfully!");
    } catch (err) {
      console.error(err);
      alert("Error applying design theme.");
    } finally {
      setLoading(false);
    }
  };

  const downloadUrl = presentationId
    ? `${BASE_URL}/presentations/${presentationId}/download`
    : null;

  const handleReset = () => {
    setTopic("");
    setNumSlides(5);
    setPresentationId(null);
    setPresentation(null);
    setThemeName(Object.keys(PPT_THEMES)[0] || "");
    setError("");
    setMode("editing");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderThumbSrc = (meta) => {
    if (!meta) return SAMPLE_IMAGE_PATH;
    return meta.thumb || meta.preview || SAMPLE_IMAGE_PATH;
  };

  const onThumbError = (e) => {
    e.currentTarget.onerror = null;
    e.currentTarget.src = SAMPLE_IMAGE_PATH;
  };

  return (
    <section className="page page-narrow ppt-page">
      <section className="ppt-hero">
        <div className="ppt-hero-text">
          <div className="ppt-hero-chip">AI Presentation</div>
          <h1 className="ppt-hero-title">Fast and Smart AI Presentation Agent</h1>
          <p className="ppt-hero-subtitle">— create slides in seconds.</p>
          <p className="ppt-hero-description">
            Describe what you want for your slides and our agent will turn your
            idea into a complete deck, ready to present or download as PPTX.
          </p>

          <div className="ppt-hero-prompt">
            <label className="ppt-hero-label">
              Describe what you want for your slides
            </label>

            <textarea
              className="ppt-hero-textarea"
              rows={6}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder='Ex: Create slides on "How AI helps students build better presentations", including intro, benefits, workflow, risks and conclusion.'
              aria-label="Slide prompt"
            />

            <div className="ppt-hero-footer">
              <div className="ppt-hero-footer-left">
                <label className="ppt-hero-small-label">
                  Number of slides
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={numSlides}
                    onChange={(e) => setNumSlides(e.target.value)}
                  />
                </label>
                <span className="ppt-hero-counter">
                  {topic.length} characters
                </span>
              </div>

              <div className="ppt-hero-footer-right">
                <button
                  type="button"
                  className="ppt-hero-idea-btn"
                  onClick={() =>
                    setTopic(
                      "Create a 6-slide deck pitching our AI-powered PPT + DOC generator for university students, covering problem, solution, key features, tech stack, demo flow, and next steps."
                    )
                  }
                  disabled={loading || mode === "generating"}
                >
                  ⚡ Use sample prompt
                </button>
                <button
                  className="ppt-hero-generate-btn"
                  onClick={handleGenerateSlides}
                  disabled={loading || mode === "generating"}
                >
                  {mode === "generating"
                    ? "Generating..."
                    : "Generate presentation"}
                </button>
              </div>
            </div>

            {error && <p className="error ppt-hero-error">{String(error)}</p>}
          </div>
        </div>

        <div className="ppt-hero-visual">
          <div className="ppt-hero-visual-card">
            <div className="ppt-hero-visual-icon">📽️</div>
            <p className="ppt-hero-visual-text">
              Drop in your own hero illustration or screenshot here.
            </p>
          </div>
        </div>
      </section>

      {mode === "editing" && (
        <section className="ppt-info">
          <div className="ppt-fast-row">
            <div className="ppt-fast-media">
              <div className="ppt-fast-card">
                <div className="ppt-fast-icon">🖥️</div>
                <p className="ppt-fast-card-text">
                  Use this block for a hero screenshot or slide preview.
                </p>
              </div>
            </div>

            <div className="ppt-fast-copy">
              <h2>Create slide decks faster with AI</h2>
              <p>
                Turn a single prompt into a full PPTX: slide titles, bullet
                points, and layouts ready to customise. Perfect for class decks,
                startup pitches and quick idea presentations.
              </p>
              <ul className="ppt-fast-list">
                <li>Structured slide outline from one detailed prompt.</li>
                <li>
                  Clean layouts with space for charts, screenshots, and images
                  you'll drop in later.
                </li>
                <li>Works with your own design themes and export-ready PPTX.</li>
              </ul>
            </div>
          </div>

          <section className="ppt-steps">
            <h3>How the PPTX Studio works</h3>
            <p className="ppt-steps-subtitle">
              Your slide workflow in a few clear steps.
            </p>

            <div className="ppt-steps-grid">
              <div className="ppt-step-card">
                <div className="ppt-step-number">1</div>
                <h4>Describe your topic</h4>
                <p>
                  Type a detailed prompt and choose how many slides you need.
                  The more context you give, the better the deck.
                </p>
              </div>

              <div className="ppt-step-card">
                <div className="ppt-step-number">2</div>
                <h4>AI drafts the outline</h4>
                <p>
                  The agent creates slide titles and bullet points, turning your
                  idea into a full deck structure automatically.
                </p>
              </div>

              <div className="ppt-step-card">
                <div className="ppt-step-number">3</div>
                <h4>Review & edit slides</h4>
                <p>
                  Tweak wording, add notes, or remove slides. Each slide can be
                  edited before you lock in the design.
                </p>
              </div>

              <div className="ppt-step-card">
                <div className="ppt-step-number">4</div>
                <h4>Apply a design theme</h4>
                <p>
                  Pick one of your themes. Colors, fonts and layout tweaks are
                  applied on the backend to style the whole deck.
                </p>
              </div>

              <div className="ppt-step-card">
                <div className="ppt-step-number">5</div>
                <h4>Export PPTX</h4>
                <p>
                  Download a ready-to-present PPTX file. Open it in PowerPoint
                  or Google Slides and drop in final images or charts.
                </p>
              </div>
            </div>
          </section>
        </section>
      )}

      {mode === "generating" && (
        <div className="card ppt-step-card">
          <h3>2️⃣ Creating your presentation…</h3>
          <p className="card-caption">
            Give it a moment while we turn your topic into a full slide deck.
          </p>
        </div>
      )}

      {presentation && mode === "generated" && (
        <>
          <div className="card ppt-step-card">
            <h3>2️⃣ Review & Edit Slides</h3>
            <p className="meta-line">
              <strong>Presentation ID:</strong>{" "}
              {presentation.presentation_id} • <strong>Topic:</strong>{" "}
              {presentation.topic}
            </p>

            {loading && <p>Loading slides...</p>}

            {/* === UPDATED: slides-list now contains .slide-item wrappers for grid layout === */}
            <div className="slides-list">
              {presentation.content?.map((slide, idx) => (
                <div className="slide-item" key={idx}>
                  <SlideEditor
                    index={idx}
                    slide={slide}
                    presentationId={presentationId}
                    onLocalChange={(i, updated) =>
                      handleLocalSlideChange(i, updated)
                    }
                    onSave={(i, payload) => handleSaveSlide(i, payload)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="card ppt-step-card">
            <h3>3️⃣ Pick PPT Design Theme</h3>
            <p className="card-caption">
              Apply one of your predefined themes. Backend will handle colors,
              fonts and layout tweaks.
            </p>

            <div
              style={{ color: "#cbd5e1", fontSize: 12, marginBottom: 4 }}
            >
              Loaded themes: {Object.keys(PPT_THEMES).length}
            </div>

            <div className="field-grid" style={{ alignItems: "flex-start" }}>
              <div className="theme-picker-grid" role="list">
                {Object.keys(PPT_THEMES).map((name) => {
                  const meta = PPT_THEMES[name];
                  return (
                    <button
                      key={name}
                      type="button"
                      className={`theme-thumb ${
                        themeName === name ? "selected" : ""
                      }`}
                      onClick={() => setThemeName(name)}
                      aria-pressed={themeName === name}
                      title={name}
                    >
                      <img
                        src={renderThumbSrc(meta)}
                        alt={`${name} preview`}
                        onError={onThumbError}
                        aria-hidden="false"
                      />
                      <div className="theme-thumb-label">{name}</div>
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 12 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: "#cbd5e1",
                    marginBottom: 6,
                  }}
                >
                  Selected theme preview
                </div>
                <div className="theme-preview-large">
                  <img
                    src={
                      (PPT_THEMES[themeName] &&
                        (PPT_THEMES[themeName].preview ||
                          PPT_THEMES[themeName].thumb)) ||
                      SAMPLE_IMAGE_PATH
                    }
                    alt="Selected theme preview"
                    onError={onThumbError}
                  />
                </div>
              </div>
            </div>

            <button
              className="secondary-action"
              onClick={handleApplyTheme}
              disabled={loading || !presentationId}
              title={
                presentationId
                  ? "Apply selected theme"
                  : "Generate presentation first"
              }
            >
              {loading ? "Applying..." : "Apply Design Theme"}
            </button>
          </div>

          <div className="card ppt-step-card">
            <h3>4️⃣ Export </h3>
            {downloadUrl ? (
              <>
                <button
                  className="export-button"
                  onClick={() => window.open(downloadUrl, "_blank")}
                >
                  ⬇️ Export PPTX
                </button>
                <button
                  className="secondary-action"
                  style={{ marginLeft: "8px" }}
                  onClick={handleReset}
                >
                  🔄 Start over
                </button>
              </>
            ) : (
              <p>Generate slides first to get a download link.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default PptGenerator;
