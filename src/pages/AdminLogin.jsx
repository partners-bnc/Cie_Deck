import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { jobService } from "../services/jobService.js";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!loginId.trim() || !password.trim()) {
      setError("Please enter both Login ID and Password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await jobService.adminLogin(loginId.trim(), password.trim());
      if (result.success) {
        sessionStorage.setItem("bnc_admin_auth", "true");
        sessionStorage.setItem("bnc_admin_id", result.loginId || loginId);
        sessionStorage.setItem("bnc_admin_email", result.loginId || loginId);
        sessionStorage.setItem("bnc_admin_name", result.hrName || result.loginId || loginId);
        sessionStorage.setItem("bnc_admin_role", result.role || "hr");
        navigate("/admin");
      } else {
        setError(result.error || "Invalid Login ID or Password. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at 80% 20%, #efe8ff 0%, #f7f2ed 35%, #f7f2ed 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: "-80px", right: "-80px", width: "340px", height: "340px", borderRadius: "50%", background: "#E5E0F0", opacity: 0.55, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-60px", left: "-60px", width: "260px", height: "260px", borderRadius: "50%", background: "#E5E0F0", opacity: 0.45, pointerEvents: "none" }} />

      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          borderRadius: "22px",
          padding: "48px 40px",
          boxShadow: "0 30px 70px -45px rgba(15, 23, 42, 0.25)",
          border: "1px solid #e5dfd8",
          position: "relative",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <img
            src="/7d9e2a6b-1a4b-4373-88c7-4c2781cdaf0d (1).png"
            alt="Ciedeck"
            style={{
              height: "82px",
              width: "auto",
              objectFit: "contain",
              margin: "0 auto 14px",
              display: "block",
            }}
          />
          <h1 style={{ margin: "0 0 4px", fontSize: "24px", fontWeight: 700, color: "#0b2f5b" }}>
            Admin Login
          </h1>
          <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>HR Dashboard Access</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "18px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "8px" }}>
              Login ID (Email)
            </label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }}>
                <svg width="16" height="16" fill="#9ca3af" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </span>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="Enter your email"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: "12px",
                  padding: "12px 14px 12px 40px",
                  fontSize: "14px",
                  outline: "none",
                  transition: "border 0.2s",
                  fontFamily: "inherit",
                  background: "#f9fafb",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#0b2f5b")}
                onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
              />
            </div>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "8px" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }}>
                <svg width="16" height="16" fill="#9ca3af" viewBox="0 0 24 24">
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                </svg>
              </span>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your Password"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: "12px",
                  padding: "12px 44px 12px 40px",
                  fontSize: "14px",
                  outline: "none",
                  transition: "border 0.2s",
                  fontFamily: "inherit",
                  background: "#f9fafb",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#0b2f5b")}
                onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                style={{
                  position: "absolute",
                  right: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  color: "#9ca3af",
                }}
              >
                {showPass ? (
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
                  </svg>
                ) : (
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                background: "#fff1f1",
                border: "1px solid #fecaca",
                borderRadius: "10px",
                padding: "10px 14px",
                marginBottom: "18px",
                color: "#dc2626",
                fontSize: "13px",
                display: "flex",
                gap: "8px",
                alignItems: "center",
              }}
            >
              <svg width="14" height="14" fill="#dc2626" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              background: loading ? "#93a8c4" : "linear-gradient(135deg, #0b2f5b, #1a4a8a)",
              color: "#fff",
              border: "none",
              borderRadius: "12px",
              fontSize: "15px",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              fontFamily: "inherit",
              boxShadow: loading ? "none" : "0 4px 16px rgba(11,47,91,0.35)",
            }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid rgba(255,255,255,0.4)",
                    borderTop: "2px solid white",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    display: "inline-block",
                  }}
                />
                Verifying...
              </span>
            ) : "Sign in to Dashboard"}
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
            style={{
              width: "100%",
              padding: "13px",
              background: "#ffffff",
              color: "#0b2f5b",
              border: "1.5px solid #d7dee8",
              borderRadius: "12px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
              fontFamily: "inherit",
              marginTop: "12px",
            }}
          >
            Home Page
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "12px", color: "#9ca3af" }}>
          Secure Admin Access
        </p>
      </div>
      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
