// src/components/word/WordGenerator.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { BASE_URL } from "../../config";
import WordSectionEditor from "./WordSectionEditor";
import "../../styles/WordGenerator.css";

/**
 * Simplified WordGenerator — sections-only mode
 *
 * - Removed pagesConfig and "sections per page" UI.
 * - UI is controlled only by numSections (single input box next to title).
 * - num_pages sent to backend is derived heuristically (ceil(numSections / 2))
 *   — backend still controls exact split; UI only sends hints.
 * - Keeps normalizeProject, auth header logic, refine & export flows.
 */

function WordGenerator() {
  const [docTitle, setDocTitle] = useState("");
  const [docTopic, setDocTopic] = useState("");

  // Sections-only controls
  const [numSections, setNumSections] = useState(2);
  const [sections, setSections] = useState([
    { id: 1, title: "", orderIndex: 1 },
    { id: 2, title: "", orderIndex: 2 },
  ]);

  const [wordProjectId, setWordProjectId] = useState(null);
  const [wordDoc, setWordDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [mode, setMode] = useState("editing"); // editing | generating | generated

  // Robust auth header getter (checks common keys + authUser)
  const getAuthHeaders = () => {
    const possibleKeys = ["authToken", "auth_token", "accessToken", "access_token", "token"];
    let token = null;
    for (const k of possibleKeys) {
      const v = localStorage.getItem(k);
      if (v) {
        token = v;
        break;
      }
    }
    if (!token) {
      const storedUser = localStorage.getItem("authUser");
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          token = parsed?.access_token || parsed?.token || parsed?.authToken || parsed?.accessToken || token || null;
        } catch (e) {
          // ignore
        }
      }
    }
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Keep sections array in sync with numSections
  useEffect(() => {
    const desired = Math.max(1, Number(numSections) || 1);
    setSections((prev) => {
      const copy = [...prev];
      while (copy.length < desired) {
        const nextOrder = copy.length + 1;
        copy.push({ id: nextOrder, title: "", orderIndex: nextOrder });
      }
      if (copy.length > desired) {
        return copy.slice(0, desired);
      }
      return copy;
    });
  }, [numSections]);

  const addSection = () => {
    setSections((prev) => {
      const nextOrder = prev.length + 1;
      setNumSections((n) => Math.max(1, n + 1));
      return [...prev, { id: nextOrder, title: "", orderIndex: nextOrder }];
    });
  };

  const removeSection = () => {
    setSections((prev) => {
      if (prev.length <= 1) return prev;
      setNumSections((n) => Math.max(1, n - 1));
      return prev.slice(0, -1);
    });
  };

  const updateSectionTitle = (id, value) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, title: value } : s)));
  };

  // normalize backend shape so frontend remains stable
  const normalizeProject = (project) => {
    if (!project) return project;
    const normalized = { ...project };
    normalized.num_pages = project.num_pages ?? project.numPages ?? 1;
    if (Array.isArray(project.sections)) {
      normalized.sections = project.sections.map((s, idx) => {
        const id = s.id ?? s.section_id ?? s._id ?? idx + 1;
        const order_index = s.order_index ?? s.orderIndex ?? s.order ?? s.section_index ?? idx + 1;
        const title = s.title ?? s.heading ?? s.name ?? `Section ${order_index}`;
        const content = s.content ?? s.body ?? s.text ?? "";
        const page_number = s.page_number ?? s.pageNumber ?? s.page ?? 1;
        return { id, order_index, title, content, page_number, reaction: s.reaction ?? null, comment: s.comment ?? null };
      });
    } else {
      normalized.sections = [];
    }
    return normalized;
  };

  // Heuristic for num_pages: backend still decides final split.
  // Using ceil(numSections / 2) as a simple hint (you can change).
  const deriveNumPages = (sectionsCount) => Math.max(1, Math.ceil((Number(sectionsCount) || 1) / 2));

  const handleGenerateWord = async () => {
    setError("");
    if (!docTitle.trim() || !docTopic.trim()) {
      setError("Please fill in both Document Title and Topic/Prompt.");
      return;
    }

    const totalDesired = Math.max(1, Number(numSections) || 1);
    const anyTitleProvided = sections.some((s) => s.title && s.title.trim());
    let sectionsPayload = [];

    if (anyTitleProvided) {
      const working = [...sections];
      while (working.length < totalDesired) {
        const nextOrder = working.length + 1;
        working.push({ id: nextOrder, title: "", orderIndex: nextOrder });
      }
      const truncated = working.slice(0, totalDesired);
      sectionsPayload = truncated.map((s, idx) => ({
        title: s.title.trim() || `Section ${idx + 1}`,
        order_index: idx + 1,
      }));
    } else {
      sectionsPayload = []; // let backend auto-propose headings
    }

    const payload = {
      title: docTitle.trim(),
      topic: docTopic.trim(),
      doc_type: "docx",
      num_pages: deriveNumPages(totalDesired),
      sections: sectionsPayload,
    };

    try {
      setMode("generating");
      setLoading(true);
      window.scrollTo({ top: 0, behavior: "smooth" });

      const res = await axios.post(`${BASE_URL}/documents/`, payload, {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });

      const normalized = normalizeProject(res.data);
      setWordProjectId(normalized.id);
      setWordDoc(normalized);
      setMode("generated");
    } catch (err) {
      console.error("Generate error:", err);
      const backendMsg =
        err.response?.data?.detail ??
        err.response?.data?.message ??
        (typeof err.response?.data === "string" ? err.response.data : null) ??
        err.message;
      setError(backendMsg || "Error generating document.");
      setMode("editing");
    } finally {
      setLoading(false);
    }
  };

  // fetch document details (normalize)
  useEffect(() => {
    if (!wordProjectId) return;
    const fetchDoc = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${BASE_URL}/documents/${wordProjectId}`, {
          headers: { Accept: "application/json", ...getAuthHeaders() },
        });
        const normalized = normalizeProject(res.data);
        setWordDoc(normalized);
        setMode("generated");
      } catch (err) {
        console.error("Fetch doc error:", err);
        setError("Error loading document details.");
        setMode("editing");
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordProjectId]);

  const handleRefineSection = async (sectionId, prompt) => {
    try {
      setLoading(true);
      await axios.post(
        `${BASE_URL}/documents/${wordProjectId}/sections/${sectionId}/refine`,
        { prompt: prompt || "Improve clarity and structure." },
        { headers: { "Content-Type": "application/json", ...getAuthHeaders() } }
      );

      const res = await axios.get(`${BASE_URL}/documents/${wordProjectId}`, {
        headers: { Accept: "application/json", ...getAuthHeaders() },
      });
      const normalized = normalizeProject(res.data);
      setWordDoc(normalized);
      alert("Refinement applied!");
    } catch (err) {
      console.error("Refine error:", err);
      alert("Error refining section. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const downloadUrl = wordProjectId ? `${BASE_URL}/documents/${wordProjectId}/export` : null;

  const handleReset = () => {
    setDocTitle("");
    setDocTopic("");
    setNumSections(2);
    setSections([{ id: 1, title: "", orderIndex: 1 }, { id: 2, title: "", orderIndex: 2 }]);
    setWordProjectId(null);
    setWordDoc(null);
    setError("");
    setMode("editing");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className="page page-narrow word-page">
      <header className="word-page-header">
        <div>
          <h2>📄 AI Word Document Generator</h2>
          <p className="page-subtitle">Configure sections (only), let the AI draft content, refine with prompts, then export to .docx.</p>
        </div>
        <div className="word-badge">DOCX STUDIO</div>
      </header>

      {mode === "editing" && (
        <div className="card">
          <h3>1️⃣ Configure Document</h3>
          <p className="card-caption">Set up the title, topic and section headings. The AI expands them into full pages.</p>

          <div className="field-grid" style={{ alignItems: "end" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              Document Title
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. Business Strategy Report 2025"
                  style={{ flex: 1 }}
                />

                {/* === SINGLE CLEAN NUMBER BOX FOR NUMBER OF SECTIONS ===
                    No +/- buttons here — user types the number directly.
                */}
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={numSections}
                  onChange={(e) => {
                    const v = Math.max(1, Number(e.target.value) || 1);
                    setNumSections(v);
                  }}
                  aria-label="Number of Sections"
                  style={{
                    width: 84,
                    height: 36,
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "transparent",
                    color: "#fff",
                    textAlign: "center",
                  }}
                />
              </div>
              <div style={{ fontSize: 12, color: "#9aa" }}>Number of Sections (controls sections list)</div>
            </label>
          </div>

          <label className="prompt-label">
            Document Topic / Prompt
            <div className="prompt-box">
              <div className="prompt-header">
                <span className="prompt-pill">✨ Magic Prompt</span>
                <span className="prompt-hint">Describe what the document should cover. AI will expand it.</span>
              </div>

              <textarea
                className="prompt-textarea"
                rows={4}
                value={docTopic}
                onChange={(e) => setDocTopic(e.target.value)}
                placeholder="Ex: Create a 2-page report on how generative AI can help college students prepare presentations faster..."
              />

              <div className="prompt-footer">
                <span className="prompt-counter">{docTopic.length} characters</span>
                <div style={{ display: "flex", gap: 8 }}>
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

                  <button type="button" className="ghost-pill" onClick={() => setDocTopic("")}>Clear prompt</button>
                </div>
              </div>
            </div>
          </label>

          {!docTopic.trim() ? (
            <p className="hint" style={{ marginTop: 12 }}>
              Enter a short topic or prompt above — once you add a prompt you'll be able to generate sections below.
            </p>
          ) : (
            <>
              <p className="hint" style={{ marginTop: 12 }}>
                Sections are linear. Use the number box beside the title or Add / Remove buttons below to change how many sections the AI should produce.
              </p>

              <div className="sections-config">
                <h4>Sections (titles optional)</h4>
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

                <div style={{ marginTop: 8 }}>
                  <button type="button" className="ghost-pill" onClick={addSection}>➕ Add Section</button>
                  <button type="button" className="ghost-pill" style={{ marginLeft: 8 }} onClick={removeSection}>➖ Remove Section</button>
                  <button type="button" className="ghost-pill" style={{ marginLeft: 8 }} onClick={() => setSections((prev) => prev.map((s, i) => ({ ...s, id: i + 1, orderIndex: i + 1 })) )}>🔁 Reindex IDs</button>
                </div>
              </div>
            </>
          )}

          <button className="primary-action" onClick={handleGenerateWord} disabled={loading || mode === "generating"}>
            {mode === "generating" ? "Generating..." : "Generate Word Document"}
          </button>

          {error && <p className="error">{String(error)}</p>}
        </div>
      )}

      {mode === "generating" && (
        <div className="card">
          <h3>2️⃣ Creating your document…</h3>
          <p className="card-caption">Give it a moment while we turn your topic and sections into a full draft.</p>
        </div>
      )}

      {wordDoc && mode === "generated" && (
        <>
          <div className="card">
            <h3>2️⃣ Review & Refine Sections</h3>
            <p className="meta-line">
              <strong>Project ID:</strong> {wordDoc.id} • <strong>Pages (hint):</strong> {wordDoc.num_pages ?? 1}
            </p>

            {wordDoc.sections?.map((section) => (
              <WordSectionEditor
                key={section.id}
                section={{
                  id: section.id,
                  order_index: section.order_index,
                  title: section.title,
                  content: section.content,
                  reaction: section.reaction,
                  comment: section.comment,
                }}
                onRefine={handleRefineSection}
              />
            ))}
          </div>

          <div className="card">
            <h3>3️⃣ Export Word Document</h3>
            {downloadUrl ? (
              <>
                <button className="export-button" onClick={() => window.open(downloadUrl, "_blank")}>⬇️ Export DOCX</button>
                <button className="secondary-action" style={{ marginLeft: "8px" }} onClick={handleReset}>🔄 Start over</button>
              </>
            ) : (
              <p>Generate the document first to get a download link.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default WordGenerator;
