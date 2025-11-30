// src/App.jsx
import React, { useState } from "react";
import "./index.css";
import "./App.css";
import PptGenerator from "./components/ppt/PptGenerator";

import Navbar from "./components/navbar/Navbar.jsx";
import Home from "./components/home/Home";
import Footer from "./components/layout/Footer";
import WordGenerator from "./components/word/WordGenerator";
import AuthPage from "./components/auth/AuthPage.jsx";
import Dashboard from "./components/dashboard/Dashboard";

function App() {
  // initialize currentUser synchronously from localStorage so it's available on first render
  const initialUser = (() => {
    const stored = localStorage.getItem("authUser");
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.warn("Failed to parse authUser from localStorage", e);
      return null;
    }
  })();

  const [activePage, setActivePage] = useState("home");
  const [currentUser, setCurrentUser] = useState(initialUser);

  console.log("[App] initialUser:", initialUser);

  const changePage = (page) => {
    const protectedPages = ["dashboard", "ppt", "word"];
    if (!currentUser && protectedPages.includes(page)) {
      setActivePage("login");
    } else {
      setActivePage(page);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLogin = (user) => {
    try {
      console.log("[App] handleLogin received user:", user);
      localStorage.setItem("authUser", JSON.stringify(user));
      setCurrentUser(user);
      setActivePage("dashboard");
      console.log("[App] persisted authUser and switched to dashboard");
    } catch (e) {
      console.error("[App] handleLogin error:", e);
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("authUser");
      localStorage.removeItem("authToken");
      setCurrentUser(null);
      setActivePage("home");
      console.log("[App] logged out, cleared storage");
    } catch (e) {
      console.error("[App] handleLogout error:", e);
    }
  };

  const handleCreateProject = (kind) => {
    if (kind === "ppt") setActivePage("ppt");
    else setActivePage("word");
  };

  return (
    <div className="app app-zoom">
      <Navbar
        activePage={activePage}
        onChangePage={changePage}
        user={currentUser}
        onLogout={handleLogout}
      />

      <main className="main">
        <div className="page-container">
          {activePage === "home" && (
            <Home
              onStartPpt={() => changePage("ppt")}
              onStartWord={() => changePage("word")}
            />
          )}

          {activePage === "ppt" && (
            <section className="page page-narrow">
              <PptGenerator />
            </section>
          )}

          {activePage === "word" && (
            <section className="page page-narrow">
              <WordGenerator />
            </section>
          )}

          {activePage === "dashboard" && (
            <section className="page page-narrow">
              <Dashboard
                user={currentUser}
                onCreateProject={handleCreateProject}
              />
            </section>
          )}

          {activePage === "login" && (
            <section className="page">
              <AuthPage
                onBackHome={() => changePage("home")}
                onLogin={handleLogin}
              />
            </section>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default App;
