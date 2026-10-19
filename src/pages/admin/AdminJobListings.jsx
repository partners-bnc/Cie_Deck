import { useState, useEffect, useRef } from "react";
import { jobService } from "../../services/jobService.js";
import { AdminTableSkeleton } from "../../Component/AdminSkeletons.jsx";

const EMPTY_JOB = {
  title: "", location: "", type: "", experience: "",
  salary: "", education: "", vacancy: "", gender: "", description: ""
};

const JOB_TYPES = ["Onsite", "Remote", "Hybrid", "Full-time", "Part-time", "Contract", "Internship"];
const GENDER_OPTS = ["All", "Male", "Female"];

function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000, display: "flex",
      alignItems: "center", justifyContent: "center", padding: "24px",
      background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)"
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "#ffffff", borderRadius: "20px", width: "100%", maxWidth: "680px",
        maxHeight: "90vh", overflow: "auto", boxShadow: "0 40px 80px rgba(0,0,0,0.3)",
        animation: "modalIn 0.2s ease"
      }}>
        {children}
      </div>
      <style>{`@keyframes modalIn { from{opacity:0;transform:scale(0.95)translateY(10px)} to{opacity:1;transform:scale(1)translateY(0)} }`}</style>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
        {label}{required && <span style={{ color: "#ef4444", marginLeft: "3px" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", boxSizing: "border-box",
  border: "1.5px solid #e5e7eb", borderRadius: "10px",
  padding: "10px 13px", fontSize: "14px", outline: "none",
  fontFamily: "inherit", background: "#f9fafb", color: "#111827",
  transition: "border 0.2s"
};
const selectStyle = { ...inputStyle, cursor: "pointer" };

export default function AdminJobListings() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editJob, setEditJob] = useState(null); // null = new job
  const [form, setForm] = useState(EMPTY_JOB);
  const [saving, setSaving] = useState(false);
  const [savingMsg, setSavingMsg] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [descJob, setDescJob] = useState(null); // for description viewer
  const userRole = sessionStorage.getItem("bnc_admin_role");
  const isSuperAdmin = userRole === "super_admin";

  const loadJobs = async () => {
    setLoading(true);
    const data = await jobService.fetchJobs();
    setJobs(data || []);
    setLoading(false);
  };

  useEffect(() => { loadJobs(); }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const openAdd = () => {
    if (!isSuperAdmin) return alert("Only Super Admins can add new jobs.");
    setEditJob(null);
    setForm(EMPTY_JOB);
    setSavingMsg("");
    setModalOpen(true);
  };

  const openEdit = (job) => {
    if (!isSuperAdmin) return alert("Only Super Admins can edit jobs.");
    setEditJob(job);
    setForm({
      title: job.title || "", location: job.location || "",
      type: job.type || "", experience: job.experience || "",
      salary: job.salary || "", education: job.education || "",
      vacancy: job.vacancy || "", gender: job.gender || "",
      description: job.description || ""
    });
    setSavingMsg("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!isSuperAdmin) return alert("Only Super Admins can perform this action.");
    if (!form.title.trim() || !form.location.trim() || !form.type.trim()) {
      setSavingMsg("Job Role, Location, and Job Type are required.");
      return;
    }
    setSaving(true);
    setSavingMsg("");
    try {
      let result;
      if (editJob) {
        result = await jobService.updateJob({ ...form, id: editJob.id });
      } else {
        result = await jobService.addJob(form);
      }

      if (result.success) {
        setModalOpen(false);
        showToast(editJob ? "Job updated successfully!" : `Job posted! ID: ${result.jobId}`);
        await loadJobs();
      } else {
        setSavingMsg(result.error || "Something went wrong. Please try again.");
      }
    } catch (err) {
      setSavingMsg("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isSuperAdmin) return alert("Only Super Admins can delete jobs.");
    if (!deleteTarget) return;;
    setDeleting(true);
    try {
      const result = await jobService.deleteJob(deleteTarget.id);
      if (result.success) {
        setDeleteTarget(null);
        showToast("Job deleted successfully.");
        await loadJobs();
      } else {
        showToast(result.error || "Failed to delete job.", "error");
        setDeleteTarget(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const filteredJobs = jobs.filter(j =>
    !search ||
    j.title?.toLowerCase().includes(search.toLowerCase()) ||
    j.location?.toLowerCase().includes(search.toLowerCase()) ||
    j.type?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ padding: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 700, color: "#111827" }}>Portal Job Listing</h1>
            <p style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>Loading...</p>
          </div>
        </div>
        <AdminTableSkeleton rows={6} columns={8} />
      </div>
    );
  }

  return (
    <div style={{ padding: "32px" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: "24px", right: "24px", zIndex: 2000,
          background: toast.type === "error" ? "#fef2f2" : "#f0fdf4",
          border: `1px solid ${toast.type === "error" ? "#fca5a5" : "#bbf7d0"}`,
          borderRadius: "12px", padding: "14px 20px", fontSize: "14px",
          color: toast.type === "error" ? "#dc2626" : "#15803d",
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)", fontWeight: 600,
          display: "flex", alignItems: "center", gap: "8px",
          animation: "toastIn 0.3s ease"
        }}>
          {toast.type === "error" ? "❌" : "✅"} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 700, color: "#111827" }}>Portal Job Listing</h1>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>
            {loading ? "Loading..." : `${filteredJobs.length} jobs · Manage your open positions`}
          </p>
        </div>
        {isSuperAdmin && (
          <button onClick={openAdd} style={{
            padding: "11px 22px", background: "linear-gradient(135deg, #0b2f5b, #1a4a8a)",
            color: "white", border: "none", borderRadius: "12px", fontWeight: 700, fontSize: "14px",
            cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontFamily: "inherit",
            boxShadow: "0 4px 14px rgba(11,47,91,0.3)"
          }}>
            <svg width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Add New Job
          </button>
        )}
      </div>

      {/* Search */}
      <div style={{ marginBottom: "20px", position: "relative" }}>
        <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }}>
          <svg width="16" height="16" fill="#9ca3af" viewBox="0 0 24 24">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
        </span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by title, location, or type..."
          style={{ ...inputStyle, paddingLeft: "40px", maxWidth: "400px", background: "#fff" }}
          onFocus={e => e.target.style.borderColor = "#0b2f5b"}
          onBlur={e => e.target.style.borderColor = "#e5e7eb"}
        />
      </div>

      {/* Jobs Table */}
      <div style={{
        background: "#fff", borderRadius: "18px", border: "1px solid #e8ecf0",
        boxShadow: "0 4px 20px rgba(0,0,0,0.06)", overflow: "hidden"
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["Job ID", "Job Role", "Location", "Type", "Experience", "Salary", "Vacancies", "Actions"].map(h => (
                <th key={h} style={{ padding: "13px 18px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: "48px", textAlign: "center", color: "#6b7280" }}>⏳ Loading jobs...</td></tr>
            ) : filteredJobs.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: "48px", textAlign: "center", color: "#9ca3af", fontSize: "14px" }}>
                {search ? "No jobs match your search." : "No jobs yet. Click 'Add New Job' to post your first position."}
              </td></tr>
            ) : filteredJobs.map((job, i) => (
              <tr key={job.id} style={{ borderTop: "1px solid #f3f4f6", transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#fafbff"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <td style={{ padding: "14px 18px" }}>
                  <span style={{ padding: "3px 8px", background: "#e8f0ff", color: "#0b2f5b", borderRadius: "6px", fontSize: "12px", fontWeight: 600 }}>#{job.id}</span>
                  {job.jpcCode && (
                    <div style={{ marginTop: "4px" }}>
                      <span style={{ padding: "2px 7px", background: "#f0fdf4", color: "#047857", borderRadius: "4px", fontSize: "11px", fontWeight: 700, border: "1px solid #bbf7d0" }}>
                        {job.jpcCode}
                      </span>
                    </div>
                  )}
                </td>
                <td style={{ padding: "14px 18px" }}>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "#111827" }}>{job.title}</div>
                  <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>{job.gender || "All Genders"}</div>
                </td>
                <td style={{ padding: "14px 18px", fontSize: "13px", color: "#374151" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <svg width="12" height="12" fill="#9ca3af" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
                    {job.location}
                  </span>
                </td>
                <td style={{ padding: "14px 18px" }}>
                  <span style={{
                    padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 600,
                    background: job.type === "Remote" ? "#f0fdf4" : job.type === "Hybrid" ? "#fefce8" : "#eff6ff",
                    color: job.type === "Remote" ? "#15803d" : job.type === "Hybrid" ? "#92400e" : "#1d4ed8"
                  }}>{job.type}</span>
                </td>
                <td style={{ padding: "14px 18px", fontSize: "13px", color: "#374151" }}>{job.experience}</td>
                <td style={{ padding: "14px 18px", fontSize: "13px", color: "#374151" }}>{job.salary}</td>
                <td style={{ padding: "14px 18px", fontSize: "13px", color: "#374151", textAlign: "center" }}>
                  <span style={{ fontWeight: 700, color: "#0b2f5b" }}>{job.vacancy}</span>
                </td>
                <td style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {/* View Description */}
                    <button onClick={() => setDescJob(job)} title="View Description" style={{
                      background: "#f0fdf4", border: "none", borderRadius: "8px",
                      padding: "7px 10px", cursor: "pointer", color: "#15803d",
                      fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px",
                      fontFamily: "inherit", transition: "background 0.15s"
                    }}
                      onMouseEnter={e => e.currentTarget.style.background="#dcfce7"}
                      onMouseLeave={e => e.currentTarget.style.background="#f0fdf4"}
                    >
                      <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                      JD
                    </button>
                    
                    {isSuperAdmin ? (
                      <>
                        {/* Edit */}
                        <button onClick={() => openEdit(job)} style={{
                          background: "#eff6ff", border: "none", borderRadius: "8px",
                          padding: "7px 12px", cursor: "pointer", color: "#1d4ed8",
                          fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px",
                          fontFamily: "inherit", transition: "background 0.15s"
                        }}
                          onMouseEnter={e => e.currentTarget.style.background="#dbeafe"}
                          onMouseLeave={e => e.currentTarget.style.background="#eff6ff"}
                        >
                          <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                          Edit
                        </button>
                        {/* Delete */}
                        <button onClick={() => setDeleteTarget(job)} style={{
                          background: "#fef2f2", border: "none", borderRadius: "8px",
                          padding: "7px 10px", cursor: "pointer", color: "#dc2626",
                          fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px",
                          fontFamily: "inherit", transition: "background 0.15s"
                        }}
                          onMouseEnter={e => e.currentTarget.style.background="#fee2e2"}
                          onMouseLeave={e => e.currentTarget.style.background="#fef2f2"}
                        >
                          <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                          Del
                        </button>
                      </>
                    ) : (
                      <span style={{ fontSize: "11px", color: "#9ca3af", fontStyle: "italic", alignSelf: "center", marginLeft: "4px" }}>View Only</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <div style={{ padding: "28px 32px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#111827" }}>
              {editJob ? "Edit Job" : "Post New Job"}
            </h2>
            {editJob && <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#9ca3af" }}>Job ID: #{editJob.id}</p>}
          </div>
          <button onClick={() => setModalOpen(false)} style={{
            background: "#f3f4f6", border: "none", borderRadius: "8px", width: "32px", height: "32px",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", color: "#374151"
          }}>✕</button>
        </div>

        <div style={{ padding: "24px 32px 28px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
            <Field label="Job Role" required>
              <input value={form.title} onChange={f("title")} placeholder="e.g. Business Analyst" style={inputStyle}
                onFocus={e=>e.target.style.borderColor="#0b2f5b"} onBlur={e=>e.target.style.borderColor="#e5e7eb"} />
            </Field>
            <Field label="Location" required>
              <input value={form.location} onChange={f("location")} placeholder="e.g. Delhi, Mumbai, Dubai" style={inputStyle}
                onFocus={e=>e.target.style.borderColor="#0b2f5b"} onBlur={e=>e.target.style.borderColor="#e5e7eb"} />
            </Field>
            <Field label="Job Type" required>
              <select value={form.type} onChange={f("type")} style={selectStyle}
                onFocus={e=>e.target.style.borderColor="#0b2f5b"} onBlur={e=>e.target.style.borderColor="#e5e7eb"}>
                <option value="">Select type...</option>
                {JOB_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Experience">
              <input value={form.experience} onChange={f("experience")} placeholder="e.g. 2-4 years, Fresher" style={inputStyle}
                onFocus={e=>e.target.style.borderColor="#0b2f5b"} onBlur={e=>e.target.style.borderColor="#e5e7eb"} />
            </Field>
            <Field label="Salary">
              <input value={form.salary} onChange={f("salary")} placeholder="e.g. 5-8 LPA, 12 LPA" style={inputStyle}
                onFocus={e=>e.target.style.borderColor="#0b2f5b"} onBlur={e=>e.target.style.borderColor="#e5e7eb"} />
            </Field>
            <Field label="Education Qualification">
              <input value={form.education} onChange={f("education")} placeholder="e.g. B.Tech, MBA" style={inputStyle}
                onFocus={e=>e.target.style.borderColor="#0b2f5b"} onBlur={e=>e.target.style.borderColor="#e5e7eb"} />
            </Field>
            <Field label="No. of Vacancies">
              <input type="number" min="1" value={form.vacancy} onChange={f("vacancy")} placeholder="e.g. 2" style={inputStyle}
                onFocus={e=>e.target.style.borderColor="#0b2f5b"} onBlur={e=>e.target.style.borderColor="#e5e7eb"} />
            </Field>
            <Field label="Gender">
              <select value={form.gender} onChange={f("gender")} style={selectStyle}
                onFocus={e=>e.target.style.borderColor="#0b2f5b"} onBlur={e=>e.target.style.borderColor="#e5e7eb"}>
                <option value="">Select...</option>
                {GENDER_OPTS.map(g => <option key={g}>{g}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Job Description">
            <textarea value={form.description} onChange={f("description")} rows={4}
              placeholder="Describe the role, responsibilities, and what you're looking for..."
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
              onFocus={e=>e.target.style.borderColor="#0b2f5b"} onBlur={e=>e.target.style.borderColor="#e5e7eb"} />
          </Field>

          {savingMsg && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "10px",
              padding: "10px 14px", marginBottom: "16px", color: "#dc2626", fontSize: "13px"
            }}>❌ {savingMsg}</div>
          )}

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button onClick={() => setModalOpen(false)} style={{
              padding: "11px 20px", background: "#f3f4f6", border: "none", borderRadius: "10px",
              fontWeight: 600, fontSize: "14px", cursor: "pointer", fontFamily: "inherit", color: "#374151"
            }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{
              padding: "11px 24px",
              background: saving ? "#93a8c4" : "linear-gradient(135deg, #0b2f5b, #1a4a8a)",
              color: "white", border: "none", borderRadius: "10px",
              fontWeight: 700, fontSize: "14px", cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit", display: "flex", alignItems: "center", gap: "8px",
              boxShadow: saving ? "none" : "0 4px 14px rgba(11,47,91,0.3)"
            }}>
              {saving ? (
                <><span style={{ width:"14px",height:"14px",border:"2px solid rgba(255,255,255,0.4)",borderTop:"2px solid white",borderRadius:"50%",animation:"spin 0.8s linear infinite",display:"inline-block" }} />Saving...</>
              ) : (
                <>{editJob ? "💾 Save Changes" : "🚀 Post Job"}</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Job Description Viewer Modal */}
      <Modal open={!!descJob} onClose={() => setDescJob(null)}>
        {descJob && (
          <div style={{ padding: "28px 32px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
              <div>
                <h2 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 700, color: "#111827" }}>{descJob.title}</h2>
                <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>Job ID: #{descJob.id} · {descJob.location} · {descJob.type}</p>
              </div>
              <button onClick={() => setDescJob(null)} style={{
                background: "#f3f4f6", border: "none", borderRadius: "8px", width: "32px", height: "32px",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", color: "#374151", flexShrink: 0
              }}>✕</button>
            </div>
            <div style={{ background: "#f9fafb", borderRadius: "12px", padding: "20px", maxHeight: "55vh", overflowY: "auto", fontSize: "14px", color: "#374151", lineHeight: 1.8 }}>
              {(descJob.description || 'No description provided.').split('\n').map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={i} style={{height: '8px'}} />;
                const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*');
                if (isBullet) {
                  return (
                    <div key={i} style={{display: 'flex', gap: '8px', marginBottom: '4px', paddingLeft: '4px'}}>
                      <span style={{color: '#0b2f5b', fontWeight: 700, flexShrink: 0}}>•</span>
                      <span>{trimmed.replace(/^[•\-\*]\s*/, '')}</span>
                    </div>
                  );
                }
                return <div key={i} style={{marginBottom: '4px'}}>{trimmed}</div>;
              })}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <div style={{ padding: "32px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🗑️</div>
          <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 700, color: "#111827" }}>Delete Job?</h2>
          <p style={{ margin: "0 0 24px", color: "#6b7280", fontSize: "14px", lineHeight: 1.6 }}>
            Are you sure you want to delete <strong>"{deleteTarget?.title}"</strong>?<br />
            This will remove it from the Google Sheet and the public job listings page.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button onClick={() => setDeleteTarget(null)} style={{
              padding: "11px 24px", background: "#f3f4f6", border: "none", borderRadius: "10px",
              fontWeight: 600, fontSize: "14px", cursor: "pointer", fontFamily: "inherit"
            }}>Cancel</button>
            <button onClick={handleDelete} disabled={deleting} style={{
              padding: "11px 24px", background: deleting ? "#f87171" : "#dc2626",
              color: "white", border: "none", borderRadius: "10px",
              fontWeight: 700, fontSize: "14px", cursor: deleting ? "not-allowed" : "pointer",
              fontFamily: "inherit"
            }}>
              {deleting ? "Deleting..." : "Yes, Delete"}
            </button>
          </div>
        </div>
      </Modal>

      <style>{`
        @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes toastIn { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}
