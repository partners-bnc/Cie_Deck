import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jobService } from '../../services/jobService.js';
import { AdminTableSkeleton } from '../../Component/AdminSkeletons.jsx';
import {
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiChevronUp,
  FiClock,
  FiDatabase,
  FiEye,
  FiFilter,
  FiRefreshCw,
  FiSearch,
  FiUser,
  FiX,
  FiDownload,
  FiCheckCircle,
  FiStar,
  FiCode,
  FiMessageSquare,
  FiAward,
  FiSliders
} from 'react-icons/fi';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 100;

const SOURCE_OPTIONS = [
  'BNC Indeed',
  'BNC Linkedin',
  'BNC IIM',
  'BNC Job Hai',
  'BNC Others',
  'Linkedin',
  'Indeed',
  'IIM',
  'Others',
  'Ciedeck',
  'Job Application',
  'HR Upload',
  'LinkedIn',
  'Naukri',
  'Referral',
  'Walk-in'
];
const STATUS_OPTIONS = ['Applied', 'In Database', 'Tagged', 'Rejected', 'Hired'];

const SOURCE_COLORS = {
  'BNC Indeed': { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' },
  'BNC Linkedin': { bg: '#e0e7ff', color: '#3730a3', border: '#c7d2fe' },
  'BNC IIM': { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  'BNC Job Hai': { bg: '#fce7f3', color: '#9d174d', border: '#fbcfe8' },
  'BNC Others': { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
  Linkedin: { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
  Indeed: { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' },
  IIM: { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  Others: { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
  Ciedeck: { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' },
  'Job Application': { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
  'HR Upload': { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  LinkedIn: { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
  Naukri: { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  Referral: { bg: '#fdf4ff', color: '#701a75', border: '#f0abfc' },
  'Walk-in': { bg: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
  default: { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
};

const STATUS_COLORS = {
  Applied: { bg: '#eff6ff', color: '#1e40af' },
  'In Database': { bg: '#f0fdf4', color: '#166534' },
  Tagged: { bg: '#f0fdf4', color: '#166534' },
  Rejected: { bg: '#fef2f2', color: '#dc2626' },
  Hired: { bg: '#fdf4ff', color: '#7e22ce' },
  default: { bg: '#f8fafc', color: '#475569' },
};

function cvAge(dateStr) {
  if (!dateStr) return '-';
  const now = new Date();
  const then = new Date(dateStr);
  if (Number.isNaN(then.getTime())) return '-';

  now.setHours(0, 0, 0, 0);
  then.setHours(0, 0, 0, 0);
  const diffDays = Math.round((now - then) / 864e5);

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return '1 month ago';
  return `${Math.floor(diffDays / 30)} months ago`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function SourceBadge({ source }) {
  const colors = SOURCE_COLORS[source] || SOURCE_COLORS.default;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '10px',
      fontSize: '11px',
      fontWeight: 700,
      border: `1px solid ${colors.border}`,
      background: colors.bg,
      color: colors.color,
      whiteSpace: 'nowrap'
    }}>{source || '-'}</span>
  );
}

function StatusBadge({ status }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.default;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '10px',
      fontSize: '11px',
      fontWeight: 700,
      background: colors.bg,
      color: colors.color,
      whiteSpace: 'nowrap'
    }}>{status || 'Applied'}</span>
  );
}

function RatingFilterPicker({ label, value, onChange, icon }) {
  const options = [
    { val: '', label: 'Any' },
    { val: '1', label: '1★+' },
    { val: '2', label: '2★+' },
    { val: '3', label: '3★+' },
    { val: '4', label: '4★+' },
    { val: '5', label: '5★' },
  ];

  return (
    <div style={{
      background: value ? '#fffdf7' : '#f8fafc',
      padding: '12px 14px',
      borderRadius: '12px',
      border: value ? '1.5px solid #fde68a' : '1px solid #e2e8f0',
      boxShadow: value ? '0 2px 8px rgba(245, 158, 11, 0.08)' : 'none',
      transition: 'all 0.2s ease'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {icon} {label}
        </span>
        {value ? (
          <span style={{
            fontSize: '10px',
            fontWeight: 800,
            color: '#b45309',
            background: '#fef3c7',
            padding: '2px 7px',
            borderRadius: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            border: '1px solid #fde68a'
          }}>
            &ge; {value} <FiStar size={9} style={{ fill: '#b45309' }} />
          </span>
        ) : (
          <span style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8' }}>
            All
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        {options.map((opt) => {
          const isSelected = String(value) === String(opt.val);
          return (
            <button
              key={opt.val}
              type="button"
              onClick={() => onChange(isSelected && opt.val !== '' ? '' : opt.val)}
              style={{
                flex: 1,
                padding: '6px 2px',
                borderRadius: '7px',
                fontSize: '11px',
                fontWeight: isSelected ? 800 : 600,
                border: isSelected ? '1px solid #f59e0b' : '1px solid #cbd5e1',
                background: isSelected ? 'linear-gradient(135deg, #fef3c7, #fde68a)' : '#ffffff',
                color: isSelected ? '#78350f' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'center',
                boxShadow: isSelected ? '0 1px 4px rgba(245, 158, 11, 0.2)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.borderColor = '#94a3b8';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminApplicants() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [admins, setAdmins] = useState([]);

  useEffect(() => {
    jobService.fetchAllAdmins().then(res => {
      if (res && Array.isArray(res)) {
        setAdmins(res);
      }
    });
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(() => {
    const saved = sessionStorage.getItem('ciedeck_filter_page');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [showFilters, setShowFilters] = useState(false);
  const [totalCount, setTotalCount] = useState(null);
  const [totalLoading, setTotalLoading] = useState(false);
  const requestSeq = useRef(0);
  const previousTextFilterKey = useRef(null);
  const hasMountedFetch = useRef(false);

  const [search, setSearch] = useState(() => sessionStorage.getItem('ciedeck_filter_search') || '');
  const [searchHr, setSearchHr] = useState(() => sessionStorage.getItem('ciedeck_filter_searchHr') || '');
  const [searchDate, setSearchDate] = useState(() => sessionStorage.getItem('ciedeck_filter_searchDate') || '');
  const [filterSource, setFilterSource] = useState(() => sessionStorage.getItem('ciedeck_filter_filterSource') || '');
  const [filterStatus, setFilterStatus] = useState(() => sessionStorage.getItem('ciedeck_filter_filterStatus') || '');
  const [filterAI, setFilterAI] = useState(() => sessionStorage.getItem('ciedeck_filter_filterAI') || '');
  const [filterExp, setFilterExp] = useState(() => sessionStorage.getItem('ciedeck_filter_filterExp') || '');
  const [filterDateFrom, setFilterDateFrom] = useState(() => sessionStorage.getItem('ciedeck_filter_filterDateFrom') || '');
  const [filterDateTo, setFilterDateTo] = useState(() => sessionStorage.getItem('ciedeck_filter_filterDateTo') || '');
  const [filterJobTitle, setFilterJobTitle] = useState(() => sessionStorage.getItem('ciedeck_filter_filterJobTitle') || '');
  const [filterSkills, setFilterSkills] = useState(() => sessionStorage.getItem('ciedeck_filter_filterSkills') || '');
  const [filterScreening, setFilterScreening] = useState(() => sessionStorage.getItem('ciedeck_filter_filterScreening') || '');
  const [filterTechnicalRating, setFilterTechnicalRating] = useState(() => sessionStorage.getItem('ciedeck_filter_filterTechnicalRating') || '');
  const [filterCommunicationRating, setFilterCommunicationRating] = useState(() => sessionStorage.getItem('ciedeck_filter_filterCommunicationRating') || '');
  const [filterProfessionalismRating, setFilterProfessionalismRating] = useState(() => sessionStorage.getItem('ciedeck_filter_filterProfessionalismRating') || '');
  const [filterOverallRating, setFilterOverallRating] = useState(() => sessionStorage.getItem('ciedeck_filter_filterOverallRating') || '');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [exporting, setExporting] = useState(false);
  const [sortConfig, setSortConfig] = useState(() => {
    try {
      const saved = sessionStorage.getItem('ciedeck_filter_sortConfig');
      return saved ? JSON.parse(saved) : { key: 'createdOn', direction: 'desc' };
    } catch {
      return { key: 'createdOn', direction: 'desc' };
    }
  });

  useEffect(() => {
    sessionStorage.setItem('ciedeck_filter_page', page.toString());
    sessionStorage.setItem('ciedeck_filter_search', search);
    sessionStorage.setItem('ciedeck_filter_searchHr', searchHr);
    sessionStorage.setItem('ciedeck_filter_searchDate', searchDate);
    sessionStorage.setItem('ciedeck_filter_filterSource', filterSource);
    sessionStorage.setItem('ciedeck_filter_filterStatus', filterStatus);
    sessionStorage.setItem('ciedeck_filter_filterAI', filterAI);
    sessionStorage.setItem('ciedeck_filter_filterExp', filterExp);
    sessionStorage.setItem('ciedeck_filter_filterDateFrom', filterDateFrom);
    sessionStorage.setItem('ciedeck_filter_filterDateTo', filterDateTo);
    sessionStorage.setItem('ciedeck_filter_filterJobTitle', filterJobTitle);
    sessionStorage.setItem('ciedeck_filter_filterSkills', filterSkills);
    sessionStorage.setItem('ciedeck_filter_filterScreening', filterScreening);
    sessionStorage.setItem('ciedeck_filter_filterTechnicalRating', filterTechnicalRating);
    sessionStorage.setItem('ciedeck_filter_filterCommunicationRating', filterCommunicationRating);
    sessionStorage.setItem('ciedeck_filter_filterProfessionalismRating', filterProfessionalismRating);
    sessionStorage.setItem('ciedeck_filter_filterOverallRating', filterOverallRating);
    sessionStorage.setItem('ciedeck_filter_sortConfig', JSON.stringify(sortConfig));
  }, [
    page, search, searchHr, searchDate, filterSource, filterStatus, filterAI,
    filterExp, filterDateFrom, filterDateTo, filterJobTitle, filterSkills,
    filterScreening, filterTechnicalRating, filterCommunicationRating,
    filterProfessionalismRating, filterOverallRating, sortConfig
  ]);

  const hasActiveFilters = Boolean(
    search || searchHr || searchDate || filterSource || filterStatus || filterAI ||
    filterExp || filterDateFrom || filterDateTo || filterJobTitle || filterSkills ||
    filterScreening || filterTechnicalRating || filterCommunicationRating ||
    filterProfessionalismRating || filterOverallRating
  );

  const buildFetchOptions = useCallback((nextPage = page) => ({
    page: nextPage,
    pageSize: PAGE_SIZE,
    search,
    searchHr,
    searchDate,
    filterSource,
    filterStatus,
    filterAI,
    filterExp,
    filterDateFrom,
    filterDateTo,
    filterJobTitle,
    filterSkills,
    filterScreening,
    filterTechnicalRating,
    filterCommunicationRating,
    filterProfessionalismRating,
    filterOverallRating,
    sortKey: sortConfig.key,
    sortDirection: sortConfig.direction
  }), [
    page,
    search,
    searchHr,
    searchDate,
    filterSource,
    filterStatus,
    filterAI,
    filterExp,
    filterDateFrom,
    filterDateTo,
    filterJobTitle,
    filterSkills,
    filterScreening,
    filterTechnicalRating,
    filterCommunicationRating,
    filterProfessionalismRating,
    filterOverallRating,
    sortConfig
  ]);

  const fetchData = useCallback(async (nextPage = page) => {
    const requestId = requestSeq.current + 1;
    requestSeq.current = requestId;
    setLoading(true);
    setTotalLoading(true);
    setTotalCount(null);
    setError('');
    const options = buildFetchOptions(nextPage);

    try {
      const result = await jobService.fetchApplicantsPage(options);

      if (requestSeq.current !== requestId) return;

      setCandidates(result.data || []);
      setLoading(false);

      jobService.fetchApplicantsCount(options).then((countResult) => {
        if (requestSeq.current !== requestId) return;
        setTotalCount(countResult.total || 0);
        setTotalLoading(false);
      }).catch(() => {
        if (requestSeq.current !== requestId) return;
        setTotalLoading(false);
      });
    } catch {
      if (requestSeq.current !== requestId) return;
      setError('Failed to load applicants. Please refresh.');
      setTotalLoading(false);
      setLoading(false);
    }
  }, [buildFetchOptions, page]);

  useEffect(() => {
    const textFilterKey = [search, searchHr, filterJobTitle, filterSkills].join('\u001f');
    const shouldDebounce = hasMountedFetch.current && previousTextFilterKey.current !== textFilterKey;
    previousTextFilterKey.current = textFilterKey;
    hasMountedFetch.current = true;

    const timer = window.setTimeout(() => {
      fetchData(page);
    }, shouldDebounce ? 250 : 0);

    return () => window.clearTimeout(timer);
  }, [
    fetchData,
    page,
    search,
    searchHr,
    searchDate,
    filterSource,
    filterStatus,
    filterAI,
    filterExp,
    filterDateFrom,
    filterDateTo,
    filterJobTitle,
    filterSkills,
    filterScreening,
    filterTechnicalRating,
    filterCommunicationRating,
    filterProfessionalismRating,
    filterOverallRating,
    sortConfig
  ]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setSearchHr('');
    setSearchDate('');
    setFilterSource('');
    setFilterStatus('');
    setFilterAI('');
    setFilterExp('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterJobTitle('');
    setFilterSkills('');
    setFilterScreening('');
    setFilterTechnicalRating('');
    setFilterCommunicationRating('');
    setFilterProfessionalismRating('');
    setFilterOverallRating('');
    setSortConfig({ key: 'createdOn', direction: 'desc' });
    setSelectedIds(new Set());
    setPage(1);
  };

  const isAllSelected = candidates.length > 0 && candidates.every(c => selectedIds.has(c.applicantId));
  const isSomeSelected = candidates.some(c => selectedIds.has(c.applicantId)) && !isAllSelected;

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (isAllSelected) {
        candidates.forEach(c => next.delete(c.applicantId));
      } else {
        candidates.forEach(c => next.add(c.applicantId));
      }
      return next;
    });
  };

  const toggleSelectRow = (applicantId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(applicantId)) {
        next.delete(applicantId);
      } else {
        next.add(applicantId);
      }
      return next;
    });
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      let dataToExport = [];
      if (selectedIds.size > 0) {
        const localMatches = candidates.filter(c => selectedIds.has(c.applicantId));
        if (localMatches.length === selectedIds.size) {
          dataToExport = localMatches;
        } else {
          dataToExport = await jobService.fetchApplicantsByIds(Array.from(selectedIds));
        }
      } else {
        dataToExport = await jobService.fetchAllFilteredApplicants(buildFetchOptions(page));
        if (!dataToExport || dataToExport.length === 0) {
          dataToExport = candidates;
        }
      }

      if (!dataToExport || dataToExport.length === 0) {
        alert('No data available to export.');
        setExporting(false);
        return;
      }

      const rows = dataToExport.map(c => {
        const screeningList = Array.isArray(c.screening) ? c.screening : [];
        const screeningInfo = screeningList.length > 0
          ? screeningList.map(s => `${s.hr_name || 'HR'} (${formatDate(s.screened_at)})`).join('; ')
          : 'Not Screened';

        return {
          'Applicant ID': c.applicantId || '',
          'Candidate Name': c.name || '',
          'Email': c.email || '',
          'Mobile Number': c.contactNumber || '',
          'Position / Job': c.currentPosition || c.jobAppliedFor || '',
          'Current Company': c.currentCompany || '',
          'Total Experience': c.totalExperience ? `${c.totalExperience} yr` : '',
          'Relevant Experience': c.relevantExperience || '',
          'Skills': c.skills || '',
          'Education': c.education || '',
          'Current Location': c.currentLocation || '',
          'Current CTC': c.currentCTC || '',
          'Expected Pay': c.expectedPay || '',
          'Notice Period': c.noticePeriod || '',
          'Work Authorization': c.workAuthorization || '',
          'Source': c.source || '',
          'Added By': c.uploadedBy || '',
          'Added On': formatDate(c.createdOn) || '',
          'Status': c.status || 'Applied',
          'AI Decision': c.shortlistDecision || '',
          'AI Score': c.aiScore || '',
          'Screened By': screeningInfo,
          'Technical Rating': c.technicalRating !== '' && c.technicalRating !== null && c.technicalRating !== undefined ? c.technicalRating : '',
          'Communication Rating': c.communicationRating !== '' && c.communicationRating !== null && c.communicationRating !== undefined ? c.communicationRating : '',
          'Professionalism Rating': c.professionalismRating !== '' && c.professionalismRating !== null && c.professionalismRating !== undefined ? c.professionalismRating : '',
          'Overall Rating': c.overallRating !== '' && c.overallRating !== null && c.overallRating !== undefined ? c.overallRating : '',
          'Recruiter Comments': c.recruiterComments || '',
          'Resume Link': c.resumeLink || ''
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const colWidths = Object.keys(rows[0] || {}).map(key => ({
        wch: Math.max(key.length, ...rows.map(r => String(r[key] || '').length).slice(0, 100)) + 3
      }));
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Applicants');
      const dateSuffix = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Applicants_Database_${dateSuffix}.xlsx`);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export Excel file. Please try again.');
    }
    setExporting(false);
  };

  const inputStyle = {
    padding: '8px 10px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '12px',
    outline: 'none',
    background: '#fff',
    width: '100%',
    boxSizing: 'border-box'
  };

  const hasTotalCount = typeof totalCount === 'number';
  const totalPages = hasTotalCount ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : page + (candidates.length === PAGE_SIZE ? 1 : 0);
  const canGoNext = hasTotalCount ? page < totalPages : candidates.length === PAGE_SIZE;

  return (
    <div style={{ padding: '28px 30px' }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .row-hover:hover { background: #f8fafc !important; cursor: pointer; }
        .row-hover:hover td { color: #0B2F5B !important; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #0B2F5B, #1a4a8a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
          }}><FiDatabase size={20} /></div>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#1e293b' }}>Applicants Database</h1>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#94a3b8' }}>
              {loading ? 'Loading...' : hasTotalCount ? `${totalCount} total candidates` : totalLoading ? 'Loading total...' : 'Total unavailable'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowFilters((value) => !value)} style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '9px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
            border: `1px solid ${hasActiveFilters ? '#0B2F5B' : '#e2e8f0'}`,
            background: hasActiveFilters ? '#0B2F5B' : '#fff',
            color: hasActiveFilters ? '#fff' : '#475569', cursor: 'pointer'
          }}>
            <FiFilter size={13} /> Filters
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '9px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
              border: `1px solid #dc2626`,
              background: '#fef2f2',
              color: '#dc2626', cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; }}
            >
              <FiX size={13} /> Clean Filters
            </button>
          )}
          <button
            onClick={handleExportExcel}
            disabled={exporting || loading || candidates.length === 0}
            title="Export full details to Excel"
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '9px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
              border: '1px solid #10b981',
              background: selectedIds.size > 0 ? '#10b981' : '#ecfdf5',
              color: selectedIds.size > 0 ? '#fff' : '#065f46',
              cursor: exporting || loading || candidates.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <FiDownload size={13} style={{ animation: exporting ? 'spin 1s linear infinite' : 'none' }} />
            {exporting ? 'Exporting...' : selectedIds.size > 0 ? `Export Selected (${selectedIds.size})` : 'Export to Excel'}
          </button>
          <button onClick={() => fetchData(page)} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '9px 16px', border: '1px solid #e2e8f0', borderRadius: '10px',
            background: '#fff', color: '#475569', cursor: 'pointer', fontSize: '13px', fontWeight: 600
          }}>
            <FiRefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '2 1 300px' }}>
          <FiSearch size={14} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            placeholder="Search by name, email, mobile, skills..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ ...inputStyle, paddingLeft: '40px', paddingRight: search ? '36px' : '14px', fontSize: '13px', padding: '11px 12px 11px 40px' }}
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1); }} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
              <FiX size={14} />
            </button>
          )}
        </div>

        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <FiUser size={14} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <select
            value={searchHr}
            onChange={(e) => {
              setSearchHr(e.target.value);
              setPage(1);
            }}
            style={{ ...inputStyle, paddingLeft: '40px', paddingRight: searchHr ? '36px' : '14px', fontSize: '13px', padding: '11px 12px 11px 40px', cursor: 'pointer', appearance: 'none' }}
          >
            <option value="">Added by HR...</option>
            {admins.map((admin, idx) => (
              <option key={idx} value={admin.hr_name}>{admin.hr_name}</option>
            ))}
          </select>
          {searchHr && (
            <button onClick={() => { setSearchHr(''); setPage(1); }} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
              <FiX size={14} />
            </button>
          )}
        </div>

        <div style={{ flex: '0 1 180px' }}>
          <input
            type="date"
            value={searchDate}
            onChange={(e) => {
              setSearchDate(e.target.value);
              setPage(1);
            }}
            style={{ ...inputStyle, fontSize: '13px', padding: '10px 12px', height: '100%' }}
          />
        </div>
      </div>

      {showFilters && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', marginBottom: '16px', animation: 'fadeIn 0.3s ease', boxShadow: '0 4px 20px rgba(11,47,91,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#0B2F5B15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0B2F5B' }}>
                <FiSliders size={15} />
              </div>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>Advanced Search & Evaluation Filters</span>
                <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '8px' }}>Refine by profile, HR screening status, and ratings</span>
              </div>
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, transition: 'all 0.15s' }}>
                <FiX size={13} /> Reset All Filters
              </button>
            )}
          </div>

          {/* SECTION 1: General & Profile Filters */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FiUser size={12} /> Candidate Profile & Sourcing
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '5px' }}>Source</label>
                <select value={filterSource} onChange={(e) => { setFilterSource(e.target.value); setPage(1); }} style={inputStyle}>
                  <option value="">All Sources</option>
                  {SOURCE_OPTIONS.map((source) => <option key={source} value={source}>{source}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '5px' }}>Status</label>
                <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} style={inputStyle}>
                  <option value="">All Statuses</option>
                  {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '5px' }}>Screening Status</label>
                <select value={filterScreening} onChange={(e) => { setFilterScreening(e.target.value); setPage(1); }} style={{ ...inputStyle, borderColor: filterScreening ? '#10b981' : '#e2e8f0', background: filterScreening ? '#f0fdf4' : '#fff' }}>
                  <option value="">All Candidates</option>
                  <option value="screened">✓ Only Screened (Any HR)</option>
                  <option value="unscreened">✗ Unscreened Candidates</option>
                  {admins.length > 0 && (
                    <optgroup label="Screened by Specific HR">
                      {admins.map((admin, idx) => (
                        <option key={idx} value={`hr:${admin.hr_name}`}>Screened by {admin.hr_name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '5px' }}>AI Decision</label>
                <select value={filterAI} onChange={(e) => { setFilterAI(e.target.value); setPage(1); }} style={inputStyle}>
                  <option value="">All</option>
                  <option value="Shortlisted">Shortlisted</option>
                  <option value="Not Shortlisted">Not Shortlisted</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '5px' }}>Experience</label>
                <select value={filterExp} onChange={(e) => { setFilterExp(e.target.value); setPage(1); }} style={inputStyle}>
                  <option value="">Any Experience</option>
                  <option value="0">Fresher (0 yr)</option>
                  <option value="1">1 Year</option>
                  <option value="2">2 Years</option>
                  <option value="3">3 Years</option>
                  <option value="4">4 Years</option>
                  <option value="5">5 Years</option>
                  <option value="6-10">6-10 Years</option>
                  <option value="10+">10+ Years</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '5px' }}>From Date</label>
                <input type="date" value={filterDateFrom} onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '5px' }}>To Date</label>
                <input type="date" value={filterDateTo} onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '5px' }}>Job Title</label>
                <input placeholder="e.g. Frontend, Java..." value={filterJobTitle} onChange={(e) => { setFilterJobTitle(e.target.value); setPage(1); }} style={inputStyle} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '5px' }}>Key Skills</label>
                <input placeholder="e.g. React, Node, Python, SQL" value={filterSkills} onChange={(e) => { setFilterSkills(e.target.value); setPage(1); }} style={inputStyle} />
              </div>
            </div>
          </div>

          {/* SECTION 2: Candidate Evaluation & Ratings */}
          <div style={{ background: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '14px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#78350f', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiStar size={13} style={{ fill: '#f59e0b', color: '#f59e0b' }} /> Candidate Ratings & Skill Evaluation (1 - 5 ★)
              </div>
              {(filterTechnicalRating || filterCommunicationRating || filterProfessionalismRating || filterOverallRating) && (
                <button
                  onClick={() => {
                    setFilterTechnicalRating('');
                    setFilterCommunicationRating('');
                    setFilterProfessionalismRating('');
                    setFilterOverallRating('');
                    setPage(1);
                  }}
                  style={{ fontSize: '10px', color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}
                >
                  Clear Ratings
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <RatingFilterPicker
                label="Technical Skills"
                value={filterTechnicalRating}
                onChange={(val) => { setFilterTechnicalRating(val); setPage(1); }}
                icon={<FiCode size={13} style={{ color: '#2563eb' }} />}
              />
              <RatingFilterPicker
                label="Communication Skills"
                value={filterCommunicationRating}
                onChange={(val) => { setFilterCommunicationRating(val); setPage(1); }}
                icon={<FiMessageSquare size={13} style={{ color: '#059669' }} />}
              />
              <RatingFilterPicker
                label="Professionalism"
                value={filterProfessionalismRating}
                onChange={(val) => { setFilterProfessionalismRating(val); setPage(1); }}
                icon={<FiAward size={13} style={{ color: '#7c3aed' }} />}
              />
              <RatingFilterPicker
                label="Overall Rating"
                value={filterOverallRating}
                onChange={(val) => { setFilterOverallRating(val); setPage(1); }}
                icon={<FiStar size={13} style={{ color: '#d97706', fill: '#d97706' }} />}
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ padding: '14px 18px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#dc2626', fontSize: '13px', marginBottom: '14px' }}>
          {error}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 16px rgba(11,47,91,0.05)' }}>
        {loading ? (
          <AdminTableSkeleton rows={8} columns={14} />
        ) : candidates.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
            <FiDatabase size={36} style={{ marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
            <div style={{ fontSize: '14px', fontWeight: 600 }}>
              {hasTotalCount && totalCount === 0 ? 'No applicants in database yet.' : 'No results match your filters.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ width: '40px', padding: '11px 8px 11px 16px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={el => { if (el) el.indeterminate = isSomeSelected; }}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#0B2F5B' }}
                    />
                  </th>
                  {[
                    { label: 'ID', key: 'applicantId' },
                    { label: 'Name', key: 'name' },
                    { label: 'Mobile', key: 'contactNumber' },
                    { label: 'Position / Job', key: 'currentPosition' },
                    { label: 'Source', key: 'source' },
                    { label: 'Added By', key: 'uploadedBy' },
                    { label: 'Exp.', key: 'totalExperience' },
                    { label: 'Status', key: 'status' },
                    { label: 'Rating', key: 'overallRating' },
                    { label: 'Screening', key: null },
                    { label: 'CV Age', key: 'createdOn' },
                    { label: 'Added On', key: 'createdOn' },
                    { label: '', key: null }
                  ].map((header, index) => (
                    <th
                      key={header.label || index}
                      onClick={() => header.key && requestSort(header.key)}
                      style={{
                        padding: header.label === 'Mobile' ? '11px 6px 11px 14px' : header.label === 'Position / Job' ? '11px 14px 11px 6px' : '11px 14px',
                        textAlign: 'left',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#64748b',
                        letterSpacing: '0.4px',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        cursor: header.key ? 'pointer' : 'default',
                        userSelect: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {header.label}
                        {header.key && sortConfig.key === header.key && (
                          sortConfig.direction === 'asc' ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />
                        )}
                        {header.key && sortConfig.key !== header.key && (
                          <FiChevronDown size={12} style={{ opacity: 0.3 }} />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate, index) => (
                  <tr
                    key={candidate.applicantId || index}
                    className="row-hover"
                    onClick={() => navigate(`/admin/applicants/${candidate.applicantId}`)}
                    style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s', background: selectedIds.has(candidate.applicantId) ? '#f0f7ff' : '#fff' }}
                  >
                    <td style={{ width: '40px', padding: '12px 8px 12px 16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(candidate.applicantId)}
                        onChange={() => toggleSelectRow(candidate.applicantId)}
                        style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#0B2F5B' }}
                      />
                    </td>
                    <td style={{ padding: '12px 14px', color: '#94a3b8', fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap' }}>{candidate.applicantId}</td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                        <div style={{
                          width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg, #0B2F5B20, #1a4a8a30)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '12px', fontWeight: 800, color: '#0B2F5B'
                        }}>{(candidate.name || 'A').charAt(0).toUpperCase()}</div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '13px' }}>{candidate.name || '-'}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{candidate.email || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 6px 12px 14px', color: '#475569', whiteSpace: 'nowrap', fontSize: '12px' }}>{candidate.contactNumber || '-'}</td>
                    <td style={{ padding: '12px 14px 12px 6px', maxWidth: '180px' }}>
                      <div style={{ fontWeight: 600, color: '#334155', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {candidate.currentPosition || candidate.jobAppliedFor || '-'}
                      </div>
                      {candidate.currentCompany && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{candidate.currentCompany}</div>}
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}><SourceBadge source={candidate.source} /></td>
                    <td style={{ padding: '12px 14px', color: '#475569', whiteSpace: 'nowrap', fontSize: '12px' }}>{candidate.uploadedBy || '-'}</td>
                    <td style={{ padding: '12px 14px', color: '#475569', whiteSpace: 'nowrap', fontSize: '12px' }}>{candidate.totalExperience ? `${candidate.totalExperience} yr` : '-'}</td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}><StatusBadge status={candidate.status} /></td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      {candidate.overallRating || candidate.technicalRating || candidate.communicationRating || candidate.professionalismRating ? (
                        <div
                          title={`Overall: ${candidate.overallRating || '—'} ★\nTechnical: ${candidate.technicalRating || '—'} ★\nCommunication: ${candidate.communicationRating || '—'} ★\nProfessionalism: ${candidate.professionalismRating || '—'} ★`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 800,
                            background: '#fffbeb',
                            color: '#b45309',
                            border: '1px solid #fde68a'
                          }}
                        >
                          <FiStar size={11} style={{ fill: '#f59e0b', color: '#f59e0b' }} />
                          {candidate.overallRating ? `${candidate.overallRating} ★` : `${candidate.technicalRating || candidate.communicationRating || candidate.professionalismRating} ★`}
                        </div>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontSize: '12px' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      {Array.isArray(candidate.screening) && candidate.screening.length > 0 ? (
                        <span
                          title={candidate.screening.map(s => `${s.hr_name || 'HR'} (${formatDate(s.screened_at)})`).join('\n')}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: '#ecfdf5',
                            color: '#065f46',
                            border: '1px solid #a7f3d0'
                          }}
                        >
                          ✓ {candidate.screening.length} {candidate.screening.length === 1 ? 'HR' : 'HRs'}
                        </span>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontSize: '12px' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#64748b', fontSize: '12px' }}>
                        <FiClock size={11} /> {cvAge(candidate.createdOn)}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#94a3b8', fontSize: '12px', whiteSpace: 'nowrap' }}>{formatDate(candidate.createdOn)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <button style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: '7px',
                        background: '#fff', color: '#475569', cursor: 'pointer', fontSize: '11px', fontWeight: 600
                      }}>
                        <FiEye size={11} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && !loading && (
          <div style={{
            padding: '14px 18px', borderTop: '1px solid #f1f5f9',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Showing {(page - 1) * PAGE_SIZE + 1}-{(page - 1) * PAGE_SIZE + candidates.length}{hasTotalCount ? ` of ${totalCount}` : totalLoading ? ' of ...' : ''}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} style={{
                width: '32px', height: '32px', borderRadius: '8px',
                border: '1px solid #e2e8f0', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer',
                color: page === 1 ? '#cbd5e1' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}><FiChevronLeft size={14} /></button>
              {hasTotalCount && Array.from({ length: Math.min(5, totalPages) }, (_, offset) => {
                const start = Math.max(1, Math.min(totalPages - 4, page - 2));
                const pageNumber = start + offset;
                return (
                  <button key={pageNumber} onClick={() => setPage(pageNumber)} style={{
                    width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                    background: page === pageNumber ? '#0B2F5B' : '#f8fafc',
                    color: page === pageNumber ? '#fff' : '#475569',
                    fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>{pageNumber}</button>
                );
              })}
              <button onClick={() => setPage((value) => value + 1)} disabled={!canGoNext} style={{
                width: '32px', height: '32px', borderRadius: '8px',
                border: '1px solid #e2e8f0', background: '#fff', cursor: !canGoNext ? 'not-allowed' : 'pointer',
                color: !canGoNext ? '#cbd5e1' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}><FiChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
