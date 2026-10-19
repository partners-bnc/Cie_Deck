import { Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "../services/supabaseClient.js";

export default function AdminRoute({ children }) {
  const hasStoredAdminSession = sessionStorage.getItem("bnc_admin_auth") === "true";
  const [loading, setLoading] = useState(!hasStoredAdminSession);
  const [isAuth, setIsAuth] = useState(hasStoredAdminSession);

  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;

        if (!session) {
          sessionStorage.removeItem("bnc_admin_auth");
          sessionStorage.removeItem("bnc_admin_email");
          setIsAuth(false);
          setLoading(false);
          return;
        }

        const { data } = await supabase.from('admin_users')
          .select('hr_name, role, email, avatar_url')
          .eq('auth_id', session.user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (!active) return;

        if (data) {
          sessionStorage.setItem("bnc_admin_auth", "true");
          sessionStorage.setItem("bnc_admin_role", data.role || "hr");
          sessionStorage.setItem("bnc_admin_name", data.hr_name || data.email);
          sessionStorage.setItem("bnc_admin_id", data.email);
          sessionStorage.setItem("bnc_admin_email", data.email || session.user.email || "");
          if (data.avatar_url) {
            sessionStorage.setItem("bnc_admin_avatar", data.avatar_url);
          } else {
            sessionStorage.removeItem("bnc_admin_avatar");
          }
          setIsAuth(true);
        } else {
          sessionStorage.removeItem("bnc_admin_auth");
          sessionStorage.removeItem("bnc_admin_email");
          sessionStorage.removeItem("bnc_admin_avatar");
          setIsAuth(false);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    verifySession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        sessionStorage.removeItem("bnc_admin_auth");
        sessionStorage.removeItem("bnc_admin_email");
        setIsAuth(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#f7f2ed", fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "40px", height: "40px", border: "3px solid #e5e7eb",
            borderTop: "3px solid #0b2f5b", borderRadius: "50%",
            animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
          }} />
          <p style={{ color: "#6b7280", fontSize: "14px" }}>Verifying session...</p>
        </div>
        <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  if (!isAuth) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}
