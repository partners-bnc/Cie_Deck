import { useState, useEffect } from "react";
import { jobService } from "../../services/jobService.js";

export default function AdminManagement() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadingId, setUploadingId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    admin: null,
    file: null,
    previewUrl: null
  });

  const [form, setForm] = useState({
    hrName: "", email: "", password: "", phone: "",
    department: "Talent Acquisition", designation: "", role: "hr",
    avatarFile: null
  });
  const [newAvatarPreview, setNewAvatarPreview] = useState(null);
  
  const userRole = sessionStorage.getItem("bnc_admin_role");
  const isSuperAdmin = userRole === "super_admin";

  useEffect(() => { loadAdmins(); }, []);

  const loadAdmins = async () => {
    setLoading(true);
    const data = await jobService.fetchAllAdmins();
    setAdmins(data);
    setLoading(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      setMessage("Error: Only Super Admins can add new admins.");
      return;
    }
    if (!form.hrName || !form.email || !form.password) {
      setMessage("Name, Email and Password are required.");
      return;
    }
    setSaving(true);
    setMessage("");
    const result = await jobService.createAdmin(form);
    if (result.success) {
      setMessage("Admin added successfully!");
      setForm({
        hrName: "", email: "", password: "", phone: "",
        department: "Talent Acquisition", designation: "", role: "hr",
        avatarFile: null
      });
      setNewAvatarPreview(null);
      setShowAddForm(false);
      await loadAdmins();
    } else {
      setMessage("Error: " + (result.error || "Failed to add admin"));
    }
    setSaving(false);
  };

  const handleToggle = async (admin) => {
    if (!isSuperAdmin) {
      alert("Only Super Admins can perform this action.");
      return;
    }
    const result = await jobService.toggleAdminStatus(admin.id, !admin.is_active);
    if (result.success) loadAdmins();
    else setMessage("Error: " + result.error);
  };

  // Triggers when Super Admin selects a photo to upload or update
  const handleFileSelect = (admin, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Error: Image size must be less than 5MB.");
      e.target.value = "";
      return;
    }

    // Validate type
    if (!file.type.startsWith("image/")) {
      setMessage("Error: Please select a valid image file (PNG, JPG, WebP).");
      e.target.value = "";
      return;
    }

    const preview = URL.createObjectURL(file);
    setConfirmModal({
      open: true,
      admin,
      file,
      previewUrl: preview
    });
    e.target.value = "";
  };

  // Executes upload or update after Super Admin confirms
  const executeUpload = async () => {
    if (!confirmModal.admin || !confirmModal.file) return;
    const adminId = confirmModal.admin.id;
    const adminName = confirmModal.admin.hr_name;
    const isUpdate = Boolean(confirmModal.admin.avatar_url);
    const fileToUpload = confirmModal.file;

    setUploadingId(adminId);
    setMessage("");
    setConfirmModal({ open: false, admin: null, file: null, previewUrl: null });

    const res = await jobService.uploadAdminAvatar(adminId, fileToUpload);
    if (res.success) {
      setMessage(`Profile picture for ${adminName} ${isUpdate ? "updated" : "uploaded"} successfully!`);
      await loadAdmins();
    } else {
      setMessage(`Error: ${res.error || "Failed to upload profile picture"}`);
    }
    setUploadingId(null);
  };

  const s = {
    page: { padding: "24px 40px", maxWidth: "1600px", margin: "0 auto", fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" },
    title: { fontSize: "22px", fontWeight: 700, color: "#0b2f5b", margin: 0 },
    subtitle: { fontSize: "13px", color: "#6b7280", margin: "4px 0 0" },
    addBtn: { 
      padding: "10px 22px", 
      background: "linear-gradient(135deg, #0b2f5b, #1a4a8a)", 
      color: "#fff", 
      border: "none", 
      borderRadius: "12px", 
      fontWeight: 700, 
      fontSize: "13px", 
      cursor: "pointer",
      transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
      boxShadow: "0 4px 14px rgba(11, 47, 91, 0.35), inset 0 2px 4px rgba(255,255,255,0.2)",
      textTransform: "uppercase",
      letterSpacing: "0.5px"
    },
    card: { background: "#fff", borderRadius: "14px", border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.04)" },
    table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
    th: { padding: "12px 16px", textAlign: "left", background: "#f8f9fb", borderBottom: "1px solid #e5e7eb", color: "#374151", fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" },
    td: { padding: "12px 16px", borderBottom: "1px solid #f3f4f6", color: "#374151", verticalAlign: "middle" },
    badge: (active) => ({ padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, background: active ? "#ecfdf5" : "#fef2f2", color: active ? "#059669" : "#dc2626" }),
    toggleBtn: (active) => ({
      padding: "6px 14px", borderRadius: "10px", border: "none", fontSize: "11px", fontWeight: 700, 
      cursor: "pointer", transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)", 
      background: active ? "linear-gradient(135deg, #f87171, #ef4444)" : "linear-gradient(135deg, #34d399, #10b981)", 
      color: "#fff", 
      boxShadow: active 
        ? "0 3px 6px -1px rgba(239, 68, 68, 0.3), inset 0 1px 2px rgba(255,255,255,0.3)"
        : "0 3px 6px -1px rgba(16, 185, 129, 0.3), inset 0 1px 2px rgba(255,255,255,0.3)",
      textTransform: "uppercase", letterSpacing: "0.5px",
      display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "110px"
    }),
    form: { background: "#fff", borderRadius: "14px", border: "1px solid #e5e7eb", padding: "24px", marginBottom: "20px" },
    input: { width: "100%", boxSizing: "border-box", border: "1.5px solid #e5e7eb", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", fontFamily: "inherit", outline: "none", background: "#f9fafb" },
    label: { display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "6px" },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginBottom: "16px" },
    msg: { padding: "10px 14px", borderRadius: "10px", marginBottom: "16px", fontSize: "13px" },
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Admin Management</h1>
          <p style={s.subtitle}>Manage HR admin accounts ({admins.length} total)</p>
        </div>
        {isSuperAdmin && (
          <button 
            style={s.addBtn} 
            onClick={() => setShowAddForm(!showAddForm)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
              e.currentTarget.style.boxShadow = "0 8px 20px rgba(11, 47, 91, 0.45), inset 0 2px 4px rgba(255,255,255,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0) scale(1)";
              e.currentTarget.style.boxShadow = s.addBtn.boxShadow;
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.96)"}
            onMouseUp={(e) => e.currentTarget.style.transform = "translateY(-2px) scale(1.02)"}
          >
            {showAddForm ? "✕ Cancel" : "+ Add Admin"}
          </button>
        )}
      </div>

      {message && (
        <div style={{ ...s.msg, background: message.startsWith("Error") ? "#fef2f2" : "#ecfdf5", color: message.startsWith("Error") ? "#dc2626" : "#059669", border: `1px solid ${message.startsWith("Error") ? "#fecaca" : "#a7f3d0"}` }}>
          {message}
        </div>
      )}

      {showAddForm && (
        <form style={s.form} onSubmit={handleAdd}>
          <h3 style={{ margin: "0 0 16px", fontSize: "16px", color: "#0b2f5b" }}>Add New Admin</h3>
          <div style={s.grid}>
            <div>
              <label style={s.label}>Full Name *</label>
              <input style={s.input} value={form.hrName} onChange={e => setForm({ ...form, hrName: e.target.value })} placeholder="e.g. John Doe" />
            </div>
            <div>
              <label style={s.label}>Email *</label>
              <input style={s.input} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@company.com" />
            </div>
            <div>
              <label style={s.label}>Password *</label>
              <input style={s.input} type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Minimum 6 characters" />
            </div>
            <div>
              <label style={s.label}>Phone</label>
              <input style={s.input} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="9876543210" />
            </div>
            <div>
              <label style={s.label}>Department</label>
              <input style={s.input} value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
            </div>
            <div>
              <label style={s.label}>Designation</label>
              <input style={s.input} value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Senior Recruiter" />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={s.label}>Profile Picture (Optional)</label>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", background: "#f8fafc", padding: "12px 16px", borderRadius: "10px", border: "1px dashed #cbd5e1" }}>
                {newAvatarPreview ? (
                  <img
                    src={newAvatarPreview}
                    alt="Preview"
                    style={{ width: "46px", height: "46px", borderRadius: "50%", objectFit: "cover", border: "2px solid #0b2f5b", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}
                  />
                ) : (
                  <div style={{
                    width: "46px", height: "46px", borderRadius: "50%", background: "#e2e8f0",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#64748b", fontSize: "11px", fontWeight: 700
                  }}>
                    Photo
                  </div>
                )}
                <div>
                  <label style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    padding: "7px 14px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "8px",
                    fontSize: "12px", fontWeight: 600, color: "#334155", cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                  }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Choose Photo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setForm({ ...form, avatarFile: file });
                          setNewAvatarPreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </label>
                  {form.avatarFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setForm({ ...form, avatarFile: null });
                        setNewAvatarPreview(null);
                      }}
                      style={{ marginLeft: "10px", background: "none", border: "none", color: "#ef4444", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}
                    >
                      ✕ Remove
                    </button>
                  )}
                  <span style={{ display: "block", fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                    JPG, PNG, or WebP (max 5MB). You can also update the photo anytime.
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setShowAddForm(false)} style={{ padding: "10px 20px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontSize: "13px", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ ...s.addBtn, opacity: saving ? 0.7 : 1 }}>{saving ? "Adding..." : "Add Admin"}</button>
          </div>
        </form>
      )}

      <div style={s.card}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Loading admins...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={{ ...s.th, width: "40px" }}>#</th>
                  <th style={{ ...s.th, width: "70px", textAlign: "center" }}>Photo</th>
                  <th style={s.th}>Name</th>
                  <th style={s.th}>Email</th>
                  <th style={s.th}>Phone</th>
                  <th style={s.th}>Designation</th>
                  <th style={s.th}>Role</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}>{isSuperAdmin ? "Actions" : "Access"}</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin, i) => (
                  <tr key={admin.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                    <td style={s.td}>{i + 1}</td>
                    
                    {/* Sleek Profile Photo with Camera Dot Badge */}
                    <td style={{ ...s.td, textAlign: "center", width: "70px" }}>
                      <div style={{ position: "relative", width: "42px", height: "42px", display: "inline-block" }}>
                        {admin.avatar_url ? (
                          <img
                            src={admin.avatar_url}
                            alt={admin.hr_name}
                            onClick={() => setPreviewImage({ url: admin.avatar_url, name: admin.hr_name, admin })}
                            title="Click to view full photo"
                            style={{
                              width: "42px",
                              height: "42px",
                              borderRadius: "50%",
                              objectFit: "cover",
                              border: "2px solid #cbd5e1",
                              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                              cursor: "pointer",
                              display: "block",
                              transition: "all 0.2s"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = "scale(1.08)";
                              e.currentTarget.style.borderColor = "#0b2f5b";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "scale(1)";
                              e.currentTarget.style.borderColor = "#cbd5e1";
                            }}
                          />
                        ) : (
                          <div
                            onClick={() => {
                              if (isSuperAdmin) {
                                document.getElementById(`avatar-file-${admin.id}`)?.click();
                              }
                            }}
                            title={isSuperAdmin ? "Click dot or avatar to upload photo" : admin.hr_name}
                            style={{
                              width: "42px",
                              height: "42px",
                              borderRadius: "50%",
                              background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: "13px",
                              color: "#1e40af",
                              border: "1.5px solid #bfdbfe",
                              boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                              cursor: isSuperAdmin ? "pointer" : "default",
                              userSelect: "none"
                            }}
                          >
                            {admin.hr_name ? admin.hr_name.substring(0, 2).toUpperCase() : "HR"}
                          </div>
                        )}

                        {/* Camera Dot Button for Super Admin to upload / update photo */}
                        {isSuperAdmin && (
                          <label
                            htmlFor={`avatar-file-${admin.id}`}
                            title={admin.avatar_url ? "Click dot to change/update photo" : "Click dot to upload photo"}
                            style={{
                              position: "absolute",
                              bottom: "-2px",
                              right: "-2px",
                              width: "18px",
                              height: "18px",
                              borderRadius: "50%",
                              background: uploadingId === admin.id ? "#94a3b8" : "linear-gradient(135deg, #0b2f5b, #1d4ed8)",
                              border: "2px solid #ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: uploadingId === admin.id ? "not-allowed" : "pointer",
                              boxShadow: "0 2px 5px rgba(0,0,0,0.25)",
                              color: "#ffffff",
                              transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.25)")}
                            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                          >
                            <input
                              id={`avatar-file-${admin.id}`}
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/gif"
                              style={{ display: "none" }}
                              disabled={uploadingId === admin.id}
                              onChange={(e) => handleFileSelect(admin, e)}
                            />
                            {uploadingId === admin.id ? (
                              <div style={{ width: "8px", height: "8px", border: "1.5px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                            ) : (
                              <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            )}
                          </label>
                        )}
                      </div>
                    </td>

                    <td style={{ ...s.td, fontWeight: 600 }}>{admin.hr_name}</td>
                    <td style={s.td}>{admin.email}</td>
                    <td style={s.td}>{admin.phone || "—"}</td>
                    <td style={s.td}>{admin.designation || "—"}</td>
                    <td style={s.td}>
                      <span style={{ ...s.badge(true), background: admin.role === 'super_admin' ? '#eff6ff' : '#f5f3ff', color: admin.role === 'super_admin' ? '#2563eb' : '#7c3aed' }}>
                        {admin.role === 'super_admin' ? 'Super Admin' : 'HR'}
                      </span>
                    </td>
                    <td style={s.td}><span style={s.badge(admin.is_active)}>{admin.is_active ? "Active" : "Inactive"}</span></td>
                    <td style={s.td}>
                      {isSuperAdmin ? (
                        <button
                          style={s.toggleBtn(admin.is_active)}
                          onClick={() => handleToggle(admin)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "scale(1.03)";
                            e.currentTarget.style.boxShadow = admin.is_active 
                              ? "0 6px 10px -2px rgba(239, 68, 68, 0.4)" 
                              : "0 6px 10px -2px rgba(16, 185, 129, 0.4)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "scale(1)";
                            e.currentTarget.style.boxShadow = s.toggleBtn(admin.is_active).boxShadow;
                          }}
                          onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.97)"}
                          onMouseUp={(e) => e.currentTarget.style.transform = "scale(1.03)"}
                        >
                          {admin.is_active ? "Deactivate" : "Activate"}
                        </button>
                      ) : (
                        <span style={{ color: "#9ca3af", fontStyle: "italic" }}>No Permission</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lightbox / High-Res Preview Modal */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 99999, padding: "20px"
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#ffffff", borderRadius: "16px", padding: "24px", maxWidth: "420px",
              width: "100%", textAlign: "center", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", color: "#0f172a", fontWeight: 700 }}>{previewImage.name}</h3>
              <button 
                onClick={() => setPreviewImage(null)}
                style={{ background: "#f1f5f9", border: "none", borderRadius: "50%", width: "30px", height: "30px", cursor: "pointer", fontWeight: 700, color: "#64748b" }}
              >
                ✕
              </button>
            </div>
            <img 
              src={previewImage.url} 
              alt={previewImage.name} 
              style={{ width: "220px", height: "220px", borderRadius: "50%", objectFit: "cover", margin: "0 auto 16px", border: "4px solid #f8fafc", boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }} 
            />
            {isSuperAdmin && previewImage.admin && (
              <div style={{ marginTop: "8px" }}>
                <label style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "8px 16px", background: "linear-gradient(135deg, #0b2f5b, #1d4ed8)",
                  color: "#ffffff", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                  cursor: "pointer", boxShadow: "0 2px 6px rgba(11, 47, 91, 0.25)"
                }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Update Photo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const admin = previewImage.admin;
                      setPreviewImage(null);
                      handleFileSelect(admin, e);
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal for Photo Upload / Update */}
      {confirmModal.open && (
        <div 
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 99999, padding: "20px"
          }}
        >
          <div 
            style={{
              background: "#ffffff", borderRadius: "16px", padding: "28px", maxWidth: "440px",
              width: "100%", textAlign: "center", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #e2e8f0"
            }}
          >
            <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "#eff6ff", color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>

            <h3 style={{ margin: "0 0 8px", fontSize: "18px", color: "#0f172a", fontWeight: 700 }}>
              {confirmModal.admin?.avatar_url ? "Update Profile Picture" : "Upload Profile Picture"}
            </h3>
            
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#64748b", lineHeight: 1.5 }}>
              {confirmModal.admin?.avatar_url 
                ? <>You are updating the profile picture for <strong>{confirmModal.admin?.hr_name}</strong>.</>
                : <>You are uploading a new profile picture for <strong>{confirmModal.admin?.hr_name}</strong>.</>
              }
            </p>

            {confirmModal.previewUrl && (
              <img 
                src={confirmModal.previewUrl} 
                alt="Preview" 
                style={{ width: "120px", height: "120px", borderRadius: "50%", objectFit: "cover", margin: "0 auto 20px", border: "3px solid #0b2f5b", boxShadow: "0 4px 12px rgba(11, 47, 91, 0.2)" }} 
              />
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setConfirmModal({ open: false, admin: null, file: null, previewUrl: null })}
                style={{
                  padding: "10px 18px", borderRadius: "10px", border: "1px solid #cbd5e1",
                  background: "#fff", color: "#475569", fontSize: "13px", fontWeight: 600, cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeUpload}
                style={{
                  padding: "10px 22px", borderRadius: "10px", border: "none",
                  background: "linear-gradient(135deg, #0b2f5b, #1d4ed8)", color: "#fff",
                  fontSize: "13px", fontWeight: 700, cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(11, 47, 91, 0.35)"
                }}
              >
                {confirmModal.admin?.avatar_url ? "Confirm & Update Photo" : "Confirm & Upload Photo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
