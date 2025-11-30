// src/components/navbar/Navbar.jsx
import React from "react";
import "./navbar.css";

function Navbar({ activePage, onChangePage, user, onLogout }) {
  const displayName = user?.name || user?.email || "Guest";
  const initial =
    (user?.name && user.name[0]) ||
    (user?.email && user.email[0]) ||
    "G";

  const isLoggedIn = !!user;

  const handleNavClick = (page) => {
    const protectedPages = ["dashboard", "ppt", "word"];
    if (!isLoggedIn && protectedPages.includes(page)) {
      onChangePage("login");
    } else {
      onChangePage(page);
    }
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">

        {/* LEFT — LOGO */}
        <div className="nav-left" onClick={() => handleNavClick("home")}>
          <div className="nav-logo-dot">PAI</div>
          <div className="nav-logo-text">
            <span>Presentations AI</span>
            <small>Docs & Slides Studio</small>
          </div>
        </div>

        {/* CENTER — LINKS */}
        <div className="nav-center">
          <button
            className={`nav-link ${
              activePage === "home" ? "nav-link-active" : ""
            }`}
            onClick={() => handleNavClick("home")}
          >
            Home
          </button>

          <button
            className={`nav-link ${
              activePage === "dashboard" ? "nav-link-active" : ""
            }`}
            onClick={() => handleNavClick("dashboard")}
          >
            Dashboard
          </button>

          <button
            className={`nav-link ${
              activePage === "ppt" ? "nav-link-active" : ""
            }`}
            onClick={() => handleNavClick("ppt")}
          >
            PPT Generator
          </button>

          <button
            className={`nav-link ${
              activePage === "word" ? "nav-link-active" : ""
            }`}
            onClick={() => handleNavClick("word")}
          >
            Word Generator
          </button>
        </div>

        {/* RIGHT — USER + LOGIN */}
        <div className="nav-right">
          <div className="nav-user-pill">
            <div className="nav-user-avatar">{initial}</div>
            <span>{displayName}</span>
          </div>

          {!isLoggedIn ? (
            <button className="nav-login-btn" onClick={() => handleNavClick("login")}>
              Login
            </button>
          ) : (
            <button className="nav-login-btn" onClick={onLogout}>
              Logout
            </button>
          )}
        </div>

      </div>
    </header>
  );
}

export default Navbar;
