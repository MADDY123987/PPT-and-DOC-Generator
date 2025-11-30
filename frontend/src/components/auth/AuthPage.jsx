import React, { useState } from "react";
import "../../styles/auth.css";

import { AUTH_BASE_URL } from "../../config";

function AuthPage({ onBackHome, onLogin }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const resetErrors = () => setErrorMsg("");

  const validate = () => {
    resetErrors();
    if (!email || !email.includes("@")) {
      setErrorMsg("Please enter a valid email.");
      return false;
    }
    if (!password || password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return false;
    }
    if (mode === "register" && !name.trim()) {
      setErrorMsg("Please enter your name to register.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrorMsg("");

    try {
      if (mode === "register") {
        const res = await fetch(`${AUTH_BASE_URL}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            password,
            name: name.trim(),
            is_active: true,
            is_superuser: false,
            is_verified: false,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          const msg =
            data?.detail || data?.message || data?.error || "Registration failed";
          throw new Error(msg);
        }

        setMode("login");
        setPassword("");
        alert("Registration successful! Please login now.");
      } else {
        const form = new URLSearchParams();
        form.append("grant_type", "password");
        form.append("username", email.trim());
        form.append("password", password);
        form.append("scope", "");
        form.append("client_id", "string");
        form.append("client_secret", "string");

        const res = await fetch(`${AUTH_BASE_URL}/auth/jwt/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: form.toString(),
        });

        const data = await res.json();
        if (!res.ok) {
          const msg = data?.detail || data?.error || "Login failed";
          throw new Error(msg);
        }

        const token = data.access_token;
        if (!token) throw new Error("Invalid token response from server");

        localStorage.setItem("authToken", token);
        localStorage.setItem("authEmail", email.trim());

        const meRes = await fetch(`${AUTH_BASE_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });

        const me = await meRes.json();
        if (!meRes.ok) {
          const msg = me?.detail || "Failed to load user profile";
          throw new Error(msg);
        }

        localStorage.setItem("authUser", JSON.stringify(me));
        if (onLogin) onLogin(me);

        alert("Login successful!");
        if (onBackHome) onBackHome();
      }
    } catch (err) {
      console.error("Auth error:", err);
      setErrorMsg(err?.message || "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" role="main">
      <div className="auth-page-card" aria-live="polite">
        <div className="auth-page-header">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              className="auth-back"
              onClick={() => {
                if (onBackHome) onBackHome();
              }}
              aria-label="Back"
            >
              ← Back
            </button>

            <div style={{ textAlign: "right", fontSize: "0.85rem", color: "#9ca3af" }}>
              <span
                style={{ cursor: "pointer" }}
                onClick={() => setMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Need an account?" : "Have an account?"}
              </span>
            </div>
          </div>

          <h1>{mode === "login" ? "Welcome back" : "Create your workspace"}</h1>
          <p className="muted">
            {mode === "login"
              ? "Sign in to access your AI tools."
              : "Sign up to save AI projects in one place."}
          </p>
        </div>

        <div className="auth-page-tabs" role="tablist" aria-label="Auth tabs">
          <button
            role="tab"
            aria-selected={mode === "login"}
            className={mode === "login" ? "auth-page-tab active" : "auth-page-tab"}
            onClick={() => {
              setMode("login");
              resetErrors();
            }}
            type="button"
          >
            Login
          </button>

          <button
            role="tab"
            aria-selected={mode === "register"}
            className={mode === "register" ? "auth-page-tab active" : "auth-page-tab"}
            onClick={() => {
              setMode("register");
              resetErrors();
            }}
            type="button"
          >
            Register
          </button>
        </div>

        <form className="auth-page-form" onSubmit={handleSubmit} noValidate>
          {mode === "register" && (
            <label>
              Name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                disabled={loading}
                autoComplete="name"
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={loading}
              autoComplete="username email"
              required
            />
          </label>

          <label style={{ position: "relative" }}>
            Password
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="show-password-btn"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={0}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {errorMsg && (
            <div className="auth-error" role="alert">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            className="auth-page-submit"
            disabled={loading}
            aria-busy={loading}
          >
            {loading
              ? mode === "login"
                ? "Logging in..."
                : "Creating..."
              : mode === "login"
              ? "Login"
              : "Create account"}
          </button>
        </form>

        <div className="auth-footer-note">
          By proceeding you agree to the terms.
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
