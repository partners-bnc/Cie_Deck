import { useState, useEffect, useMemo } from "react";
import { jobService } from "../../services/jobService.js";
import { AdminDashboardSkeleton } from "../../Component/AdminSkeletons.jsx";
import PerformanceDeck from "./PerformanceDeck.jsx";
import { FiActivity, FiPieChart, FiBriefcase, FiClock } from "react-icons/fi";
import {
  LuBriefcase,
  LuUsers,
  LuClipboardList,
  LuSparkles,
  LuUserCheck,
  LuTag,
  LuFileUp,
  LuBuilding2,
  LuTrophy,
  LuFolderPlus,
  LuCalendar,
  LuTrendingUp,
  LuChevronRight
} from "react-icons/lu";

const DISTINCT_COLORS = [
  '#2563eb', // Blue
  '#16a34a', // Emerald Green
  '#ea580c', // Bright Orange
  '#9333ea', // Purple
  '#0891b2', // Cyan
  '#e11d48', // Rose Pink
  '#d97706', // Amber Gold
  '#4f46e5', // Indigo
  '#059669', // Teal Green
  '#db2777', // Magenta Pink
  '#ca8a04', // Golden Yellow
  '#7c3aed', // Violet
  '#0284c7', // Sky Blue
  '#dc2626', // Crimson Red
  '#65a30d', // Lime Green
  '#b45309', // Rust Brown
  '#8b5cf6', // Lavender Purple
  '#06b6d4', // Bright Teal
  '#f97316', // Coral Orange
  '#10b981', // Mint Green
  '#ec4899', // Bright Pink
  '#3b82f6', // Cobalt Blue
  '#84cc16', // Chartreuse
  '#6366f1'  // Periwinkle
];

const ALL_STANDARD_SOURCES = [
  'BNC Indeed',
  'BNC Linkedin',
  'BNC IIM',
  'BNC Job Hai',
  'BNC Others',
  'Linkedin',
  'Indeed',
  'IIM',
  'Job Application',
  'LinkedIn',
  'Naukri',
  'Referral',
  'Walk-in'
];

function getSourceColor(index) {
  if (index < DISTINCT_COLORS.length) {
    return DISTINCT_COLORS[index];
  }
  const hue = (index * 137.5) % 360;
  return `hsl(${Math.round(hue)}, 75%, 45%)`;
}

function getScalePosition(rawVal) {
  const v = Number(rawVal) || 0;
  if (v <= 0) return 0;
  if (v <= 1) return 0;
  if (v <= 1000) {
    // 0% -> 33.3333% (logarithmic across 1 to 1,000)
    return (Math.log10(v) / 3) * 33.3333;
  }
  if (v <= 10000) {
    // 33.3333% -> 66.6667% (logarithmic across 1,000 to 10,000)
    return 33.3333 + ((Math.log10(v) - 3) / 1) * 33.3333;
  }
  // 66.6667% -> 100% (logarithmic across 10,000 to 50,000)
  const log50k = Math.log10(50000); // ~4.69897
  const progress = (Math.log10(v) - 4) / (log50k - 4);
  return Math.min(100, 66.6667 + Math.max(0, progress) * 33.3333);
}

function StatCard({ icon, label, value, color, bg }) {
  return (
    <div style={{
      background: "#ffffff", borderRadius: "18px", padding: "24px",
      boxShadow: "0 20px 40px -35px rgba(31,41,55,0.5)",
      border: "1px solid #e5dfd8", display: "flex", alignItems: "center", gap: "16px"
    }}>
      <div style={{
        width: "52px", height: "52px", borderRadius: "14px", background: bg, color: color,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "28px", fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>{label}</div>
      </div>
    </div>
  );
}

function getInitials(name) {
  if (!name || name === "—") return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0]?.slice(0, 2).toUpperCase() || "—";
}

function formatReadableDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState({
    hrDailyStats: [],
    sourceStats: [],
    shortlisted: [],
    commLogs: [],
    clientJobs: []
  });
  const [performanceData, setPerformanceData] = useState({
    clients: [],
    clientJobs: [],
    closures: [],
    hrs: []
  });
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [loadingPerformance, setLoadingPerformance] = useState(true);
  const [sourcesAnimated, setSourcesAnimated] = useState(false);
  const [hrDateFilter, setHrDateFilter] = useState("");
  const [hrAvatarMap, setHrAvatarMap] = useState({});
  const adminId = sessionStorage.getItem("bnc_admin_name") || sessionStorage.getItem("bnc_admin_id") || "Admin";
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  useEffect(() => {
    let active = true;

    // Load HR avatar map
    jobService.fetchHRAvatarMap().then(map => {
      if (active && map) setHrAvatarMap(map);
    });

    const loadSummary = async () => {
      setLoadingSummary(true);
      const [data, allActiveJobs] = await Promise.all([
        jobService.fetchDashboardSummary(),
        jobService.fetchActiveClientJobsPreview(null)
      ]);
      if (!active) return;
      if (data && allActiveJobs && allActiveJobs.length > 0) {
        data.activeClientJobs = allActiveJobs;
      }
      setSummary(data);
      setLoadingSummary(false);
    };

    const loadAnalytics = async () => {
      setLoadingAnalytics(true);
      const data = await jobService.fetchDashboardAnalytics();
      if (!active) return;
      setAnalytics(data);
      setLoadingAnalytics(false);
      setTimeout(() => {
        if (active) setSourcesAnimated(true);
      }, 60);
    };

    const loadPerformance = async () => {
      setLoadingPerformance(true);
      const perf = await jobService.fetchDashboardPerformanceMetrics();
      if (!active) return;
      if (perf) {
        setPerformanceData(perf);
        if (perf.hrAvatarMap) {
          setHrAvatarMap(prev => ({ ...prev, ...perf.hrAvatarMap }));
        }
      }
      setLoadingPerformance(false);
    };

    loadSummary();
    loadAnalytics();
    loadPerformance();

    return () => {
      active = false;
    };
  }, []);

  const getHRAvatar = (nameOrEmail) => {
    if (!nameOrEmail || typeof nameOrEmail !== "string") return null;
    const clean = nameOrEmail.trim().toLowerCase();
    if (hrAvatarMap[clean]) return hrAvatarMap[clean];
    const first = clean.split(" ")[0];
    if (hrAvatarMap[first]) return hrAvatarMap[first];
    const user = clean.split("@")[0];
    if (hrAvatarMap[user]) return hrAvatarMap[user];
    return null;
  };

  const hrStats = useMemo(() => {
    const stats = {};

    analytics.hrDailyStats.forEach(row => {
      if (hrDateFilter && row.date !== hrDateFilter) return;
      const hr = row.hr || "Portal / Unknown";
      if (!stats[hr]) stats[hr] = { uploaded: 0, tagged: 0, calls: 0 };
      stats[hr].uploaded += row.uploaded || 0;
      stats[hr].tagged += row.tagged || 0;
      stats[hr].calls += row.calls || 0;
    });

    return Object.entries(stats).sort((a, b) => b[1].uploaded - a[1].uploaded);
  }, [analytics, hrDateFilter]);

  const sourceStats = useMemo(() => {
    const dataMap = new Map((analytics.sourceStats || []).map(s => [s.name, Number(s.value) || 0]));

    // Include legitimate sources, strictly excluding other, others, hr upload, and ciedeck
    const allNames = Array.from(new Set([
      ...(analytics.sourceStats || []).map(s => s.name),
      ...ALL_STANDARD_SOURCES
    ]))
      .filter(Boolean)
      .filter(name => !/^(other|others|hr upload|ciedeck)$/i.test(name.trim()));

    return allNames.map(name => ({
      name,
      value: dataMap.get(name) || 0
    })).sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return a.name.localeCompare(b.name);
    });
  }, [analytics.sourceStats]);

  const totalSourceCandidates = useMemo(() => {
    return sourceStats.reduce((sum, s) => sum + (s.value || 0), 0);
  }, [sourceStats]);

  const maxSourceVal = useMemo(() => {
    return Math.max(...sourceStats.map(s => s.value || 0), 1);
  }, [sourceStats]);

  const maxPower = maxSourceVal > 1000 ? 4 : 3;

  const stats = summary?.stats || {
    activeJobs: 0,
    totalCandidates: 0,
    applicationsToday: 0,
    aiShortlisted: 0,
    totalApplicants: 0,
    taggedCandidates: 0,
    monthCvUpload: 0,
    totalClients: 0
  };
  const recent = summary?.recentCandidates || [];
  const activeClientJobs = summary?.activeClientJobs || [];

  if (loadingSummary && !summary) {
    return (
      <div style={{ padding: "32px", maxWidth: "1250px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
          <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: "10px" }}>
            <span role="img" aria-label="wave">{"\u{1F44B}"}</span>
            <span>Welcome back, {adminId}</span>
          </h1>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "14px", fontWeight: 500 }}>{today}</p>
        </div>
        <AdminDashboardSkeleton />
      </div>
    );
  }

  return (
    <div style={{ padding: "32px", maxWidth: "1250px" }}>
      <style>{`
        @keyframes cardEscalate {
          0% {
            opacity: 0;
            transform: translateY(22px) scale(0.96);
          }
          60% {
            opacity: 1;
            transform: translateY(-2px) scale(1.004);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes metricPop {
          0% {
            opacity: 0;
            transform: scale(0.5);
          }
          70% {
            opacity: 1;
            transform: scale(1.1);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes dotPulse {
          0%, 100% {
            transform: scale(0.55);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.25);
            opacity: 1;
          }
        }
        .dot-live {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #2f9e44;
          animation: dotPulse 1.4s ease-in-out infinite;
          display: inline-block;
          flex-shrink: 0;
        }
        .dot-idle {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #d6d3cc;
          display: inline-block;
          flex-shrink: 0;
        }
        @media (prefers-reduced-motion: reduce) {
          .dot-live { animation: none; }
        }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
        <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: "10px" }}>
          <span role="img" aria-label="wave">{"\u{1F44B}"}</span>
          <span>Welcome back, {adminId}</span>
        </h1>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "14px", fontWeight: 500 }}>{today}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
        <StatCard icon={<LuBriefcase size={22} />} label="Active Job Listings" value={stats.activeJobs} color="#0b2f5b" bg="#e8f0ff" />
        <StatCard icon={<LuUsers size={22} />} label="Total Candidates" value={stats.totalCandidates} color="#059669" bg="#ecfdf5" />
        <StatCard icon={<LuClipboardList size={22} />} label="Applications Today" value={stats.applicationsToday} color="#d97706" bg="#fffbeb" />
        <StatCard icon={<LuSparkles size={22} />} label="AI Shortlisted" value={stats.aiShortlisted} color="#7c3aed" bg="#f5f3ff" />
        <StatCard icon={<LuUserCheck size={22} />} label="Total Applicant" value={stats.totalApplicants} color="#2563eb" bg="#dbeafe" />
        <StatCard icon={<LuTag size={22} />} label="Tagged Candidates" value={stats.taggedCandidates} color="#16a34a" bg="#dcfce7" />
        <StatCard icon={<LuFileUp size={22} />} label="Month CV Upload" value={stats.monthCvUpload} color="#ca8a04" bg="#fef08a" />
        <StatCard icon={<LuBuilding2 size={22} />} label="Total Client" value={stats.totalClients} color="#9333ea" bg="#f3e8ff" />
      </div>

      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "32px", alignItems: "stretch" }}>
        <div style={{
          flex: "1 1 500px", background: "#ffffff", borderRadius: "18px",
          border: "1px solid #e8ecf0", overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column"
        }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{
                width: "28px", height: "28px", borderRadius: "8px", background: "#f0fdf4",
                color: "#16a34a", display: "inline-flex", alignItems: "center", justifyContent: "center"
              }}>
                <FiActivity size={16} />
              </span>
              <span>HR Performance</span>
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="date"
                value={hrDateFilter}
                onChange={(e) => setHrDateFilter(e.target.value)}
                style={{
                  padding: "6px 10px", border: "1px solid #e5dfd8", borderRadius: "8px",
                  fontSize: "12px", outline: "none", color: "#374151"
                }}
              />
              {hrDateFilter && (
                <button
                  onClick={() => setHrDateFilter("")}
                  style={{ fontSize: "11px", color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {loadingAnalytics ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#6b7280", fontSize: "14px" }}>Loading HR analytics...</div>
          ) : hrStats.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#6b7280", fontSize: "14px" }}>
              No performance data found for the selected criteria.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>HR Name</th>
                    <th style={{ padding: "10px 16px", textAlign: "center", fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Uploaded</th>
                    <th style={{ padding: "10px 16px", textAlign: "center", fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Tagged CVs</th>
                    <th style={{ padding: "10px 16px", textAlign: "center", fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Calls Logged</th>
                  </tr>
                </thead>
                <tbody>
                  {hrStats.map(([hrName, data], idx) => (
                    <tr key={hrName} style={{ borderTop: "1px solid #f3f4f6", background: idx % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ padding: "8px 16px", fontWeight: 600, fontSize: "13px", color: "#111827" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {getHRAvatar(hrName) ? (
                            <img
                              src={getHRAvatar(hrName)}
                              alt={hrName}
                              style={{
                                width: "26px", height: "26px", borderRadius: "50%",
                                objectFit: "cover", flexShrink: 0,
                                boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                                border: "1px solid #e2e8f0"
                              }}
                            />
                          ) : (
                            <div style={{
                              width: "26px", height: "26px", borderRadius: "50%",
                              background: "linear-gradient(135deg, #0b2f5b20, #0b2f5b30)",
                              color: "#0b2f5b", display: "flex", alignItems: "center",
                              justifyContent: "center", fontSize: "11px", fontWeight: 700,
                              flexShrink: 0
                            }}>
                              {(hrName || "A").charAt(0).toUpperCase()}
                            </div>
                          )}
                          {hrName}
                        </div>
                      </td>
                      <td style={{ padding: "8px 16px", textAlign: "center", fontSize: "14px", fontWeight: 700, color: "#0b2f5b" }}>{data.uploaded}</td>
                      <td style={{ padding: "8px 16px", textAlign: "center", fontSize: "14px", fontWeight: 700, color: "#16a34a" }}>{data.tagged}</td>
                      <td style={{ padding: "8px 16px", textAlign: "center", fontSize: "14px", fontWeight: 700, color: "#7c3aed" }}>{data.calls}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{
          flex: "1 1 min(100%, 420px)", background: "#ffffff", borderRadius: "18px",
          border: "1px solid #e8ecf0", overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column"
        }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{
                width: "28px", height: "28px", borderRadius: "8px", background: "#eef4ff",
                color: "#2f5fe0", display: "inline-flex", alignItems: "center", justifyContent: "center"
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-9-9v9z"></path>
                  <path d="M15.5 3.5A9 9 0 0 1 20.5 8.5H15.5z"></path>
                </svg>
              </span>
              <span>Candidates by Source</span>
            </h2>
          </div>

          <div style={{ flex: 1, padding: "14px 18px 12px", display: "flex", flexDirection: "column", overflow: "hidden", boxSizing: "border-box" }}>
            {loadingAnalytics ? (
              <div style={{ color: "#6b7280", margin: "auto", fontSize: "13px" }}>Loading sources...</div>
            ) : sourceStats.length === 0 ? (
              <div style={{ color: "#6b7280", margin: "auto", fontSize: "13px" }}>No sourcing data available.</div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", paddingBottom: "6px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 800, color: "#111827" }}>
                    {totalSourceCandidates.toLocaleString()} candidates
                  </div>
                  <div style={{ fontSize: "11px", color: "#6b7685", fontWeight: 500 }}>
                    Scale: 1 · 1,000 · 10,000 · 50,000
                  </div>
                </div>

                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  overflow: "hidden"
                }}>
                  {sourceStats.map((r, i) => {
                    const c = getSourceColor(i);
                    const pos = getScalePosition(r.value);

                    return (
                      <div
                        key={r.name}
                        title={`${r.name}: ${r.value.toLocaleString()}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "115px minmax(0, 1fr) 44px",
                          alignItems: "center",
                          gap: "8px",
                          height: "21px",
                          boxSizing: "border-box",
                          opacity: sourcesAnimated ? 1 : 0,
                          transform: sourcesAnimated ? "translateX(0)" : "translateX(-8px)",
                          transition: `opacity 0.4s ease ${i * 30}ms, transform 0.45s cubic-bezier(0.16, 1, 0.3, 1) ${i * 30}ms`
                        }}
                      >
                        <span
                          style={{
                            fontSize: "11.5px",
                            fontWeight: 600,
                            color: r.value > 0 ? "#1f2937" : "#64748b",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                          }}
                          title={r.name}
                        >
                          {r.name}
                        </span>

                        <div
                          style={{
                            position: "relative",
                            height: "21px",
                            margin: "0 6px",
                            backgroundImage: "linear-gradient(to right, #e6e3dc 1px, transparent 1px)",
                            backgroundSize: "33.3333% 100%",
                            borderRight: "1px solid #e6e3dc"
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              left: 0,
                              top: "10px",
                              height: "2px",
                              width: sourcesAnimated ? `${pos}%` : "0%",
                              background: c,
                              opacity: r.value > 0 ? 0.45 : 0,
                              transition: `width 0.85s cubic-bezier(0.16, 1, 0.3, 1) ${i * 30}ms, opacity 0.3s ease ${i * 30}ms`
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              left: sourcesAnimated ? `${pos}%` : "0%",
                              top: "6.5px",
                              transform: sourcesAnimated ? "translateX(-50%) scale(1)" : "translateX(-50%) scale(0.2)",
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: c,
                              boxShadow: "0 0 0 1.5px #ffffff",
                              opacity: sourcesAnimated ? (r.value > 0 ? 1 : 0.6) : 0,
                              transition: `left 0.85s cubic-bezier(0.16, 1, 0.3, 1) ${i * 30}ms, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 30 + 150}ms, opacity 0.3s ease ${i * 30}ms`
                            }}
                          />
                        </div>

                        <span
                          style={{
                            fontSize: "11.5px",
                            fontWeight: 700,
                            color: r.value > 0 ? "#111827" : "#94a3b8",
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            opacity: sourcesAnimated ? 1 : 0,
                            transition: `opacity 0.4s ease ${i * 30 + 120}ms`
                          }}
                        >
                          {r.value >= 1000 ? r.value.toLocaleString() : r.value}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "115px minmax(0, 1fr) 44px",
                    gap: "8px",
                    paddingTop: "6px",
                    borderTop: "1px solid #f1ece4",
                    marginTop: "auto"
                  }}
                >
                  <span />
                  <div
                    style={{
                      position: "relative",
                      height: "16px",
                      margin: "0 6px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#6b7685"
                    }}
                  >
                    <span style={{ position: "absolute", left: 0, transform: "translateX(-50%)" }}>1</span>
                    <span style={{ position: "absolute", left: "33.3333%", transform: "translateX(-50%)" }}>1,000</span>
                    <span style={{ position: "absolute", left: "66.6667%", transform: "translateX(-50%)" }}>10,000</span>
                    <span style={{ position: "absolute", left: "100%", transform: "translateX(-50%)" }}>50,000</span>
                  </div>
                  <span />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {activeClientJobs.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{
                width: "28px", height: "28px", borderRadius: "8px", background: "#fff7ed",
                color: "#ea580c", display: "inline-flex", alignItems: "center", justifyContent: "center"
              }}>
                <FiBriefcase size={16} />
              </span>
              <span>Active Client Jobs</span>
            </h2>

            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              {/* Legend with icons and names before View all */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", background: "#ffffff", padding: "5px 12px", borderRadius: "10px", border: "1px solid #e8ecf0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                  <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#eaf6ee", color: "#2f9e44", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"></path><circle cx="7.5" cy="7.5" r="1.2"></circle></svg>
                  </span>
                  <span>Tagging</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                  <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#fff7ed", color: "#ea580c", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"></path><path d="M16 11l2 2 4-4"></path></svg>
                  </span>
                  <span>Manager</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                  <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#eff6ff", color: "#2563eb", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 3L10 14"></path><path d="M21 3l-7 18-4-7-7-4 18-7z"></path></svg>
                  </span>
                  <span>Client</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                  <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#ecfdf5", color: "#059669", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  </span>
                  <span>Hired</span>
                </div>
              </div>

              <a href="/admin/client-jobs" style={{ fontSize: "13px", color: "#0b2f5b", fontWeight: 600, textDecoration: "none" }}>View all →</a>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
            {activeClientJobs.map((job, idx) => {
              const jobCandidates = analytics.shortlisted.filter(item => {
                if (!item.jobCode || !job.jobCode) return false;
                const cCode = item.jobCode.trim().toLowerCase();
                const jCode = job.jobCode.trim().toLowerCase();
                return cCode === jCode || cCode.replace(/^jpc-?/, '') === jCode.replace(/^jpc-?/, '');
              });

              // Tagging: All candidates tagged to this job (completed initial tagging step)
              const taggingCount = jobCandidates.length;

              // Manager Submission: Candidates that reached Manager Submit or beyond
              const managerSubmitCount = jobCandidates.filter(item => {
                const stage = (item.currentStage || '').toLowerCase();
                return Boolean(item.managerSubmittedAt) || stage.includes('manager') || stage.includes('client') || stage.includes('round') || stage.includes('cleared') || stage.includes('hold') || stage.includes('hired') || stage.includes('rejected');
              }).length;

              // Client Submission: Candidates that reached Client Submission or beyond
              const clientSubmitCount = jobCandidates.filter(item => {
                const stage = (item.currentStage || '').toLowerCase();
                return Boolean(item.clientSubmittedAt) || stage.includes('client') || stage.includes('round') || stage.includes('cleared') || stage.includes('hold') || stage.includes('hired') || stage.includes('rejected');
              }).length;

              // Hired: Candidates who are actually HIRED / placed for this job
              const hiredCount = jobCandidates.filter(item => {
                const stage = (item.currentStage || '').toLowerCase();
                const outcome = (item.stageOutcome || '').toLowerCase();
                return stage === 'hired' || outcome === 'hired' || outcome === 'selected';
              }).length;

              // Bridge activity state
              const isBridge1Live = taggingCount > 0;
              const isBridge2Live = managerSubmitCount > 0;
              const isBridge3Live = clientSubmitCount > 0;

              return (
                <a
                  key={job.jobCode}
                  href={`/admin/client-jobs/${job.jobCode}`}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    display: "flex",
                    animation: "cardEscalate 0.55s cubic-bezier(0.16, 1, 0.3, 1) backwards",
                    animationDelay: `${idx * 40}ms`
                  }}
                >
                  <div style={{
                    width: "100%", background: "#ffffff", border: "1px solid #e5dfd8", borderRadius: "16px",
                    padding: "16px 18px", display: "flex", flexDirection: "column", gap: "12px",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
                    transition: "box-shadow 0.2s ease, transform 0.2s ease", cursor: "pointer",
                    boxSizing: "border-box"
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.05)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}>

                    {/* Header: Title and JPC Text */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                      <h2
                        title={job.jobTitle}
                        style={{ margin: 0, fontSize: "15px", lineHeight: 1.3, fontWeight: 700, letterSpacing: "-0.01em", color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {job.jobTitle}
                      </h2>
                      <span
                        style={{
                          flex: "none",
                          color: "#0f766e",
                          fontSize: "13px",
                          fontWeight: 700,
                          letterSpacing: "0.02em"
                        }}
                      >
                        {job.jobCode ? (job.jobCode.toUpperCase().startsWith("JPC") ? job.jobCode : `JPC-${job.jobCode}`) : "—"}
                      </span>
                    </div>

                    {/* 4 Metrics: Tagging, Manager, Client, Hired with Pulsing Connector Dots */}
                    <div style={{ position: "relative", margin: "6px 0 2px 0", padding: "4px 0" }}>
                      {/* Animated Connector Dots Layer */}
                      <div style={{
                        position: "absolute", left: 0, right: 0, top: "4px", height: "34px",
                        display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "6px",
                        pointerEvents: "none"
                      }}>
                        {/* Bridge 1: Tagging -> Manager */}
                        <div style={{ position: "relative" }}>
                          <div style={{
                            position: "absolute", left: "calc(50% + 19px)", width: "calc(100% - 32px)",
                            top: 0, height: "34px", display: "flex", alignItems: "center", justifyContent: "space-between"
                          }}>
                            {isBridge1Live ? (
                              <>
                                <span className="dot-live" style={{ animationDelay: "0s" }}></span>
                                <span className="dot-live" style={{ animationDelay: "0.18s" }}></span>
                                <span className="dot-live" style={{ animationDelay: "0.36s" }}></span>
                                <span className="dot-live" style={{ animationDelay: "0.54s" }}></span>
                              </>
                            ) : (
                              <>
                                <span className="dot-idle"></span>
                                <span className="dot-idle"></span>
                                <span className="dot-idle"></span>
                                <span className="dot-idle"></span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Bridge 2: Manager -> Client */}
                        <div style={{ position: "relative" }}>
                          <div style={{
                            position: "absolute", left: "calc(50% + 19px)", width: "calc(100% - 32px)",
                            top: 0, height: "34px", display: "flex", alignItems: "center", justifyContent: "space-between"
                          }}>
                            {isBridge2Live ? (
                              <>
                                <span className="dot-live" style={{ animationDelay: "0s" }}></span>
                                <span className="dot-live" style={{ animationDelay: "0.18s" }}></span>
                                <span className="dot-live" style={{ animationDelay: "0.36s" }}></span>
                                <span className="dot-live" style={{ animationDelay: "0.54s" }}></span>
                              </>
                            ) : (
                              <>
                                <span className="dot-idle"></span>
                                <span className="dot-idle"></span>
                                <span className="dot-idle"></span>
                                <span className="dot-idle"></span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Bridge 3: Client -> Hired */}
                        <div style={{ position: "relative" }}>
                          <div style={{
                            position: "absolute", left: "calc(50% + 19px)", width: "calc(100% - 32px)",
                            top: 0, height: "34px", display: "flex", alignItems: "center", justifyContent: "space-between"
                          }}>
                            {isBridge3Live ? (
                              <>
                                <span className="dot-live" style={{ animationDelay: "0s" }}></span>
                                <span className="dot-live" style={{ animationDelay: "0.18s" }}></span>
                                <span className="dot-live" style={{ animationDelay: "0.36s" }}></span>
                                <span className="dot-live" style={{ animationDelay: "0.54s" }}></span>
                              </>
                            ) : (
                              <>
                                <span className="dot-idle"></span>
                                <span className="dot-idle"></span>
                                <span className="dot-idle"></span>
                                <span className="dot-idle"></span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* 4th Column (no outgoing bridge) */}
                        <div></div>
                      </div>

                      {/* 4 Metrics Icons and Numbers */}
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                        gap: "6px",
                        position: "relative",
                        zIndex: 1,
                        animation: "metricPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) backwards",
                        animationDelay: `${idx * 40 + 120}ms`
                      }}>
                        {/* Tagging */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }} title={`Tagging: ${taggingCount}`}>
                          <div style={{
                            width: "34px", height: "34px", borderRadius: "50%",
                            background: taggingCount > 0 ? "#eaf6ee" : "#f3f1ec",
                            color: taggingCount > 0 ? "#2f9e44" : "#b4bac3",
                            display: "flex", alignItems: "center", justifyContent: "center"
                          }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"></path>
                              <circle cx="7.5" cy="7.5" r="1.2"></circle>
                            </svg>
                          </div>
                          <div style={{ fontSize: "16px", fontWeight: 700, lineHeight: 1, color: taggingCount > 0 ? "#1f7a3a" : "#6b7280" }}>{taggingCount}</div>
                        </div>

                        {/* Manager */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }} title={`Manager Submission: ${managerSubmitCount}`}>
                          <div style={{
                            width: "34px", height: "34px", borderRadius: "50%",
                            background: managerSubmitCount > 0 ? "#fff7ed" : "#f3f1ec",
                            color: managerSubmitCount > 0 ? "#ea580c" : "#b4bac3",
                            display: "flex", alignItems: "center", justifyContent: "center"
                          }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="9" cy="8" r="3.5"></circle>
                              <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"></path>
                              <path d="M16 11l2 2 4-4"></path>
                            </svg>
                          </div>
                          <div style={{ fontSize: "16px", fontWeight: 700, lineHeight: 1, color: managerSubmitCount > 0 ? "#c2410c" : "#6b7280" }}>{managerSubmitCount}</div>
                        </div>

                        {/* Client */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }} title={`Client Submission: ${clientSubmitCount}`}>
                          <div style={{
                            width: "34px", height: "34px", borderRadius: "50%",
                            background: clientSubmitCount > 0 ? "#eff6ff" : "#f3f1ec",
                            color: clientSubmitCount > 0 ? "#2563eb" : "#b4bac3",
                            display: "flex", alignItems: "center", justifyContent: "center"
                          }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M21 3L10 14"></path>
                              <path d="M21 3l-7 18-4-7-7-4 18-7z"></path>
                            </svg>
                          </div>
                          <div style={{ fontSize: "16px", fontWeight: 700, lineHeight: 1, color: clientSubmitCount > 0 ? "#1d4ed8" : "#6b7280" }}>{clientSubmitCount}</div>
                        </div>

                        {/* Hired */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }} title={`Hired: ${hiredCount}`}>
                          <div style={{
                            width: "34px", height: "34px", borderRadius: "50%",
                            background: hiredCount > 0 ? "#ecfdf5" : "#f3f1ec",
                            color: hiredCount > 0 ? "#059669" : "#b4bac3",
                            display: "flex", alignItems: "center", justifyContent: "center"
                          }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                              <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                          </div>
                          <div style={{ fontSize: "16px", fontWeight: 700, lineHeight: 1, color: hiredCount > 0 ? "#059669" : "#6b7280" }}>{hiredCount}</div>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div style={{ height: "1px", background: "#f1f5f9" }}></div>

                    {/* Footer Details */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#6b7280", fontSize: "11px", fontWeight: 500 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="4" y="3" width="12" height="18" rx="1.5"></rect>
                            <path d="M16 9h4v12h-4"></path>
                            <path d="M8 7h4M8 11h4M8 15h4"></path>
                          </svg>
                          Client
                        </div>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "#1f2937", maxWidth: "165px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={job.clientName || "—"}>
                          {job.clientName || "—"}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#6b7280", fontSize: "11px", fontWeight: 500 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="8" r="4"></circle>
                            <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"></path>
                          </svg>
                          Created by
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 600, color: "#1f2937" }}>
                          {getHRAvatar(job.createdBy) ? (
                            <img
                              src={getHRAvatar(job.createdBy)}
                              alt={job.createdBy}
                              style={{
                                width: "18px", height: "18px", borderRadius: "50%",
                                objectFit: "cover", flexShrink: 0,
                                border: "1px solid #e2e8f0"
                              }}
                            />
                          ) : (
                            <span style={{ width: "18px", height: "18px", borderRadius: "50%", background: "#e6f5f1", color: "#0f6b5c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8.5px", fontWeight: 800, flexShrink: 0 }}>
                              {getInitials(job.createdBy)}
                            </span>
                          )}
                          <span style={{ maxWidth: "145px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={job.createdBy || "—"}>
                            {job.createdBy || "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* 3 Performance Widgets: Closures (Employee-wise), New Clients Added, JPCs Created */}
      <PerformanceDeck performanceData={performanceData} analytics={analytics} hrAvatarMap={hrAvatarMap} />

      <div style={{
        background: "#ffffff", borderRadius: "18px",
        border: "1px solid #e8ecf0", overflow: "hidden",
        boxShadow: "0 4px 20px rgba(0,0,0,0.06)"
      }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              width: "28px", height: "28px", borderRadius: "8px", background: "#f5f3ff",
              color: "#7c3aed", display: "inline-flex", alignItems: "center", justifyContent: "center"
            }}>
              <FiClock size={16} />
            </span>
            <span>Recent Applications</span>
          </h2>
          <a href="/admin/candidates" style={{ fontSize: "13px", color: "#0b2f5b", fontWeight: 600, textDecoration: "none" }}>View all →</a>
        </div>
        {recent.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#6b7280", fontSize: "14px" }}>
            No applications yet. They'll appear here once candidates apply.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Candidate", "Job Applied", "Location", "Experience", "Status"].map(h => (
                    <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((candidate, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ fontWeight: 600, fontSize: "14px", color: "#111827" }}>{candidate.name}</div>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>{candidate.email}</div>
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: "13px", color: "#374151" }}>{candidate.jobApplied}</td>
                    <td style={{ padding: "14px 20px", fontSize: "13px", color: "#374151" }}>{candidate.currentLocation}</td>
                    <td style={{ padding: "14px 20px", fontSize: "13px", color: "#374151" }}>{candidate.totalExperience}</td>
                    <td style={{ padding: "14px 20px" }}>
                      <span style={{
                        padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 600,
                        background: (candidate.status === "Applied" || !candidate.status) ? "#e0f2fe" : (candidate.status === "Tagged" ? "#dcfce7" : "#f1f5f9"),
                        color: (candidate.status === "Applied" || !candidate.status) ? "#0369a1" : (candidate.status === "Tagged" ? "#15803d" : "#475569")
                      }}>{candidate.status || "Applied"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
