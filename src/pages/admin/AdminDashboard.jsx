import { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { jobService } from "../../services/jobService.js";
import { AdminDashboardSkeleton } from "../../Component/AdminSkeletons.jsx";

function StatCard({ icon, label, value, color, bg }) {
  return (
    <div style={{
      background: "#ffffff", borderRadius: "18px", padding: "24px",
      boxShadow: "0 20px 40px -35px rgba(31,41,55,0.5)",
      border: "1px solid #e5dfd8", display: "flex", alignItems: "center", gap: "16px"
    }}>
      <div style={{
        width: "52px", height: "52px", borderRadius: "14px", background: bg,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
      }}>
        <span style={{ fontSize: "22px" }}>{icon}</span>
      </div>
      <div>
        <div style={{ fontSize: "28px", fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>{label}</div>
      </div>
    </div>
  );
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
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [hrDateFilter, setHrDateFilter] = useState("");
  const adminId = sessionStorage.getItem("bnc_admin_name") || sessionStorage.getItem("bnc_admin_id") || "Admin";
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  useEffect(() => {
    let active = true;

    const loadSummary = async () => {
      setLoadingSummary(true);
      const data = await jobService.fetchDashboardSummary();
      if (!active) return;
      setSummary(data);
      setLoadingSummary(false);
    };

    const loadAnalytics = async () => {
      setLoadingAnalytics(true);
      const data = await jobService.fetchDashboardAnalytics();
      if (!active) return;
      setAnalytics(data);
      setLoadingAnalytics(false);
    };

    loadSummary();
    loadAnalytics();

    return () => {
      active = false;
    };
  }, []);

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
    return (analytics.sourceStats || []).sort((a, b) => b.value - a.value);
  }, [analytics.sourceStats]);

  const COLORS = ["#0b2f5b", "#059669", "#d97706", "#7c3aed", "#db2777", "#2563eb", "#ea580c"];
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
        <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: "10px" }}>
          <span role="img" aria-label="wave">{"\u{1F44B}"}</span>
          <span>Welcome back, {adminId}</span>
        </h1>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "14px", fontWeight: 500 }}>{today}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
        <StatCard icon={"\u{1F4BC}"} label="Active Job Listings" value={stats.activeJobs} color="#0b2f5b" bg="#e8f0ff" />
        <StatCard icon={"\u{1F465}"} label="Total Candidates" value={stats.totalCandidates} color="#059669" bg="#ecfdf5" />
        <StatCard icon={"\u{1F4CB}"} label="Applications Today" value={stats.applicationsToday} color="#d97706" bg="#fffbeb" />
        <StatCard icon={"\u{2728}"} label="AI Shortlisted" value={stats.aiShortlisted} color="#7c3aed" bg="#f5f3ff" />
        <StatCard icon={"\u{1F4C8}"} label="Total Applicant" value={stats.totalApplicants} color="#2563eb" bg="#dbeafe" />
        <StatCard icon={"\u{1F3C6}"} label="Tagged Candidates" value={stats.taggedCandidates} color="#16a34a" bg="#dcfce7" />
        <StatCard icon={"\u{1F4C5}"} label="Month CV Upload" value={stats.monthCvUpload} color="#ca8a04" bg="#fef08a" />
        <StatCard icon={"\u{1F3E2}"} label="Total Client" value={stats.totalClients} color="#9333ea" bg="#f3e8ff" />
      </div>

      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "32px", alignItems: "stretch" }}>
        <div style={{
          flex: "1 1 500px", background: "#ffffff", borderRadius: "18px",
          border: "1px solid #e8ecf0", overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column"
        }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#111827" }}>HR Performance</h2>
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
                    <th style={{ padding: "12px 20px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>HR Name</th>
                    <th style={{ padding: "12px 20px", textAlign: "center", fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Uploaded</th>
                    <th style={{ padding: "12px 20px", textAlign: "center", fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Tagged CVs</th>
                    <th style={{ padding: "12px 20px", textAlign: "center", fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Calls Logged</th>
                  </tr>
                </thead>
                <tbody>
                  {hrStats.map(([hrName, data], idx) => (
                    <tr key={hrName} style={{ borderTop: "1px solid #f3f4f6", background: idx % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ padding: "14px 20px", fontWeight: 600, fontSize: "14px", color: "#111827" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{
                            width: "32px", height: "32px", borderRadius: "50%",
                            background: "linear-gradient(135deg, #0b2f5b20, #0b2f5b30)",
                            color: "#0b2f5b", display: "flex", alignItems: "center",
                            justifyContent: "center", fontSize: "13px", fontWeight: 700
                          }}>
                            {(hrName || "A").charAt(0).toUpperCase()}
                          </div>
                          {hrName}
                        </div>
                      </td>
                      <td style={{ padding: "14px 20px", textAlign: "center", fontSize: "15px", fontWeight: 700, color: "#0b2f5b" }}>{data.uploaded}</td>
                      <td style={{ padding: "14px 20px", textAlign: "center", fontSize: "15px", fontWeight: 700, color: "#16a34a" }}>{data.tagged}</td>
                      <td style={{ padding: "14px 20px", textAlign: "center", fontSize: "15px", fontWeight: 700, color: "#7c3aed" }}>{data.calls}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{
          flex: "1 1 min(100%, 400px)", background: "#ffffff", borderRadius: "18px",
          border: "1px solid #e8ecf0", overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column"
        }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #f3f4f6" }}>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#111827" }}>Candidates by Source</h2>
          </div>
          <div style={{ flex: 1, padding: "24px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "320px" }}>
            {loadingAnalytics ? (
              <div style={{ color: "#6b7280" }}>Loading chart...</div>
            ) : sourceStats.length === 0 ? (
              <div style={{ color: "#6b7280" }}>No sourcing data available.</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={sourceStats} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={4} dataKey="value">
                    {sourceStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", fontWeight: 600 }}
                    itemStyle={{ color: "#111827" }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "13px", paddingTop: "20px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {activeClientJobs.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#111827" }}>Active Client Jobs</h2>
            <a href="/admin/client-jobs" style={{ fontSize: "13px", color: "#0b2f5b", fontWeight: 600, textDecoration: "none" }}>View all →</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
            {activeClientJobs.map(job => {
              const taggedCount = analytics.shortlisted.filter(item => item.jobCode === job.jobCode).length;
              const hasTagged = taggedCount > 0;
              return (
                <a key={job.jobCode} href={`/admin/client-jobs/${job.jobCode}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    background: "#ffffff", borderRadius: "16px", padding: "20px",
                    border: "1px solid #e5dfd8", boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
                    transition: "box-shadow 0.2s, transform 0.2s", cursor: "pointer",
                    display: "flex", flexDirection: "column", gap: "12px"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.05)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "15px", fontWeight: 700, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.jobTitle}</div>
                        <div style={{ fontSize: "12px", color: "#0f766e", fontWeight: 700, marginTop: "4px" }}>{job.jobCode}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, marginLeft: "8px" }}>
                        <div style={{
                          width: "12px", height: "12px", borderRadius: "50%",
                          background: hasTagged ? "#16a34a" : "#f97316",
                          boxShadow: hasTagged ? "0 0 0 3px #dcfce7" : "0 0 0 3px #ffedd5"
                        }} />
                        <span style={{ fontSize: "13px", fontWeight: 700, color: hasTagged ? "#16a34a" : "#f97316" }}>{taggedCount}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                      <span style={{ fontWeight: 600, color: "#374151" }}>Created by: </span>{job.createdBy || "—"}
                    </div>
                    <div style={{ fontSize: "12px", color: "#6b7280" }}>
                      <span style={{ fontWeight: 600, color: "#374151" }}>Client: </span>{job.clientName || "—"}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      <div style={{
        background: "#ffffff", borderRadius: "18px",
        border: "1px solid #e8ecf0", overflow: "hidden",
        boxShadow: "0 4px 20px rgba(0,0,0,0.06)"
      }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#111827" }}>Recent Applications</h2>
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
