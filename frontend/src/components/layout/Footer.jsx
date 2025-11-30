import React from "react";
import "../../styles/footer.css";

export default function Footer() {
  return (
    <footer className="footer-root">
      <div className="footer-inner">
        <div>© {new Date().getFullYear()} AI-DOC</div>
        <div className="footer-links">
          <button className="linkish" onClick={() => window.open("https://github.com/","_blank")}>GitHub</button>
        </div>
      </div>
    </footer>
  );
}
