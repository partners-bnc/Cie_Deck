import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { jobService } from "../services/jobService.js";

const NAV_ITEMS = [
  {
    to: "/admin",
    label: "Dashboard",
    end: true,
    icon: (
      <svg width="18" height="18" fill="#312e81" viewBox="0 0 24 24">
        <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
      </svg>
    )
  },
  {
    to: "/admin/jobs",
    label: "Portal Job Listing",
    icon: (
      <svg width="18" height="18" fill="#312e81" viewBox="0 0 24 24">
        <path d="M20 6h-2.18c.11-.31.18-.65.18-1a3 3 0 0 0-5.5-1.65l-.5.67-.5-.68A2.996 2.996 0 0 0 6 4c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z" />
      </svg>
    )
  },
  {
    to: "/admin/candidates",
    label: "Portal Candidate",
    icon: (
      <svg width="18" height="18" fill="#312e81" viewBox="0 0 24 24">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
      </svg>
    )
  },
  {
    to: "/admin/cv-upload",
    label: "CV Upload",
    icon: (
      <svg width="18" height="18" fill="#312e81" viewBox="0 0 24 24">
        <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
      </svg>
    )
  },
  {
    to: "/admin/applicants",
    label: "Applicants database",
    icon: (
      <svg width="18" height="18" fill="#312e81" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 4.02 2 6.5v11C2 19.98 6.48 22 12 22s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2zm0 2c4.42 0 8 1.57 8 2.5S16.42 9 12 9 4 7.43 4 6.5 7.58 4 12 4zm8 13.5c0 .93-3.58 2.5-8 2.5s-8-1.57-8-2.5v-2.13c1.73 1.05 4.67 1.63 8 1.63s6.27-.58 8-1.63v2.13zm0-4c0 .93-3.58 2.5-8 2.5s-8-1.57-8-2.5v-2.13c1.73 1.05 4.67 1.63 8 1.63s6.27-.58 8-1.63v2.13zm0-4c0 .93-3.58 2.5-8 2.5s-8-1.57-8-2.5V8.87c1.73 1.05 4.67 1.63 8 1.63s6.27-.58 8-1.63v2.13z" />
      </svg>
    )
  },
  {
    to: "/admin/shortlisted",
    label: "Tagged",
    icon: (
      <svg width="18" height="18" fill="#312e81" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
    )
  },
  {
    to: "/admin/clients",
    label: "Clients",
    icon: (
      <svg width="18" height="18" fill="#312e81" viewBox="0 0 24 24">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    )
  },
  {
    to: "/admin/client-jobs",
    label: "Client JPC",
    icon: (
      <svg width="18" height="18" fill="#312e81" viewBox="0 0 24 24">
        <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z" />
      </svg>
    )
  },
  {
    to: "/admin/employer-requirements",
    label: "Employer Req.",
    icon: (
      <svg width="18" height="18" fill="#312e81" viewBox="0 0 24 24">
        <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
      </svg>
    )
  },
  {
    to: "/admin/contact-messages",
    label: "Contact Messages",
    icon: (
      <svg width="18" height="18" fill="#312e81" viewBox="0 0 24 24">
        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
      </svg>
    )
  },
  {
    to: "/admin/admin-management",
    label: "Admin Management",
    icon: (
      <svg width="18" height="18" fill="#312e81" viewBox="0 0 24 24">
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
      </svg>
    )
  },
  {
    to: "/admin/hr-reports",
    label: "HR Reports",
    icon: (
      <svg width="18" height="18" fill="#312e81" viewBox="0 0 24 24">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
      </svg>
    )
  }
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const adminId = sessionStorage.getItem("bnc_admin_name") || sessionStorage.getItem("bnc_admin_id") || "Admin";
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async () => {
    await jobService.adminLogout();
    sessionStorage.removeItem("bnc_admin_auth");
    sessionStorage.removeItem("bnc_admin_id");
    sessionStorage.removeItem("bnc_admin_email");
    sessionStorage.removeItem("bnc_admin_name");
    sessionStorage.removeItem("bnc_admin_role");
    navigate("/admin/login");
  };

  return (
    <div style={{
      display: "flex", minHeight: "100vh",
      fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
      background: "#f7f2ed"
    }}>
      <style>{`
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
          transition: background 0.2s;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        /* For Firefox */
        * {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f1f5f9;
        }
      `}</style>
      {/* Sidebar */}
      <aside style={{
        position: "sticky",
        top: 0,
        height: "100vh",
        width: sidebarOpen ? "240px" : "72px",
        background: "linear-gradient(180deg, #E0F2FE 0%, #BAE6FD 100%)", // Light Sky Blue Gradient
        display: "flex", flexDirection: "column",
        transition: "width 0.25s ease",
        userSelect: "none", flexShrink: 0,
        boxShadow: "10px 0 40px rgba(11, 47, 91, 0.08)",
        borderTopRightRadius: "32px",
        borderBottomRightRadius: "32px",
        zIndex: 10,
        overflow: "hidden"
      }}>
        {/* Sidebar Background Glows - Light Blue Theme */}
        <div style={{
          position: "absolute", top: "-40px", left: "-40px", width: "160px", height: "160px", borderRadius: "50%",
          background: "radial-gradient(circle at 30% 30%, #ecfeff 0%, transparent 70%)",
          opacity: 0.8, zIndex: -1, pointerEvents: "none", filter: "blur(20px)"
        }} />
        <div style={{
          position: "absolute", bottom: "15%", right: "-20px", width: "130px", height: "130px", borderRadius: "50%",
          background: "radial-gradient(circle at 50% 50%, #ffffff 0%, transparent 75%)",
          opacity: 0.6, zIndex: -1, pointerEvents: "none", filter: "blur(20px)"
        }} />

        {/* Brand */}
        <div style={{
          padding: sidebarOpen ? "18px 18px 14px" : "18px 12px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          display: "flex", alignItems: "center", justifyContent: sidebarOpen ? "space-between" : "center", gap: "12px"
        }}>
          {sidebarOpen ? (
            <>
              <div style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 0
              }}>
                <img
                  src="/7d9e2a6b-1a4b-4373-88c7-4c2781cdaf0d (1).png"
                  alt="Ciedeck"
                  style={{
                    height: "52px",
                    width: "auto",
                    maxWidth: "150px",
                    objectFit: "contain",
                    display: "block"
                  }}
                />
              </div>
              <button
                type="button"
                aria-label="Collapse sidebar"
                onClick={() => setSidebarOpen(v => !v)}
                style={{
                  width: "34px",
                  height: "34px",
                  flexShrink: 0,
                  borderRadius: "10px",
                  border: "1px solid rgba(49,46,129,0.14)",
                  background: "rgba(255,255,255,0.65)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#312e81"
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                </svg>
              </button>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
              <img
                src="/2.png"
                alt="Ciedeck icon"
                style={{
                  width: "34px",
                  height: "34px",
                  objectFit: "contain",
                  display: "block"
                }}
              />
              <button
                type="button"
                aria-label="Expand sidebar"
                onClick={() => setSidebarOpen(v => !v)}
                style={{
                  width: "40px",
                  height: "40px",
                  flexShrink: 0,
                  borderRadius: "12px",
                  border: "1px solid rgba(49,46,129,0.14)",
                  background: "rgba(255,255,255,0.72)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#312e81"
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="m8.59 16.59 1.41 1.41L16 12 10 6 8.59 7.41 13.17 12z" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "8px 10px", display: "flex", flexDirection: "column", gap: "2px", overflowY: "auto", scrollbarWidth: "none" }}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                display: "flex", alignItems: "center",
                gap: "10px", padding: sidebarOpen ? "9px 12px" : "10px 0",
                justifyContent: sidebarOpen ? "flex-start" : "center",
                borderRadius: "10px", textDecoration: "none",
                fontWeight: 700, fontSize: "13px", transition: "all 0.2s",
                color: isActive ? "#312e81" : "rgba(49, 46, 129, 0.7)",
                background: isActive ? "rgba(255,255,255,0.6)" : "transparent",
                boxShadow: isActive ? "0 4px 12px rgba(99, 88, 220, 0.1)" : "none"
              })}
            >
              {({ isActive }) => (
                <>
                  <div style={{ opacity: isActive ? 1 : 0.8 }}>{item.icon}</div>
                  {sidebarOpen && <span>{item.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: user & logout */}
        <div style={{
          borderTop: "1px solid rgba(0,0,0,0.06)",
          padding: sidebarOpen ? "16px 14px" : "16px 10px"
        }}>

          {sidebarOpen && (
            <div style={{
              display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px"
            }}>
              <div style={{
                width: "34px", height: "34px", borderRadius: "50%",
                background: "rgba(255,255,255,0.7)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#312e81", fontWeight: 700, fontSize: "13px", flexShrink: 0,
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
              }}>
                {adminId.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ color: "#312e81", fontSize: "13px", fontWeight: 700 }}>{adminId}</div>
                <div style={{ color: "rgba(49, 46, 129, 0.6)", fontSize: "11px", fontWeight: 600 }}>{sessionStorage.getItem("bnc_admin_role") === "super_admin" ? "Super Admin" : "HR / Admin"}</div>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              width: "100%", border: "1.5px solid rgba(99, 88, 220, 0.2)",
              borderRadius: "10px", padding: sidebarOpen ? "9px 14px" : "9px 0",
              background: "rgba(255,255,255,0.5)", color: "#3730a3",
              cursor: "pointer", fontSize: "13px", fontWeight: 700,
              display: "flex", alignItems: "center",
              justifyContent: sidebarOpen ? "flex-start" : "center", gap: "8px",
              transition: "all 0.2s", fontFamily: "inherit",
              marginBottom: "10px"
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "#fee2e2";
              e.currentTarget.style.color = "#dc2626";
              e.currentTarget.style.borderColor = "#fecaca";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(255,255,255,0.5)";
              e.currentTarget.style.color = "#3730a3";
              e.currentTarget.style.borderColor = "rgba(99, 88, 220, 0.2)";
            }}
          >
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
            </svg>
            {sidebarOpen && "Logout"}
          </button>

          <button
            onClick={() => navigate("/")}
            style={{
              width: "100%", border: "1.5px solid rgba(99, 88, 220, 0.2)",
              borderRadius: "10px", padding: sidebarOpen ? "9px 14px" : "9px 0",
              background: "rgba(255,255,255,0.5)", color: "#312e81",
              cursor: "pointer", fontSize: "13px", fontWeight: 700,
              display: "flex", alignItems: "center",
              justifyContent: sidebarOpen ? "flex-start" : "center", gap: "8px",
              transition: "all 0.2s", fontFamily: "inherit"
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "#e0e7ff";
              e.currentTarget.style.borderColor = "#c7d2fe";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(255,255,255,0.5)";
              e.currentTarget.style.borderColor = "rgba(99, 88, 220, 0.2)";
            }}
          >
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
            {sidebarOpen && "Home Page"}
          </button>
        </div>

      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
        <Outlet />
      </main>
    </div>
  );
}
