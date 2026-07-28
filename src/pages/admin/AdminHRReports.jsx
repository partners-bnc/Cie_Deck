import { useState, useEffect } from "react";
import { jobService } from "../../services/jobService.js";
import { supabase } from "../../services/supabaseClient.js";
import { FiPieChart, FiBarChart2, FiUsers, FiPhoneCall, FiAward, FiLoader, FiDownloadCloud, FiFilter } from "react-icons/fi";

export default function AdminHRReports() {
  const [rawData, setRawData] = useState({ candidates: [], shortlisted: [], logs: [], admins: [] });
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Date filtering state
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [datePreset, setDatePreset] = useState("");

  const handleQuickFilter = (preset) => {
    setDatePreset(preset);
    if (!preset) {
      setFromDate("");
      setToDate("");
      return;
    }
    const today = new Date();
    let start = "";
    let end = "";
    
    const formatDateStr = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    switch (preset) {
      case "today": {
        start = formatDateStr(today);
        end = formatDateStr(today);
        break;
      }
      case "yesterday": {
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        start = formatDateStr(yesterday);
        end = formatDateStr(yesterday);
        break;
      }
      case "this_week": {
        const first = today.getDate() - today.getDay();
        const firstDay = new Date(today.setDate(first));
        const lastDay = new Date(today.setDate(first + 6));
        start = formatDateStr(firstDay);
        end = formatDateStr(lastDay);
        break;
      }
      case "last_7_days": {
        const past = new Date();
        past.setDate(today.getDate() - 6);
        start = formatDateStr(past);
        end = formatDateStr(new Date());
        break;
      }
      case "this_month": {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        start = formatDateStr(firstDay);
        end = formatDateStr(lastDay);
        break;
      }
      case "last_month": {
        const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
        start = formatDateStr(firstDay);
        end = formatDateStr(lastDay);
        break;
      }
      case "this_year": {
        start = `${today.getFullYear()}-01-01`;
        end = `${today.getFullYear()}-12-31`;
        break;
      }
      // Specific months in current year
      case "january":
      case "february":
      case "march":
      case "april":
      case "may":
      case "june":
      case "july":
      case "august":
      case "september":
      case "october":
      case "november":
      case "december": {
        const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
        const monthIndex = months.indexOf(preset);
        const firstDay = new Date(today.getFullYear(), monthIndex, 1);
        const lastDay = new Date(today.getFullYear(), monthIndex + 1, 0);
        start = formatDateStr(firstDay);
        end = formatDateStr(lastDay);
        break;
      }
      default:
        start = "";
        end = "";
        break;
    }
    setFromDate(start);
    setToDate(end);
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const admins = await jobService.fetchAllAdmins();

        // 1. Refresh aggregates (runs instantly on database server)
        await supabase.rpc('refresh_dashboard_aggregates');

        // 2. Fetch pre-aggregated daily stats
        const { data: statsData, error: statsError } = await supabase
          .from('dashboard_hr_daily_stats')
          .select('stat_date, hr_name, uploaded_count, tagged_count, calls_count');

        if (statsError) throw statsError;

        // 3. Map statsData to rawData candidates, shortlisted, and logs
        const candidates = [];
        const shortlisted = [];
        const logs = [];

        (statsData || []).forEach(row => {
          const dateStr = row.stat_date; // YYYY-MM-DD
          const hrName = row.hr_name;

          // For resumes sourced
          if (row.uploaded_count > 0) {
            for (let i = 0; i < row.uploaded_count; i++) {
              candidates.push({
                uploadedBy: hrName,
                createdOn: dateStr
              });
            }
          }

          // For shortlisted
          if (row.tagged_count > 0) {
            for (let i = 0; i < row.tagged_count; i++) {
              shortlisted.push({
                shortlistedBy: hrName,
                shortlistedOn: dateStr
              });
            }
          }

          // For calls
          if (row.calls_count > 0) {
            for (let i = 0; i < row.calls_count; i++) {
              logs.push({
                hr_name: hrName,
                created_at: dateStr
              });
            }
          }
        });

        setRawData({ candidates, shortlisted, logs, admins: admins || [] });
      } catch (e) {
        console.error("Failed to load HR reports data", e);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!rawData.admins.length && !rawData.candidates.length) return;
    
    let fromTs = fromDate ? new Date(fromDate).getTime() : 0;
    let toTs = toDate ? new Date(toDate).setHours(23, 59, 59, 999) : Infinity;

    const statsMap = {};
    rawData.admins.forEach(admin => {
      const name = admin.hr_name;
      statsMap[name] = { 
        name, uploaded: 0, shortlisted: 0, callsLogged: 0,
        active: admin.is_active, role: admin.role
      };
    });

    rawData.candidates.forEach(c => {
      if (c.uploadedBy) {
        let createdTs = c.timestamp ? new Date(c.timestamp).getTime() : c.createdOn ? new Date(c.createdOn).getTime() : Date.now();
        if (createdTs >= fromTs && createdTs <= toTs) {
          if (!statsMap[c.uploadedBy]) statsMap[c.uploadedBy] = { name: c.uploadedBy, uploaded: 0, shortlisted: 0, callsLogged: 0 };
          statsMap[c.uploadedBy].uploaded += 1;
        }
      }
    });

    rawData.shortlisted.forEach(s => {
      if (s.shortlistedBy) {
        let taggedTs = s.shortlistedOn ? new Date(s.shortlistedOn).getTime() : s.timestamp ? new Date(s.timestamp).getTime() : s.createdOn ? new Date(s.createdOn).getTime() : Date.now();
        if (taggedTs >= fromTs && taggedTs <= toTs) {
          if (!statsMap[s.shortlistedBy]) statsMap[s.shortlistedBy] = { name: s.shortlistedBy, uploaded: 0, shortlisted: 0, callsLogged: 0 };
          statsMap[s.shortlistedBy].shortlisted += 1;
        }
      }
    });

    rawData.logs.forEach(log => {
      if (log.hr_name) {
        let logTs = log.created_at ? new Date(log.created_at).getTime() : Date.now();
        if (logTs >= fromTs && logTs <= toTs) {
          if (!statsMap[log.hr_name]) statsMap[log.hr_name] = { name: log.hr_name, uploaded: 0, shortlisted: 0, callsLogged: 0 };
          statsMap[log.hr_name].callsLogged += 1;
        }
      }
    });

    const statsArray = Object.values(statsMap).sort((a, b) => b.uploaded - a.uploaded);
    setReportData(statsArray);
  }, [rawData, fromDate, toDate]);

  const handleExport = () => {
    let csvContent = "data:text/csv;charset=utf-8,HR Name,Role,Resumes Sourced,Shortlisted (Tagged),Calls Logged\n";
    reportData.forEach(row => {
        let role = row.role === 'super_admin' ? 'Super Admin' : 'HR/Admin';
        csvContent += `"${row.name}","${role}",${row.uploaded},${row.shortlisted},${row.callsLogged}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `HR_Performance_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const s = {
    page: { padding: "32px 24px 32px 0px", maxWidth: "100%", margin: "0 auto", fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", flexWrap: "wrap", gap: "12px" },
    title: { fontSize: "24px", fontWeight: 800, color: "#1e293b", margin: 0, display: 'flex', alignItems: 'center', gap: '10px' },
    subtitle: { fontSize: "14px", color: "#64748b", margin: "6px 0 0" },
    card: { background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" },
    table: { width: "100%", borderCollapse: "collapse", fontSize: "14px" },
    th: { padding: "16px 20px", textAlign: "left", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontWeight: 700, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" },
    td: { padding: "16px 20px", borderBottom: "1px solid #f1f5f9", color: "#334155" },
    overviewGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' },
    statCard: { background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'flex-start', gap: '18px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' },
    iconBox: (color, bg) => ({ width: '54px', height: '54px', borderRadius: '14px', background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }),
    statNum: { fontSize: '28px', fontWeight: 800, color: '#1e293b', lineHeight: 1.2 },
    statLabel: { fontSize: '14px', color: '#64748b', fontWeight: 600 }
  };

  const totalUploaded = reportData.reduce((acc, curr) => acc + curr.uploaded, 0);
  const totalShortlisted = reportData.reduce((acc, curr) => acc + curr.shortlisted, 0);
  const totalCalls = reportData.reduce((acc, curr) => acc + curr.callsLogged, 0);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}><FiPieChart style={{ color: '#0B2F5B' }} /> HR Performance Report</h1>
          <p style={s.subtitle}>Analyze HR sourcing, shortlisting, and calling activities.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 12px' }}>
            <FiFilter color="#64748b" />
            <select
              value={datePreset}
              onChange={e => handleQuickFilter(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: '13px', color: '#334155', background: 'transparent', marginRight: '8px', cursor: 'pointer', fontWeight: 600 }}
            >
              <option value="">Custom Range</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_year">This Year</option>
              <optgroup label="Select Month">
                <option value="january">January</option>
                <option value="february">February</option>
                <option value="march">March</option>
                <option value="april">April</option>
                <option value="may">May</option>
                <option value="june">June</option>
                <option value="july">July</option>
                <option value="august">August</option>
                <option value="september">September</option>
                <option value="october">October</option>
                <option value="november">November</option>
                <option value="december">December</option>
              </optgroup>
            </select>
            <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setDatePreset(""); }} style={{ border: 'none', outline: 'none', fontSize: '13px', color: '#334155', background: 'transparent' }} />
            <span style={{ color: '#cbd5e1' }}>→</span>
            <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setDatePreset(""); }} style={{ border: 'none', outline: 'none', fontSize: '13px', color: '#334155', background: 'transparent' }} />
          </div>
          <button 
            onClick={handleExport}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0B2F5B', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            <FiDownloadCloud size={16} /> Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 20px', color: '#94a3b8' }}>
          <FiLoader size={36} style={{ animation: 'spin 1.5s linear infinite', marginBottom: '16px', color: '#0B2F5B' }} />
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Loading Report Data...</div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Please wait while the HR breakdown is compiled.</div>
        </div>
      ) : (
        <>
          <div style={s.overviewGrid}>
            <div style={s.statCard}>
              <div style={s.iconBox('#3b82f6', '#eff6ff')}><FiUsers size={20} /></div>
              <div>
                <div style={s.statLabel}>Total Resumes Sourced</div>
                <div style={s.statNum}>{totalUploaded}</div>
              </div>
            </div>
            <div style={s.statCard}>
              <div style={s.iconBox('#059669', '#f0fdf4')}><FiAward size={20} /></div>
              <div>
                <div style={s.statLabel}>Total Candidates Shortlisted</div>
                <div style={s.statNum}>{totalShortlisted}</div>
              </div>
            </div>
            <div style={s.statCard}>
              <div style={s.iconBox('#7c3aed', '#f5f3ff')}><FiPhoneCall size={20} /></div>
              <div>
                <div style={s.statLabel}>Total Calls / Interactions Logged</div>
                <div style={s.statNum}>{totalCalls}</div>
              </div>
            </div>
          </div>

          <div style={s.card}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiBarChart2 size={16} /> Individual HR Performance Breakdown
              </h3>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>HR Name</th>
                    <th style={{ ...s.th, textAlign: 'center' }}>Resumes Sourced</th>
                    <th style={{ ...s.th, textAlign: 'center' }}>Shortlisted (Tagged)</th>
                    <th style={{ ...s.th, textAlign: 'center' }}>Calls Logged</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((hr, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                      <td style={{ ...s.td, fontWeight: 700 }}>
                        {hr.name}
                        {hr.role === 'super_admin' && <span style={{ marginLeft: '8px', padding: '2px 6px', background: '#e0e7ff', color: '#4f46e5', fontSize: '10px', borderRadius: '4px' }}>Super Admin</span>}
                      </td>
                      <td style={{ ...s.td, textAlign: 'center', fontWeight: 600 }}>{hr.uploaded}</td>
                      <td style={{ ...s.td, textAlign: 'center', fontWeight: 600, color: '#059669' }}>{hr.shortlisted}</td>
                      <td style={{ ...s.td, textAlign: 'center', fontWeight: 600, color: '#7c3aed' }}>{hr.callsLogged}</td>
                    </tr>
                  ))}
                  {reportData.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>No HR data found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
