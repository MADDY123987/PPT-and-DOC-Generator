// src/components/word/WordGenerator.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { BASE_URL } from "../../config";
import WordSectionEditor from "./WordSectionEditor";
import "./WordGenerator.css"; // ⬅️ styles

function WordGenerator() {
  const [docTitle, setDocTitle] = useState("");
  const [docTopic, setDocTopic] = useState("");
  const [numPages, setNumPages] = useState(2);

  const [sections, setSections] = useState([
    { id: 1, title: "", orderIndex: 1 },
  ]);

  const [wordProjectId, setWordProjectId] = useState(null);
  const [wordDoc, setWordDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 🔥 UI mode: editing | generating | generated
  const [mode, setMode] = useState("editing");

  // 👇 same idea as Dashboard.jsx
  const getAuthHeaders = () => {
    const token = localStorage.getItem("authToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const addSection = () => {
    const nextOrder = sections.length + 1;
    setSections([
      ...sections,
      { id: nextOrder, title: "", orderIndex: nextOrder },
    ]);
  };

  const updateSectionTitle = (id, value) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: value } : s))
    );
  };

  const handleGenerateWord = async () => {
    setError("");

    if (!docTitle.trim() || !docTopic.trim()) {
      setError("Please fill in both Document Title and Topic/Prompt.");
      return;
    }

    const sectionsPayload = sections.map((s, idx) => ({
      title: s.title.trim() || `Section ${idx + 1}`,
      order_index: idx + 1,
    }));

    const payload = {
      title: docTitle.trim(),
      topic: docTopic.trim(),
      doc_type: "docx",
      num_pages: Number(numPages),
      sections: sectionsPayload,
    };

    try {
      setMode("generating");
      setLoading(true);
      window.scrollTo({ top: 0, behavior: "smooth" });

      // ⬇️ IMPORTANT: add / at end AND auth header
      const res = await axios.post(`${BASE_URL}/documents/`, payload, {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });

      setWordProjectId(res.data.id);
      setWordDoc(res.data);
      setMode("generated");
    } catch (err) {
      console.error(err);
      // avoid [object Object]
      const backendMsg =
        err.response?.data?.detail ??
        (typeof err.response?.data === "string"
          ? err.response.data
          : null);
      setError(backendMsg || "Error generating document.");
      setMode("editing");
    } finally {
      setLoading(false);
    }
  };

  // Fetch document details when wordProjectId changes
  useEffect(() => {
    if (!wordProjectId) return;

    const fetchDoc = async () => {
      try {
        setLoading(true);
        const res = await axios.get(
          `${BASE_URL}/documents/${wordProjectId}`,
          {
            headers: {
              Accept: "application/json",
              ...getAuthHeaders(),
            },
          }
        );
        setWordDoc(res.data);
        setMode("generated");
      } catch (err) {
        console.error(err);
        setError("Error loading document details.");
        setMode("editing");
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
  }, [wordProjectId]);

  const handleRefineSection = async (sectionId, prompt) => {
    try {
      setLoading(true);

      await axios.post(
        `${BASE_URL}/documents/${wordProjectId}/sections/${sectionId}/refine`,
        { prompt: prompt || "Improve clarity and structure." },
        {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        }
      );

      const res = await axios.get(
        `${BASE_URL}/documents/${wordProjectId}`,
        {
          headers: {
            Accept: "application/json",
            ...getAuthHeaders(),
          },
        }
      );
      setWordDoc(res.data);
      alert("Refinement applied!");
    } catch (err) {
      console.error(err);
      alert("Error refining section.");
    } finally {
      setLoading(false);
    }
  };

  const downloadUrl = wordProjectId
    ? `${BASE_URL}/documents/${wordProjectId}/export`
    : null;

  // 🔁 Start over: reset everything
  const handleReset = () => {
    setDocTitle("");
    setDocTopic("");
    setNumPages(2);
    setSections([{ id: 1, title: "", orderIndex: 1 }]);
    setWordProjectId(null);
    setWordDoc(null);
    setError("");
    setMode("editing");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className="page page-narrow word-page">
      {/* header inside page (always visible) */}
      <header className="word-page-header">
        <div>
          <h2>📄 AI Word Document Generator</h2>
          <p className="page-subtitle">
            Configure pages & sections, let the AI draft content, refine with
            prompts, then export to .docx.
          </p>
        </div>
        <div className="word-badge">DOCX Studio</div>
      </header>

      {/* CARD 1: CONFIG → only in editing mode */}
      {mode === "editing" && (
        <div className="card">
          <h3>1️⃣ Configure Document</h3>
          <p className="card-caption">
            Set up the title, topic and high-level sections. The AI will expand
            them into full pages.
          </p>

          <div className="field-grid">
            <label>
              Document Title
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="e.g. Business Strategy Report 2025"
              />
            </label>

            <label>
              Number of Section
              <input
                type="number"
                min={1}
                max={20}
                value={numPages}
                onChange={(e) => setNumPages(e.target.value)}
              />
            </label>
          </div>

          {/* MAGIC PROMPT BOX */}
          <label className="prompt-label">
            Document Topic / Prompt
            <div className="prompt-box">
              <div className="prompt-header">
                <span className="prompt-pill">✨ Magic Prompt</span>
                <span className="prompt-hint">
                  Describe what the document should cover. AI will expand it.
                </span>
              </div>

              <textarea
                className="prompt-textarea"
                rows={4}
                value={docTopic}
                onChange={(e) => setDocTopic(e.target.value)}
                placeholder="Ex: Create a 2-page report on how generative AI can help college students prepare presentations faster..."
              />

              <div className="prompt-footer">
                <span className="prompt-counter">
                  {docTopic.length} characters
                </span>
                <button
                  type="button"
                  className="prompt-idea-btn"
                  onClick={() =>
                    setDocTopic(
                      "Write a concise overview of our startup's AI-powered presentation tool, including target audience, key features, benefits for students and businesses, and future roadmap."
                    )
                  }
                  disabled={loading || mode === "generating"}
                >
                  ⚡ Suggest sample prompt
                </button>
              </div>
            </div>
          </label>

          <p className="hint">
            Sections are linear. The backend still controls the exact page
            split.
          </p>

          <div className="sections-config">
            <h4>Sections</h4>
            {sections.map((sec) => (
              <div key={sec.id} className="section-row">
                <span>#{sec.orderIndex}</span>
                <input
                  type="text"
                  placeholder={`Section ${sec.orderIndex} title (optional)`}
                  value={sec.title}
                  onChange={(e) => updateSectionTitle(sec.id, e.target.value)}
                />
              </div>
            ))}
            <button type="button" className="ghost-pill" onClick={addSection}>
              ➕ Add Section
            </button>
          </div>

          <button
            className="primary-action"
            onClick={handleGenerateWord}
            disabled={loading || mode === "generating"}
          >
            {mode === "generating" ? "Generating..." : "Generate Word Document"}
          </button>

          {error && <p className="error">{String(error)}</p>}
        </div>
      )}

      {/* While generating: clean progress card */}
      {mode === "generating" && (
        <div className="card">
          <h3>2️⃣ Creating your document…</h3>
          <p className="card-caption">
            Give it a moment while we turn your topic and sections into a full
            draft.
          </p>
        </div>
      )}

      {/* CARD 2 + 3 → only in generated mode */}
      {wordDoc && mode === "generated" && (
        <>
          <div className="card">
            <h3>2️⃣ Review & Refine Sections</h3>
            <p className="meta-line">
              <strong>Project ID:</strong> {wordDoc.id} •{" "}
              <strong>Pages:</strong> {wordDoc.num_pages}
            </p>

            {wordDoc.sections?.map((section) => (
              <WordSectionEditor
                key={section.id}
                section={section}
                onRefine={handleRefineSection}
              />
            ))}
          </div>

          <div className="card">
            <h3>3️⃣ Export Word Document</h3>
            {downloadUrl ? (
              <>
                <button
                  className="export-button"
                  onClick={() => window.open(downloadUrl, "_blank")}
                >
                  ⬇️ Export DOCX
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
              <p>Generate the document first to get a download link.</p>
            )}
          </div>
        </>
      )}

      {/* Marketing / features / usecases / FAQ → only in editing mode */}
      {mode === "editing" && (
        <>
          <section className="word-marketing">
            {/* Feature 1: From prompt to draft */}
            <div className="word-feature-row">
              <div className="word-feature-media">
                <div className="word-feature-media-card">
                  <span className="word-feature-icon">📑</span>
                  <p>Drop in your main “document drafting” illustration here.</p>
                </div>
              </div>
              <div className="word-feature-copy">
                <h3>From Prompt to Polished Draft</h3>
                <p>
                  Start with a title, topic and page count. DOCX Studio expands
                  your idea into a full draft with intro, body and conclusion,
                  so you aren&apos;t staring at a blank page.
                </p>
                <ul className="word-feature-list">
                  <li>Great for reports, assignments, and internal docs.</li>
                  <li>Keeps tone and structure consistent across pages.</li>
                </ul>
              </div>
            </div>

            {/* Feature 2: Section-wise control */}
            <div className="word-feature-row word-feature-row--reverse">
              <div className="word-feature-media">
                <div className="word-feature-media-card word-feature-media-card--soft">
                  <span className="word-feature-icon">🧩</span>
                  <p>Use this card for a “sections / blocks” style visual.</p>
                </div>
              </div>
              <div className="word-feature-copy">
                <h3>Section-Wise Control & Refinement</h3>
                <p>
                  Each heading becomes its own section. Read, edit, or send
                  refine prompts like “more formal”, “shorter summary” or
                  “explain for beginners” without touching the rest of the
                  document.
                </p>
                <ul className="word-feature-list">
                  <li>Regenerate or improve one section at a time.</li>
                  <li>Export the final version as a clean .docx file.</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="word-usecases">
            <h3>Where DOCX Studio shines</h3>
            <div className="word-usecases-grid">
              <div className="usecase-item">
                <span className="usecase-icon">🎓</span>
                <h4>Students</h4>
                <p>
                  Create drafts for lab reports, essays, and project summaries
                  in a few clicks.
                </p>
              </div>
              <div className="usecase-item">
                <span className="usecase-icon">👔</span>
                <h4>Hiring & HR</h4>
                <p>
                  Generate job descriptions, role summaries, and candidate
                  feedback notes.
                </p>
              </div>
              <div className="usecase-item">
                <span className="usecase-icon">⚖️</span>
                <h4>Legal & Policy Teams</h4>
                <p>
                  Turn bullet-point inputs into structured drafts you can review
                  and edit.
                </p>
              </div>
              <div className="usecase-item">
                <span className="usecase-icon">📊</span>
                <h4>Business & Sales</h4>
                <p>
                  Draft proposals, strategy docs, and internal briefs faster
                  than ever.
                </p>
              </div>
              <div className="usecase-item">
                <span className="usecase-icon">🌍</span>
                <h4>Researchers & Travelers</h4>
                <p>
                  Summarise notes, interviews, or travel logs into clean,
                  shareable docs.
                </p>
              </div>
            </div>
          </section>

          <section className="word-faq">
            <h3>FAQs</h3>
            <div className="word-faq-grid">
              <div className="faq-item">
                <h4>What can I generate with the Word Document Generator?</h4>
                <p>
                  Anything that fits into a structured document: reports, study
                  notes, proposals, guides, and more. You control the title,
                  sections, and length.
                </p>
              </div>
              <div className="faq-item">
                <h4>Can I edit the content after it&apos;s generated?</h4>
                <p>
                  Yes. Review each section, make manual edits, or send refine
                  prompts to improve clarity, tone, or level of detail.
                </p>
              </div>
              <div className="faq-item">
                <h4>Does it support multiple languages?</h4>
                <p>
                  The generator is powered by modern language models, so it can
                  draft in many major languages as long as your prompt is clear.
                </p>
              </div>
              <div className="faq-item">
                <h4>Is there a limit on pages or sections?</h4>
                <p>
                  You choose the page count and can add multiple sections. For
                  very long documents, it&apos;s usually best to split work into
                  several projects.
                </p>
              </div>
              <div className="faq-item">
                <h4>Can I export to .docx?</h4>
                <p>
                  Yes, once you&apos;re happy with the content, export a Word
                  (.docx) file that you can open and format further in your
                  editor.
                </p>
              </div>
              <div className="faq-item">
                <h4>Will more features be added later?</h4>
                <p>
                  The DOCX Studio is built to grow. Future updates can include
                  richer formatting controls and more analysis tools for long
                  documents and the improviosion will never end.
                </p>
              </div>
            </div>
          </section>
        </>
      )}
    </section>
  );
}

export default WordGenerator;
