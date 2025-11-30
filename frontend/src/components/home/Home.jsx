// src/components/home/Home.jsx
import React, { useEffect } from "react";
import "../../styles/home.css";

function Home({ onStartPpt, onStartWord }) {
  // Scroll reveal effect
  useEffect(() => {
    const elements = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleStartPpt = () => {
    if (onStartPpt) onStartPpt();
  };

  const handleStartWord = () => {
    if (onStartWord) onStartWord();
  };

  return (
    <section className="home">
      {/* ================= HERO + HERO VIDEO ================= */}
      <div className="hero reveal">
        <div className="hero-main">
          <h1>The World&apos;s Best AI Presentation &amp; Doc Maker</h1>
          <p className="hero-sub">
            ChatGPT for Presentations &amp; Business Documents — generate
            stunning PPT decks and polished Word reports in minutes. You focus
            on the story; we handle the design and formatting.
          </p>

          <div className="hero-btns">
            <button className="primary-pill" onClick={handleStartPpt}>
              Try for Free
            </button>
            <button className="secondary-pill" onClick={handleStartWord}>
              Generate Word Docs
            </button>
          </div>

          <p className="hero-small">No credit card required</p>
        </div>

        {/* Right side: hero video */}
        <div className="hero-demo-shell">
          <div className="hero-demo-box">
            <video
              src="/themes/editvideo.mp4"
              autoPlay
              loop
              muted
              controls
              className="hero-video"
            />
          </div>
        </div>
      </div>

      {/* ================= TRUST BAND ================= */}
      <div className="trust-band reveal">
        <p>Trusted by professionals at</p>
        <div className="trust-logos">
          <span>Microsoft</span>
          <span>Google</span>
          <span>Amazon</span>
          <span>Meta</span>
          <span>Adobe</span>
          <span>Notion</span>
        </div>
      </div>

      {/* ================= 9 FEATURE CARDS ================= */}
      <section className="features reveal">
        <h2>Key Features of our AI presentation maker</h2>
        <p className="features-sub">
          Use AI to create PPTs, infographics, timelines, project plans, reports
          &amp; Word docs — effortless, engaging, and free to try.
        </p>

        <div className="feature-cards">
          <div className="feature-card">
            <span className="feature-icon">✨</span>
            <h3>Effortless Creation</h3>
            <p>Turn raw ideas into complete PPT &amp; DOC drafts instantly.</p>
          </div>

          <div className="feature-card">
            <span className="feature-icon">🎨</span>
            <h3>Personalized Design</h3>
            <p>Layouts that match your topic, mood and brand tone.</p>
          </div>

          <div className="feature-card">
            <span className="feature-icon">🧱</span>
            <h3>Anti-Fragile Templates</h3>
            <p>Slides &amp; sections auto-adjust when you edit content.</p>
          </div>

          <div className="feature-card">
            <span className="feature-icon">📤</span>
            <h3>PowerPoint Export</h3>
            <p>One-click export to .pptx for instant presenting.</p>
          </div>

          <div className="feature-card">
            <span className="feature-icon">🎯</span>
            <h3>Brand Sync</h3>
            <p>Keep colors, fonts &amp; logos aligned with your brand kit.</p>
          </div>

          <div className="feature-card">
            <span className="feature-icon">🤝</span>
            <h3>Seamless Sharing</h3>
            <p>Share decks &amp; docs with real-time collaboration.</p>
          </div>

          <div className="feature-card">
            <span className="feature-icon">📊</span>
            <h3>Analytics &amp; Tracking</h3>
            <p>See who viewed which slide to refine your story.</p>
          </div>

          <div className="feature-card">
            <span className="feature-icon">📱</span>
            <h3>Multi-Device Ready</h3>
            <p>Review &amp; present from laptop, tablet or phone.</p>
          </div>

          <div className="feature-card">
            <span className="feature-icon">🌍</span>
            <h3>Multilingual Support</h3>
            <p>Create decks &amp; docs in multiple languages with AI.</p>
          </div>
        </div>
      </section>

      {/* ================= SEE PRESENTATIONS.AI IN ACTION ================= */}
      <section className="see-section reveal">
        <div className="see-header">
          <h2>See Presentations.AI in action</h2>
         
        </div>

        <div className="zig-list">
          {/* Row 1: text LEFT, image RIGHT */}
          <div className="zig-row">
            <div className="zig-text">
              <h3>Idea to Deck in Seconds</h3>
              <p className="zig-kicker">
                ChatGPT for Presentations &amp; Docs
              </p>
              <p>
                 Enter any topic — like “Market analysis of EV industry in 2025” — and instantly get structured slide content and matching Word document text. Clear points for your deck + detailed paragraphs for your report, ready to edit and present. Save hours. Impress faster.
              </p>
            </div>
            <img
              className="zig-img"
              src="/themes/Screenshot 2025-11-26 072438.png"
              alt="PPT + DOC workflow preview"
            />
          </div>

          {/* Row 2: IMAGE LEFT, TEXT RIGHT */}
          {/* Row 2: should be FLIPPED (image left, text right) */}
<div className="zig-row zig-row--reverse">
  <div className="zig-text">
    <h3>Creative power that goes way beyond templates</h3>
    <p>
        Make presentations that actually look professional — every time. The AI builds polished, branded slide decks and handouts that are easy to tweak. Clean layouts, smart visuals, strong messaging. You bring the idea — AI handles the heavy lifting.
    </p>
  </div>

  <img
    className="zig-img"
    src="/themes/Screenshot 2025-11-26 072403.png"
    alt="Template and color palette mockup"
  />
</div>


          {/* Row 3: text LEFT, image RIGHT */}
          <div className="zig-row">
            <div className="zig-text">
              <h3>Brand consistent, every time</h3>
              <p>
                Plug in your logo, fonts, and brand colors once — and you’re done.
The AI keeps both slides and documents visually aligned with your brand identity.
Every presentation looks like it came straight from your design team — consistently polished.
              </p>
            </div>
            <img
              className="zig-img"
              src="/themes/Screenshot 2025-11-26 072423.png"
              alt="Brand kit and assets panel"
            />
          </div>
        </div>
      </section>

      {/* ================= SIMPLE · FAST · FUN ================= */}
      <section className="simple-fast-section reveal">
        <h2>
          Presentations.AI is <span>simple</span>, <span>fast</span> and{" "}
          <span>fun</span>
        </h2>

        <div className="simple-fast-grid">
          <div className="simple-card">
            <h3>Bring your ideas to life instantly</h3>
            <p>
              Turn any idea into a PPT + DOC bundle in seconds. Just type and
              get a beautiful deck with matching report.
            </p>
          </div>

          <div className="simple-card">
            <h3>You bring the story. We bring design.</h3>
            <p>
              Focus on content and narrative. Layouts, slide structure and
              headings are handled for you.
            </p>
          </div>

          <div className="simple-card">
            <h3>A collaborative AI partner</h3>
            <p>
              Ask the app to tweak tone, add examples, or simplify slides — every
              user becomes a power user.
            </p>
          </div>
        </div>
      </section>

      {/* ================= TESTIMONIAL ================= */}
      <section className="testimonials reveal">
        <h2>What users say about our AI presentations</h2>

        <div className="testimonial-card">
          <div className="testimonial-stars">⭐⭐⭐⭐⭐</div>
          <p>
            “I needed an investment pitch deck fast. The AI generated a
            near-perfect presentation in minutes.”
          </p>
          <strong>Erin T. Roussey — US Coating Innovations</strong>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="cta-final reveal">
        <h2>Create at the speed of thought.</h2>
        <p>No design skills needed — just type, refine, and present.</p>
        <button className="primary-pill cta-button" onClick={handleStartPpt}>
          Start for Free
        </button>
        <span className="hero-small">No credit card required</span>
      </section>
    </section>
  );
}

export default Home;
