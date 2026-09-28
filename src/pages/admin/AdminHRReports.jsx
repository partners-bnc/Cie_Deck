import { useState, useEffect, useMemo } from "react";
import { jobService } from "../../services/jobService.js";
import { supabase } from "../../services/supabaseClient.js";
import * as XLSX from "xlsx";
import {
  FiPieChart,
  FiBarChart2,
  FiUsers,
  FiPhoneCall,
  FiAward,
  FiLoader,
  FiDownloadCloud,
  FiFilter,
  FiLayers,
  FiCheckCircle,
  FiBriefcase,
  FiSearch
} from "react-icons/fi";

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

function formatDateDisplay(dStr) {
  if (!dStr) return "—";
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dStr;
  }
}

export default function AdminHRReports() {
  const [rawData, setRawData] = useState({
    candidates: [],
    shortlisted: [],
    logs: [],
    screenings: [],
    admins: [],
    activeJPCs: []
  });
  const [reportData, setReportData] = useState([]);
  const [sourceReportData, setSourceReportData] = useState([]);
  const [allSourceColumns, setAllSourceColumns] = useState(PLATFORM_SOURCES);
  const [selectedJpcCode, setSelectedJpcCode] = useState("");
  const [jpcSearch, setJpcSearch] = useState("");
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

        // 2. Fetch daily stats, source stats, applicants screenings, active jobs & tagged candidates
        const [statsRes, sourceDailyRes, screeningRes, clientJobsRes, taggedRes] = await Promise.all([
          supabase
            .from('dashboard_hr_daily_stats')
            .select('stat_date, hr_name, uploaded_count, tagged_count, calls_count'),
          supabase
            .from('dashboard_hr_source_daily_stats')
            .select('stat_date, hr_name, source, uploaded_count'),
          supabase
            .from('applicants')
            .select('applicant_code, screening, updated_on, created_on')
            .not('screening', 'is', null)
            .neq('screening', '[]')
            .order('updated_on', { ascending: false, nullsFirst: false })
            .limit(5000),
          supabase
            .from('client_jobs')
            .select('job_code, job_title, client_name, business_unit, recruitment_manager, created_on, status')
            .ilike('status', '%active%')
            .order('created_on', { ascending: false }),
          supabase
            .from('tagged_candidates')
            .select('id, applicant_code, name, job_code, shortlisted_by, created_at, current_stage, manager_submitted_at, client_submitted_at, feedback_received_at')
            .order('created_at', { ascending: false })
        ]);

        if (statsRes.error) throw statsRes.error;
        const statsData = statsRes.data || [];
        const sourceDailyData = sourceDailyRes?.data || [];
        const applicantsScreeningData = screeningRes?.data || [];
        const rawClientJobs = clientJobsRes?.data || [];
        const taggedData = taggedRes?.data || [];

        // Active JPCs calculation
        const activeJobs = rawClientJobs.filter(j => {
          const s = (j.status || '').toLowerCase();
          return s.includes('active') && !s.includes('hold') && !s.includes('close');
        });

        const taggedMap = new Map();
        taggedData.forEach(cand => {
          const code = cand.job_code;
          if (!taggedMap.has(code)) taggedMap.set(code, []);
          taggedMap.get(code).push(cand);
        });

        const activeJPCs = activeJobs.map(j => ({
          job_code: j.job_code,
          job_title: j.job_title,
          client_name: j.client_name,
          business_unit: j.business_unit,
          recruitment_manager: j.recruitment_manager,
          created_on: j.created_on,
          candidates: taggedMap.get(j.job_code) || []
        }));

        // Sourced candidates
        let candidates = [];
        if (sourceDailyData.length > 0) {
          sourceDailyData.forEach(row => {
            candidates.push({
              uploadedBy: row.hr_name,
              createdOn: row.stat_date,
              source: row.source,
              count: row.uploaded_count || 1
            });
          });
        } else {
          statsData.forEach(row => {
            if (row.uploaded_count > 0) {
              candidates.push({
                uploadedBy: row.hr_name,
                createdOn: row.stat_date,
                source: 'Others',
                count: row.uploaded_count
              });
            }
          });
        }

        // Shortlisted & Call logs
        const shortlisted = [];
        const logs = [];

        (statsData || []).forEach(row => {
          const dateStr = row.stat_date;
          const hrName = row.hr_name;

          if (row.tagged_count > 0) {
            for (let i = 0; i < row.tagged_count; i++) {
              shortlisted.push({
                shortlistedBy: hrName,
                shortlistedOn: dateStr
              });
            }
          }

          if (row.calls_count > 0) {
            for (let i = 0; i < row.calls_count; i++) {
              logs.push({
                hr_name: hrName,
                created_at: dateStr
              });
            }
          }
        });

        // Screenings flattening
        const screenings = [];
        applicantsScreeningData.forEach(row => {
          let sList = [];
          if (Array.isArray(row.screening)) sList = row.screening;
          else if (typeof row.screening === 'string') {
            try { sList = JSON.parse(row.screening); } catch {}
          }
          if (!Array.isArray(sList) && sList && typeof sList === 'object') sList = [sList];

          (sList || []).forEach(s => {
            if (!s) return;
            const hr = (s.hr_name || s.hrName || s.name || s.admin_name || s.shortlisted_by || '').trim();
            const dateStr = s.screened_at || s.screenedAt || s.date || s.created_at || row.updated_on;
            if (hr && dateStr) {
              screenings.push({
                hr_name: hr,
                date: dateStr
              });
            }
          });
        });

        setRawData({
          candidates,
          shortlisted,
          logs,
          screenings,
          admins: admins || [],
          activeJPCs
        });
      } catch (e) {
        console.error("Failed to load HR reports data", e);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!rawData.admins.length && !rawData.candidates.length && !rawData.shortlisted.length && !rawData.logs.length && !rawData.screenings.length) return;
    
    let fromTs = fromDate ? new Date(fromDate).getTime() : 0;
    let toTs = toDate ? new Date(toDate).setHours(23, 59, 59, 999) : Infinity;

    const statsMap = {};
    const sourceMap = {};

    rawData.admins.forEach(admin => {
      const name = admin.hr_name;
      statsMap[name] = { 
        name,
        uploaded: 0,
        shortlisted: 0,
        callsLogged: 0,
        screened: 0,
        active: admin.is_active,
        role: admin.role,
        designation: admin.designation
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
            statsMap[c.uploadedBy] = { name: c.uploadedBy, uploaded: 0, shortlisted: 0, callsLogged: 0, screened: 0 };
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
          if (!statsMap[s.shortlistedBy]) statsMap[s.shortlistedBy] = { name: s.shortlistedBy, uploaded: 0, shortlisted: 0, callsLogged: 0, screened: 0 };
          statsMap[s.shortlistedBy].shortlisted += 1;
        }
      }
    });

    rawData.logs.forEach(log => {
      if (log.hr_name) {
        let logTs = log.created_at ? new Date(log.created_at).getTime() : Date.now();
        if (logTs >= fromTs && logTs <= toTs) {
          if (!statsMap[log.hr_name]) statsMap[log.hr_name] = { name: log.hr_name, uploaded: 0, shortlisted: 0, callsLogged: 0, screened: 0 };
          statsMap[log.hr_name].callsLogged += 1;
        }
      }
    });

    rawData.screenings.forEach(sc => {
      if (sc && sc.hr_name) {
        let scTs = sc.date ? new Date(sc.date).getTime() : Date.now();
        if (isNaN(scTs)) scTs = 0;
        const matchesDate = (!fromTs || scTs >= fromTs) && (toTs === Infinity || scTs <= toTs);
        if (matchesDate) {
          const normScHr = sc.hr_name.trim().toLowerCase();
          const matchKey = Object.keys(statsMap).find(k => k.trim().toLowerCase() === normScHr) || sc.hr_name;
          if (!statsMap[matchKey]) {
            statsMap[matchKey] = {
              name: sc.hr_name,
              uploaded: 0,
              shortlisted: 0,
              callsLogged: 0,
              screened: 0,
              active: true,
              role: 'hr'
            };
          }
          statsMap[matchKey].screened += 1;
        }
      }
    });

    const statsArray = Object.values(statsMap).sort((a, b) => b.uploaded - a.uploaded || b.screened - a.screened);
    setReportData(statsArray);

    const fullSourceCols = [...PLATFORM_SOURCES, ...Array.from(extraSources)];
    setAllSourceColumns(fullSourceCols);

    const sourceArray = Object.values(sourceMap).sort((a, b) => b.totalSourced - a.totalSourced);
    setSourceReportData(sourceArray);
  }, [rawData, fromDate, toDate]);

  const totalUploaded = reportData.reduce((acc, curr) => acc + curr.uploaded, 0);
  const totalShortlisted = reportData.reduce((acc, curr) => acc + curr.shortlisted, 0);
  const totalCalls = reportData.reduce((acc, curr) => acc + curr.callsLogged, 0);
  const totalScreened = reportData.reduce((acc, curr) => acc + curr.screened, 0);

  const sourceTotals = {};
  allSourceColumns.forEach(src => {
    sourceTotals[src] = sourceReportData.reduce((acc, curr) => acc + (curr.sources[src] || 0), 0);
  });
  const grandTotalSourced = sourceReportData.reduce((acc, curr) => acc + curr.totalSourced, 0);

  // Filtered active JPCs for UI
  const filteredActiveJPCs = useMemo(() => {
    let list = rawData.activeJPCs;
    if (selectedJpcCode) {
      list = list.filter(j => j.job_code === selectedJpcCode);
    }
    if (jpcSearch.trim()) {
      const term = jpcSearch.toLowerCase().trim();
      list = list.filter(j => 
        (j.job_code || '').toLowerCase().includes(term) ||
        (j.job_title || '').toLowerCase().includes(term) ||
        (j.client_name || '').toLowerCase().includes(term) ||
        (j.business_unit || '').toLowerCase().includes(term) ||
        (j.recruitment_manager || '').toLowerCase().includes(term) ||
        j.candidates.some(c => (c.name || '').toLowerCase().includes(term) || (c.applicant_code || '').toLowerCase().includes(term))
      );
    }
    return list;
  }, [rawData.activeJPCs, selectedJpcCode, jpcSearch]);

  const handleExport = () => {
    const wb = XLSX.utils.book_new();

    // ── Sheet 1: HR Performance ──
    const ws1Rows = [
      ['HR Name', 'Role', 'Resumes Sourced', 'Shortlisted (Tagged)', 'Calls Logged', 'Screened (Verified)']
    ];
    reportData.forEach(row => {
      const role = row.designation || (row.role === 'super_admin' ? 'Super Admin' : 'Recruiter');
      ws1Rows.push([
        row.name,
        role,
        row.uploaded,
        row.shortlisted,
        row.callsLogged,
        row.screened
      ]);
    });
    ws1Rows.push([
      'Total',
      '',
      totalUploaded,
      totalShortlisted,
      totalCalls,
      totalScreened
    ]);
    const ws1 = XLSX.utils.aoa_to_sheet(ws1Rows);
    XLSX.utils.book_append_sheet(wb, ws1, 'HR Performance');

    // ── Sheet 2: Platform Breakdown ──
    const ws2Header = ['HR Name', 'Role', ...allSourceColumns, 'Total Sourced'];
    const ws2Rows = [ws2Header];
    sourceReportData.forEach(row => {
      const role = row.role === 'super_admin' ? 'Super Admin' : 'Recruiter';
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

    // ── Sheet 3: Active JPCs & Pipeline ──
    const ws3Rows = [
      ['Job Code', 'Job Title', 'Client Name / Unit', 'Manager', 'Candidate ID', 'Candidate Name', 'Tagged By', 'Tagged Date', 'Current Stage']
    ];
    rawData.activeJPCs.forEach(j => {
      if (j.candidates.length === 0) {
        ws3Rows.push([
          j.job_code,
          j.job_title,
          j.client_name || j.business_unit || 'Direct Client',
          j.recruitment_manager || 'Not Assigned',
          '—',
          'No candidates',
          '—',
          '—',
          '—'
        ]);
      } else {
        j.candidates.forEach(c => {
          ws3Rows.push([
            j.job_code,
            j.job_title,
            j.client_name || j.business_unit || 'Direct Client',
            j.recruitment_manager || 'Not Assigned',
            c.applicant_code || c.id,
            c.name,
            c.shortlisted_by || 'HR',
            formatDateDisplay(c.created_at),
            c.current_stage || 'Tagged'
          ]);
        });
      }
    });
    const ws3 = XLSX.utils.aoa_to_sheet(ws3Rows);
    XLSX.utils.book_append_sheet(wb, ws3, 'Active JPCs & Pipeline');

    const dateSuffix = fromDate && toDate ? `${fromDate}_to_${toDate}` : new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `HR_Performance_Report_${dateSuffix}.xlsx`);
  };

  const s = {
    page: { padding: "32px 32px 48px 32px", maxWidth: "100%", margin: "0 auto", fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px", flexWrap: "wrap", gap: "12px" },
    title: { fontSize: "24px", fontWeight: 800, color: "#1e293b", margin: 0, display: 'flex', alignItems: 'center', gap: '10px' },
    subtitle: { fontSize: "14px", color: "#64748b", margin: "6px 0 0" },
    card: { background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" },
    table: { width: "100%", borderCollapse: "collapse", fontSize: "14px" },
    th: { padding: "14px 18px", textAlign: "left", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontWeight: 700, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" },
    td: { padding: "14px 18px", borderBottom: "1px solid #f1f5f9", color: "#334155" },
    overviewGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginBottom: '32px' },
    statCard: { background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' },
    iconBox: (color, bg) => ({ width: '50px', height: '50px', borderRadius: '14px', background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }),
    statNum: { fontSize: '26px', fontWeight: 800, color: '#1e293b', lineHeight: 1.2 },
    statLabel: { fontSize: '13px', color: '#64748b', fontWeight: 600 }
  };

  const renderPipelineStepper = (cand) => {
    const stage = (cand.current_stage || "Tagged").toLowerCase();
    const isTagged = true;
    const isManagerSubmit = stage.includes("manager") || stage.includes("client") || stage.includes("feedback") || !!cand.manager_submitted_at;
    const isClientSubmit = stage.includes("client") || stage.includes("feedback") || !!cand.client_submitted_at;
    const isFeedback = stage.includes("feedback") || !!cand.feedback_received_at;

    const steps = [
      { label: "Tagged", active: isTagged, num: "1" },
      { label: "Manager Submit", active: isManagerSubmit, num: "2" },
      { label: "Client Submit", active: isClientSubmit, num: "3" },
      { label: "Feedback", active: isFeedback, num: "4" }
    ];

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginTop: '8px' }}>
        {steps.map((st, idx) => (
          <div key={idx} style={{ textAlign: 'center' }}>
            <div style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              backgroundColor: st.active ? '#10b981' : '#f1f5f9',
              border: st.active ? 'none' : '1px solid #cbd5e1',
              color: st.active ? '#ffffff' : '#94a3b8',
              fontSize: '11px',
              lineHeight: '22px',
              fontWeight: 'bold',
              margin: '0 auto 4px auto'
            }}>
              {st.active ? '✓' : st.num}
            </div>
            <div style={{ fontSize: '11px', fontWeight: st.active ? 700 : 500, color: st.active ? '#065f46' : '#64748b' }}>
              {st.label}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}><FiPieChart style={{ color: '#0B2F5B' }} /> HR Performance Report</h1>
          <p style={s.subtitle}>Analyze HR sourcing, shortlisting, calling, screening, and active JPC pipeline flows.</p>
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
          {/* Executive Overview KPI Cards (4 Cards) */}
          <div style={s.overviewGrid}>
            <div style={s.statCard}>
              <div style={s.iconBox('#3b82f6', '#eff6ff')}><FiUsers size={22} /></div>
              <div>
                <div style={s.statLabel}>Resumes Sourced</div>
                <div style={s.statNum}>{totalUploaded}</div>
              </div>
            </div>
            <div style={s.statCard}>
              <div style={s.iconBox('#059669', '#f0fdf4')}><FiAward size={22} /></div>
              <div>
                <div style={s.statLabel}>Candidates Shortlisted</div>
                <div style={s.statNum}>{totalShortlisted}</div>
              </div>
            </div>
            <div style={s.statCard}>
              <div style={s.iconBox('#7c3aed', '#f5f3ff')}><FiPhoneCall size={22} /></div>
              <div>
                <div style={s.statLabel}>Calls Logged</div>
                <div style={s.statNum}>{totalCalls}</div>
              </div>
            </div>
            <div style={s.statCard}>
              <div style={s.iconBox('#0891b2', '#ecfeff')}><FiCheckCircle size={22} /></div>
              <div>
                <div style={s.statLabel}>CVs Screened</div>
                <div style={s.statNum}>{totalScreened}</div>
              </div>
            </div>
          </div>

          {/* Individual HR Performance Breakdown Table */}
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
                    <th style={{ ...s.th, textAlign: 'center' }}>Screened (Verified)</th>
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
                      <td style={{ ...s.td, textAlign: 'center', fontWeight: 700, color: '#0891b2' }}>{hr.screened}</td>
                    </tr>
                  ))}
                  {reportData.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>No HR data found</td></tr>
                  )}
                </tbody>
                {reportData.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#f1f5f9', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                      <td style={{ ...s.td, fontWeight: 800, color: '#1e293b' }}>Total</td>
                      <td style={{ ...s.td, textAlign: 'center', fontWeight: 800, color: '#1e293b' }}>{totalUploaded}</td>
                      <td style={{ ...s.td, textAlign: 'center', fontWeight: 800, color: '#059669' }}>{totalShortlisted}</td>
                      <td style={{ ...s.td, textAlign: 'center', fontWeight: 800, color: '#7c3aed' }}>{totalCalls}</td>
                      <td style={{ ...s.td, textAlign: 'center', fontWeight: 800, color: '#0891b2' }}>{totalScreened}</td>
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

          {/* [NEW] Active Client JPCs & Candidate Pipeline Flow Section */}
          <div style={{ ...s.card, marginTop: '32px' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0B2F5B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiBriefcase size={18} color="#0B2F5B" /> Active Client JPCs & Candidate Pipeline Flow
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Live candidate stage progression across active job positions ({filteredActiveJPCs.length} Active JPCs).
                </p>
              </div>

              {/* Dynamic Filters: JPC Dropdown + Live Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* JPC Dropdown */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px 12px' }}>
                  <FiBriefcase color="#64748b" size={14} />
                  <select
                    value={selectedJpcCode}
                    onChange={(e) => setSelectedJpcCode(e.target.value)}
                    style={{
                      border: 'none',
                      outline: 'none',
                      fontSize: '13px',
                      color: '#334155',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontWeight: 600,
                      maxWidth: '220px'
                    }}
                  >
                    <option value="">All Active JPCs ({rawData.activeJPCs.length})</option>
                    {rawData.activeJPCs.map(j => (
                      <option key={j.job_code} value={j.job_code}>
                        {j.job_code} - {j.job_title} ({j.candidates.length})
                      </option>
                    ))}
                  </select>
                </div>

                {/* JPC Search Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px 12px', minWidth: '220px' }}>
                  <FiSearch color="#94a3b8" size={15} />
                  <input
                    type="text"
                    placeholder="Search Candidate / HR / Client..."
                    value={jpcSearch}
                    onChange={(e) => setJpcSearch(e.target.value)}
                    style={{ border: 'none', outline: 'none', fontSize: '13px', color: '#334155', width: '100%', background: 'transparent' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ padding: '20px 24px', background: '#f8fafc' }}>
              {filteredActiveJPCs.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                  No Active JPCs matched your filter criteria.
                </div>
              ) : (
                <div
                  style={{
                    columns: '3 340px',
                    columnGap: '20px',
                  }}
                >
                  {filteredActiveJPCs.map((jpc) => (
                    <div
                      key={jpc.job_code}
                      style={{
                        breakInside: 'avoid',
                        marginBottom: '20px',
                        background: '#ffffff',
                        borderRadius: '14px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                        overflow: 'hidden',
                        display: 'inline-block',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    >
                      {/* JPC Header Card */}
                      <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ background: '#0B2F5B', color: '#ffffff', fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px' }}>
                              {jpc.job_code}
                            </span>
                            <span style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '12px' }}>
                              ACTIVE
                            </span>
                          </div>
                          <span style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '12px' }}>
                            {jpc.candidates.length} Candidate{jpc.candidates.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        <h4 style={{ margin: '4px 0 2px 0', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                          {jpc.job_title}
                        </h4>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                          Client: <strong style={{ color: '#334155' }}>{jpc.client_name || jpc.business_unit || 'Direct Client'}</strong> &bull; Manager: <strong style={{ color: '#334155' }}>{jpc.recruitment_manager || 'Not Assigned'}</strong>
                        </div>
                      </div>

                      {/* Candidates Pipeline Flow List */}
                      <div style={{ padding: '14px 18px', background: '#fafbfc' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.4px' }}>
                          Pipeline Submissions ({jpc.candidates.length})
                        </div>

                        {jpc.candidates.length === 0 ? (
                          <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#94a3b8', background: '#ffffff', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                            No candidates submitted in pipeline yet.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {jpc.candidates.map((cand) => (
                              <div
                                key={cand.id || cand.applicant_code}
                                style={{
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '10px',
                                  padding: '12px 14px',
                                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                  <div>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{cand.name || 'Candidate'}</span>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '6px', marginLeft: '6px' }}>
                                      #{cand.applicant_code || cand.id}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                                    Tagged by <strong style={{ color: '#334155' }}>{cand.shortlisted_by || 'HR'}</strong>
                                  </span>
                                </div>
                                {renderPipelineStepper(cand)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
