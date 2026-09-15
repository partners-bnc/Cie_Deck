import { useState, useEffect } from "react";
import { jobService } from "../../services/jobService.js";
import { supabase } from "../../services/supabaseClient.js";
import * as XLSX from "xlsx";
import { FiPieChart, FiBarChart2, FiUsers, FiPhoneCall, FiAward, FiLoader, FiDownloadCloud, FiFilter, FiLayers } from "react-icons/fi";

const PLATFORM_SOURCES = [
  'BNC Indeed',
  'BNC Linkedin',
  'BNC IIM',
  'BNC Job Hai',
  'BNC Others',
  'Linkedin',
  'Indeed',
  'IIM',
  'Others',
  'Ciedeck'
];

function normalizeSource(rawSource) {
  if (!rawSource) return 'Others';
  const trimmed = rawSource.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'bnc indeed') return 'BNC Indeed';
  if (lower === 'bnc linkedin') return 'BNC Linkedin';
  if (lower === 'bnc iim') return 'BNC IIM';
  if (lower === 'bnc job hai') return 'BNC Job Hai';
  if (lower === 'bnc others' || lower === 'bnc other') return 'BNC Others';
  if (lower === 'linkedin') return 'Linkedin';
  if (lower === 'indeed') return 'Indeed';
  if (lower === 'iim') return 'IIM';
  if (lower === 'others' || lower === 'other') return 'Others';
  if (lower === 'ciedeck') return 'Ciedeck';
  return trimmed;
}

export default function AdminHRReports() {
  const [rawData, setRawData] = useState({ candidates: [], shortlisted: [], logs: [], admins: [] });
  const [reportData, setReportData] = useState([]);
  const [sourceReportData, setSourceReportData] = useState([]);
  const [allSourceColumns, setAllSourceColumns] = useState(PLATFORM_SOURCES);
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
        try {
          await supabase.rpc('refresh_dashboard_aggregates');
        } catch (rpcErr) {
          console.warn("Aggregate refresh warning:", rpcErr);
        }

        // 2. Fetch pre-aggregated daily stats (runs in parallel, instant response)
        const [statsRes, sourceDailyRes] = await Promise.all([
          supabase
            .from('dashboard_hr_daily_stats')
            .select('stat_date, hr_name, uploaded_count, tagged_count, calls_count'),
          supabase
            .from('dashboard_hr_source_daily_stats')
            .select('stat_date, hr_name, source, uploaded_count')
        ]);

        if (statsRes.error) throw statsRes.error;
        const statsData = statsRes.data || [];
        const sourceDailyData = sourceDailyRes?.data || [];

        let candidates = [];
        if (sourceDailyData.length > 0) {
          // Fast path: use pre-aggregated daily source breakdown
          sourceDailyData.forEach(row => {
            candidates.push({
              uploadedBy: row.hr_name,
              createdOn: row.stat_date,
              source: row.source,
              count: row.uploaded_count || 1
            });
          });
        } else {
          // Fallback to daily stats table if source daily table is not yet migrated
          statsData.forEach(row => {
            const dateStr = row.stat_date;
            const hrName = row.hr_name;
            if (row.uploaded_count > 0) {
              candidates.push({
                uploadedBy: hrName,
                createdOn: dateStr,
                source: 'Others',
                count: row.uploaded_count
              });
            }
          });
        }

        const shortlisted = [];
        const logs = [];

        (statsData || []).forEach(row => {
          const dateStr = row.stat_date; // YYYY-MM-DD
          const hrName = row.hr_name;

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
    if (!rawData.admins.length && !rawData.candidates.length && !rawData.shortlisted.length && !rawData.logs.length) return;
    
    let fromTs = fromDate ? new Date(fromDate).getTime() : 0;
    let toTs = toDate ? new Date(toDate).setHours(23, 59, 59, 999) : Infinity;

    const statsMap = {};
    const sourceMap = {};

    rawData.admins.forEach(admin => {
      const name = admin.hr_name;
      statsMap[name] = { 
        name, uploaded: 0, shortlisted: 0, callsLogged: 0,
        active: admin.is_active, role: admin.role
      };
      sourceMap[name] = {
        name,
        role: admin.role,
        active: admin.is_active,
        sources: {},
        totalSourced: 0
      };
    });

    const extraSources = new Set();

    rawData.candidates.forEach(c => {
      if (c.uploadedBy) {
        let createdTs = c.timestamp ? new Date(c.timestamp).getTime() : c.createdOn ? new Date(c.createdOn).getTime() : Date.now();
        if (createdTs >= fromTs && createdTs <= toTs) {
          const count = Number(c.count) || 1;
          if (!statsMap[c.uploadedBy]) {
            statsMap[c.uploadedBy] = { name: c.uploadedBy, uploaded: 0, shortlisted: 0, callsLogged: 0 };
          }
          statsMap[c.uploadedBy].uploaded += count;

          if (!sourceMap[c.uploadedBy]) {
            sourceMap[c.uploadedBy] = {
              name: c.uploadedBy,
              role: 'hr',
              sources: {},
              totalSourced: 0
            };
          }
          const normSrc = normalizeSource(c.source);
          if (!PLATFORM_SOURCES.includes(normSrc)) {
            extraSources.add(normSrc);
          }
          sourceMap[c.uploadedBy].sources[normSrc] = (sourceMap[c.uploadedBy].sources[normSrc] || 0) + count;
          sourceMap[c.uploadedBy].totalSourced += count;
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

    const fullSourceCols = [...PLATFORM_SOURCES, ...Array.from(extraSources)];
    setAllSourceColumns(fullSourceCols);

    const sourceArray = Object.values(sourceMap).sort((a, b) => b.totalSourced - a.totalSourced);
    setSourceReportData(sourceArray);
  }, [rawData, fromDate, toDate]);

  const totalUploaded = reportData.reduce((acc, curr) => acc + curr.uploaded, 0);
  const totalShortlisted = reportData.reduce((acc, curr) => acc + curr.shortlisted, 0);
  const totalCalls = reportData.reduce((acc, curr) => acc + curr.callsLogged, 0);

  const sourceTotals = {};
  allSourceColumns.forEach(src => {
    sourceTotals[src] = sourceReportData.reduce((acc, curr) => acc + (curr.sources[src] || 0), 0);
  });
  const grandTotalSourced = sourceReportData.reduce((acc, curr) => acc + curr.totalSourced, 0);

  const handleExport = () => {
    const wb = XLSX.utils.book_new();

    // ── Sheet 1: HR Performance ──
    const ws1Rows = [
      ['HR Name', 'Role', 'Resumes Sourced', 'Shortlisted (Tagged)', 'Calls Logged']
    ];
    reportData.forEach(row => {
      const role = row.role === 'super_admin' ? 'Super Admin' : 'HR/Admin';
      ws1Rows.push([
        row.name,
        role,
        row.uploaded,
        row.shortlisted,
        row.callsLogged
      ]);
    });
    ws1Rows.push([
      'Total',
      '',
      totalUploaded,
      totalShortlisted,
      totalCalls
    ]);
    const ws1 = XLSX.utils.aoa_to_sheet(ws1Rows);
    XLSX.utils.book_append_sheet(wb, ws1, 'HR Performance');

    // ── Sheet 2: Platform Breakdown ──
    const ws2Header = ['HR Name', 'Role', ...allSourceColumns, 'Total Sourced'];
    const ws2Rows = [ws2Header];
    sourceReportData.forEach(row => {
      const role = row.role === 'super_admin' ? 'Super Admin' : 'HR/Admin';
      const sourceCounts = allSourceColumns.map(col => row.sources[col] || 0);
      ws2Rows.push([
        row.name,
        role,
        ...sourceCounts,
        row.totalSourced
      ]);
    });
    const footerCounts = allSourceColumns.map(col => sourceTotals[col] || 0);
    ws2Rows.push([
      'Total',
      '',
      ...footerCounts,
      grandTotalSourced
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet(ws2Rows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Platform Breakdown');

    const dateSuffix = fromDate && toDate ? `${fromDate}_to_${toDate}` : new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `HR_Performance_Report_${dateSuffix}.xlsx`);
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
            <FiDownloadCloud size={16} /> Export Excel
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
                {reportData.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#f1f5f9', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                      <td style={{ ...s.td, fontWeight: 800, color: '#1e293b' }}>Total</td>
                      <td style={{ ...s.td, textAlign: 'center', fontWeight: 800, color: '#1e293b' }}>{totalUploaded}</td>
                      <td style={{ ...s.td, textAlign: 'center', fontWeight: 800, color: '#059669' }}>{totalShortlisted}</td>
                      <td style={{ ...s.td, textAlign: 'center', fontWeight: 800, color: '#7c3aed' }}>{totalCalls}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Platform Source Wise Breakdown Table */}
          <div style={{ ...s.card, marginTop: '32px' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiLayers size={16} /> Platform Source Wise Breakdown
              </h3>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                Total Sourced: {grandTotalSourced}
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>HR Name</th>
                    {allSourceColumns.map(source => (
                      <th key={source} style={{ ...s.th, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {source}
                      </th>
                    ))}
                    <th style={{ ...s.th, textAlign: 'center', background: '#f1f5f9', fontWeight: 800, whiteSpace: 'nowrap' }}>
                      Total Sourced
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sourceReportData.map((hr, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                      <td style={{ ...s.td, fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {hr.name}
                        {hr.role === 'super_admin' && (
                          <span style={{ marginLeft: '8px', padding: '2px 6px', background: '#e0e7ff', color: '#4f46e5', fontSize: '10px', borderRadius: '4px' }}>
                            Super Admin
                          </span>
                        )}
                      </td>
                      {allSourceColumns.map(source => {
                        const count = hr.sources[source] || 0;
                        return (
                          <td key={source} style={{ ...s.td, textAlign: 'center', fontWeight: count > 0 ? 600 : 400, color: count > 0 ? '#1e293b' : '#94a3b8' }}>
                            {count}
                          </td>
                        );
                      })}
                      <td style={{ ...s.td, textAlign: 'center', fontWeight: 800, color: '#0B2F5B', background: '#f8fafc' }}>
                        {hr.totalSourced}
                      </td>
                    </tr>
                  ))}
                  {sourceReportData.length === 0 && (
                    <tr>
                      <td colSpan={allSourceColumns.length + 2} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                        No platform source data found
                      </td>
                    </tr>
                  )}
                </tbody>
                {sourceReportData.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#f1f5f9', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                      <td style={{ ...s.td, fontWeight: 800, color: '#1e293b' }}>Total</td>
                      {allSourceColumns.map(source => (
                        <td key={source} style={{ ...s.td, textAlign: 'center', fontWeight: 800, color: '#1e293b' }}>
                          {sourceTotals[source] || 0}
                        </td>
                      ))}
                      <td style={{ ...s.td, textAlign: 'center', fontWeight: 800, color: '#0B2F5B', background: '#e2e8f0' }}>
                        {grandTotalSourced}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
