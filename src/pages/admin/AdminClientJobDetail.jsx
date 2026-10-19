import { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { jobService } from '../../services/jobService.js';
import CandidateRecommendations from '../../components/admin/CandidateRecommendations.jsx';
import { matchingEnabled } from '../../services/candidateMatchingService.js';
import { FiArrowLeft, FiMapPin, FiBriefcase, FiUser, FiClock, FiSearch, FiRefreshCw, FiFileText, FiDownload, FiX, FiMail, FiCheck, FiCheckCircle, FiAlertCircle, FiCalendar, FiMessageSquare, FiMaximize2, FiMinimize2, FiLayers, FiActivity, FiColumns, FiTag, FiSend, FiTarget, FiAward } from 'react-icons/fi';

export default function AdminClientJobDetail() {
  const { jobCode } = useParams();
  const navigate = useNavigate();
  const outletCtx = useOutletContext();
  const setSidebarOpen = outletCtx?.setSidebarOpen;

  const [job, setJob] = useState(null);
  const [shortlistedForJob, setShortlistedForJob] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);
  const [emailLogsModalOpen, setEmailLogsModalOpen] = useState(false);
  const [stageModalCandidate, setStageModalCandidate] = useState(null);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [selectedStageOption, setSelectedStageOption] = useState('Interview Round 1');
  const [customRoundNumber, setCustomRoundNumber] = useState(4);
  const [activePipelineView, setActivePipelineView] = useState('4-step');
  const [stageNotes, setStageNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [expandedCandidateIds, setExpandedCandidateIds] = useState(new Set());

  const toggleExpandTimeline = (applicantId) => {
    setExpandedCandidateIds(prev => {
      const next = new Set(prev);
      if (next.has(applicantId)) {
        next.delete(applicantId);
      } else {
        next.add(applicantId);
      }
      return next;
    });
  };

  const handleOpenAiDrawer = () => {
    setAiDrawerOpen(true);
    if (setSidebarOpen) setSidebarOpen(false);
    window.dispatchEvent(new CustomEvent('collapse-admin-sidebar'));
  };

  const handleCloseAiDrawer = () => {
    setAiDrawerOpen(false);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && aiDrawerOpen) {
        setAiDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [aiDrawerOpen]);

  const reloadTagged = async () => {
    const [matches, logs] = await Promise.all([
      jobService.fetchShortlistedCandidatesByJob(jobCode),
      jobService.fetchEmailLogsByJob(jobCode)
    ]);
    setEmailLogs(logs || []);
    const applicants = await jobService.fetchApplicantsByIds(matches.map(item => item.applicantId));
    const applicantMap = new Map(applicants.map(applicant => [applicant.applicantId, applicant]));
    setShortlistedForJob(matches.map(match => ({ ...match, ...(applicantMap.get(match.applicantId) || {}) })));
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [foundJob, logs] = await Promise.all([
          jobService.fetchClientJobByCode(jobCode),
          jobService.fetchEmailLogsByJob(jobCode)
        ]);
        setJob(foundJob || null);
        setEmailLogs(logs || []);

        if (foundJob) {
          const matches = await jobService.fetchShortlistedCandidatesByJob(jobCode);
          const applicants = await jobService.fetchApplicantsByIds(matches.map((item) => item.applicantId));
          const applicantMap = new Map(applicants.map((applicant) => [applicant.applicantId, applicant]));
          const enriched = matches.map((match) => ({
            ...match,
            ...(applicantMap.get(match.applicantId) || {})
          }));

          setShortlistedForJob(enriched);
        } else {
          setShortlistedForJob([]);
        }
      } catch (err) {
        console.error('Failed to load job detail or submissions', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [jobCode]);

  const openStageModal = (cand) => {
    setStageModalCandidate(cand);
    const current = (cand.currentStage || 'Pipeline');
    if (current === 'Pipeline' || current === 'Manager Submit' || current === 'Client Submission') {
      setSelectedStageOption('Interview Round 1');
    } else if (current.includes('Round 1')) {
      setSelectedStageOption('Interview Round 2');
    } else if (current.includes('Round 2')) {
      setSelectedStageOption('Interview Round 3');
    } else if (current.includes('Round 3')) {
      setSelectedStageOption('CUSTOM_ROUND');
      setCustomRoundNumber(4);
    } else if (current.startsWith('Interview Round ')) {
      const num = parseInt(current.replace('Interview Round ', ''), 10);
      if (!isNaN(num) && num >= 4) {
        setSelectedStageOption('CUSTOM_ROUND');
        setCustomRoundNumber(num + 1);
      } else {
        setSelectedStageOption('Client Cleared');
      }
    } else if (current === 'Client Cleared') {
      setSelectedStageOption('Hired');
    } else {
      setSelectedStageOption('Interview Round 1');
    }
    setStageNotes('');
    setRejectionReason(cand.rejectionReason || '');
    setScheduledDate('');
  };

  const handleSaveStage = async () => {
    if (!stageModalCandidate) return;
    setUpdatingStage(true);
    try {
      const finalStage = selectedStageOption === 'CUSTOM_ROUND'
        ? `Interview Round ${customRoundNumber || 4}`
        : selectedStageOption;

      const details = {
        notes: stageNotes,
        rejectionReason: finalStage.includes('Reject') ? rejectionReason : '',
        scheduledAt: scheduledDate,
        existingHistory: stageModalCandidate.interviewHistory || []
      };
      const res = await jobService.updateShortlistStage(
        stageModalCandidate.applicantId,
        jobCode,
        finalStage,
        details
      );
      if (res.error) {
        alert('Failed to update stage: ' + res.error);
      } else {
        setStageModalCandidate(null);
        await reloadTagged();
      }
    } catch (err) {
      alert('Error updating stage: ' + err.toString());
    } finally {
      setUpdatingStage(false);
    }
  };

  const padZero = (n) => String(n).padStart(2, '0');
  const formatFullDateTime = (dateVal) => {
    if (!dateVal) return '—';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '—';
    let h = d.getHours();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${padZero(d.getDate())}/${padZero(d.getMonth() + 1)}/${d.getFullYear()} ${padZero(h)}:${padZero(d.getMinutes())} ${ap}`;
  };

  const formatShortDate = (dateVal) => {
    if (!dateVal) return '—';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '—';
    return `${padZero(d.getDate())}/${padZero(d.getMonth() + 1)}`;
  };

  const calcElapsed = (ms) => {
    if (isNaN(ms) || ms < 0) ms = 0;
    const m = Math.round(ms / 60000);
    const dd = Math.floor(m / 1440);
    const hh = Math.floor((m % 1440) / 60);
    const mm = m % 60;
    return dd ? `${dd}d ${hh}h` : hh ? `${hh}h ${mm}m` : `${mm}m`;
  };

  const MILESTONE_COLORS = {
    tag: { color: '#2f9e44', bg: '#e8f6ec', ring: '#e8f6ec' },
    mgr: { color: '#3b5bdb', bg: '#eaeffd', ring: '#eaeffd' },
    cli: { color: '#7048e8', bg: '#f1ecfe', ring: '#f1ecfe' },
    int: { color: '#e8590c', bg: '#fff0e6', ring: '#fff0e6' },
    off: { color: '#0c8599', bg: '#e3f6f9', ring: '#e3f6f9' },
    hire: { color: '#2b8a3e', bg: '#e3f5e8', ring: '#e3f5e8' },
    reject: { color: '#dc2626', bg: '#fee2e2', ring: '#fee2e2' },
    hold: { color: '#b45309', bg: '#fef3c7', ring: '#fef3c7' }
  };

  const MILESTONE_ICONS = {
    tag: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z M7.5 7.5h.01',
    mgr: 'M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6 M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M16 11l2 2 4-4',
    send: 'M21 3L10 14 M21 3l-7 18-4-7-7-4 18-7z',
    target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
    msg: 'M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z',
    mail: 'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M3 7l9 6 9-6',
    file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 14l2 2 4-4',
    award: 'M12 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z M8.5 14l-1.5 7 5-3 5 3-1.5-7',
    x: 'M18 6L6 18M6 6l12 12',
    alert: 'M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z'
  };

  const getMilestoneMeta = (title) => {
    const t = (title || '').toLowerCase();
    if (t.includes('tag')) return { type: 'tag', icon: 'tag' };
    if (t.includes('manager')) return { type: 'mgr', icon: 'mgr' };
    if (t.includes('client submit') || t.includes('submission')) return { type: 'cli', icon: 'send' };
    if (t.includes('interview') || t.includes('round')) return { type: 'int', icon: 'target' };
    if (t.includes('feedback')) return { type: 'int', icon: 'msg' };
    if (t.includes('cleared') || t.includes('offer released')) return { type: 'off', icon: 'mail' };
    if (t.includes('offer accept')) return { type: 'off', icon: 'file' };
    if (t.includes('hired')) return { type: 'hire', icon: 'award' };
    if (t.includes('reject')) return { type: 'reject', icon: 'x' };
    if (t.includes('hold')) return { type: 'hold', icon: 'alert' };
    return { type: 'int', icon: 'target' };
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB') + ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getPipelineStatus = (stage) => {
    const s = stage || 'Pipeline';
    if (s === 'Pipeline') {
      return { step: 1, s4State: 'pending', s4Label: 'Client Decision' };
    }
    if (s === 'Manager Submit') {
      return { step: 2, s4State: 'pending', s4Label: 'Client Decision' };
    }
    if (s === 'Client Submission') {
      return { step: 3, s4State: 'pending', s4Label: 'Client Decision' };
    }
    if (s.startsWith('Interview')) {
      return { step: 4, s4State: 'interview', s4Label: s.replace('Interview ', '') };
    }
    if (s === 'Client Cleared') {
      return { step: 4, s4State: 'cleared', s4Label: 'Cleared' };
    }
    if (s === 'Hired') {
      return { step: 4, s4State: 'hired', s4Label: 'Hired 🎉' };
    }
    if (s.includes('Reject')) {
      return { step: 4, s4State: 'rejected', s4Label: 'Rejected' };
    }
    if (s === 'On Hold') {
      return { step: 4, s4State: 'hold', s4Label: 'On Hold' };
    }
    return { step: 4, s4State: 'done', s4Label: s };
  };

  const buildFullProgression = (c) => {
    const list = [];
    const baseDate = c.shortlistedOn || c.date || c.createdOn || new Date().toISOString();

    // Step 1: Tagged
    list.push({
      key: 'tagged',
      title: 'Tagged',
      date: baseDate,
      status: 'Completed',
      icon: '✓',
      badgeBg: '#dcfce7',
      badgeText: '#15803d',
      border: '#86efac',
      user: c.shortlistedBy || c.uploadedBy || 'Recruiter'
    });

    // Step 2: Manager Submit
    const hasManagerSubmit = !!c.managerSubmittedAt || (c.currentStage && c.currentStage !== 'Pipeline');
    if (hasManagerSubmit) {
      list.push({
        key: 'manager_submit',
        title: 'Manager Submit',
        date: c.managerSubmittedAt || baseDate,
        status: 'Completed',
        icon: '✓',
        badgeBg: '#e0e7ff',
        badgeText: '#4338ca',
        border: '#a5b4fc',
        user: c.shortlistedBy || 'Recruiter'
      });
    }

    // Step 3: Client Submission
    const hasClientSubmit = !!c.clientSubmittedAt || (c.currentStage && c.currentStage !== 'Pipeline' && c.currentStage !== 'Manager Submit');
    if (hasClientSubmit) {
      list.push({
        key: 'client_submit',
        title: 'Client Submission',
        date: c.clientSubmittedAt || c.managerSubmittedAt || baseDate,
        status: 'Completed',
        icon: '✓',
        badgeBg: '#ede9fe',
        badgeText: '#6d28d9',
        border: '#c4b5fd',
        user: c.shortlistedBy || 'Recruiter'
      });
    }

    // Steps 4+: From interview_history
    const hist = c.interviewHistory || [];
    if (hist.length > 0) {
      hist.forEach((h, hi) => {
        const stageName = h.round || h.stage || '';
        const isReject = stageName.includes('Reject');
        const isHired = stageName === 'Hired';
        const isHold = stageName === 'On Hold';
        const isCleared = stageName.includes('Cleared');
        const isInterview = stageName.startsWith('Interview');

        let icon = '✓';
        let badgeBg = '#dbeafe';
        let badgeText = '#1d4ed8';
        let border = '#93c5fd';

        if (isReject) {
          icon = '✕';
          badgeBg = '#fee2e2';
          badgeText = '#b91c1c';
          border = '#fca5a5';
        } else if (isHired) {
          icon = '🎉';
          badgeBg = '#dcfce7';
          badgeText = '#15803d';
          border = '#86efac';
        } else if (isHold) {
          icon = '❚❚';
          badgeBg = '#fef3c7';
          badgeText = '#b45309';
          border = '#fde68a';
        } else if (isCleared) {
          icon = '✨';
          badgeBg = '#ccfbf1';
          badgeText = '#0f766e';
          border = '#5eead4';
        } else if (isInterview) {
          icon = '🎯';
        }

        const isCurrent = hi === hist.length - 1;

        list.push({
          key: `hist_${hi}`,
          title: stageName || `Stage ${hi + 4}`,
          date: h.updated_at || h.scheduled_at || baseDate,
          scheduledDate: h.scheduled_at,
          notes: h.notes,
          rejectionReason: h.rejection_reason,
          status: isCurrent ? 'Current' : (h.status || 'Completed'),
          isCurrent,
          icon,
          badgeBg,
          badgeText,
          border,
          user: h.updated_by || c.shortlistedBy || 'HR'
        });
      });
    } else if (c.currentStage && c.currentStage !== 'Pipeline' && c.currentStage !== 'Manager Submit' && c.currentStage !== 'Client Submission') {
      const isReject = c.currentStage.includes('Reject');
      const isHired = c.currentStage === 'Hired';
      const isHold = c.currentStage === 'On Hold';
      const isCleared = c.currentStage.includes('Cleared');

      list.push({
        key: 'current_stage',
        title: c.currentStage,
        date: c.feedbackReceivedAt || c.scheduledAt || c.clientSubmittedAt || baseDate,
        scheduledDate: c.scheduledAt,
        notes: c.stageNotes,
        rejectionReason: c.rejectionReason,
        status: 'Current',
        isCurrent: true,
        icon: isReject ? '✕' : (isHired ? '🎉' : (isHold ? '❚❚' : (isCleared ? '✨' : '🎯'))),
        badgeBg: isReject ? '#fee2e2' : (isHired ? '#dcfce7' : (isHold ? '#fef3c7' : '#dbeafe')),
        badgeText: isReject ? '#b91c1c' : (isHired ? '#15803d' : (isHold ? '#b45309' : '#1d4ed8')),
        border: isReject ? '#fca5a5' : (isHired ? '#86efac' : (isHold ? '#fde68a' : '#93c5fd')),
        user: c.shortlistedBy || 'HR'
      });
    }

    return list;
  };

  const renderStageBadge = (c, showDetails = false) => {
    const s = c.currentStage || 'Pipeline';
    if (s === 'Hired') {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800,
          background: '#dcfce7', color: '#15803d', border: '1px solid #86efac'
        }}>
          🎉 Hired / Placed
        </span>
      );
    }
    if (s.startsWith('Interview')) {
      const history = c.interviewHistory || [];
      const latestHistory = history.length > 0 ? history[history.length - 1] : null;
      const sched = c.scheduledAt || latestHistory?.scheduled_at;
      const note = c.stageNotes || latestHistory?.notes;
      return (
        <div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800,
            background: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd'
          }}>
            🎯 {s}
          </span>
          {showDetails && (
            <>
              {sched && (
                <div style={{ fontSize: '11px', color: '#334155', fontWeight: 600, marginTop: '3px' }}>
                  📅 {formatDate(sched)}
                </div>
              )}
              {note && (
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={note}>
                  💬 {note}
                </div>
              )}
              {history.length > 1 && (
                <div style={{ fontSize: '10px', color: '#2563eb', fontWeight: 700, marginTop: '2px' }}>
                  📜 {history.length} rounds logged
                </div>
              )}
            </>
          )}
        </div>
      );
    }
    if (s === 'Client Cleared') {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800,
          background: '#ccfbf1', color: '#0f766e', border: '1px solid #5eead4'
        }}>
          ✨ Client Cleared
        </span>
      );
    }
    if (s.includes('Reject')) {
      return (
        <div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800,
            background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5'
          }}>
            🚫 Rejected (This Job)
          </span>
          {c.rejectionReason && (
            <div style={{ fontSize: '10px', color: '#991b1b', marginTop: '2px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.rejectionReason}>
              Reason: {c.rejectionReason}
            </div>
          )}
        </div>
      );
    }
    if (s === 'On Hold') {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800,
          background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a'
        }}>
          ⏸️ On Hold
        </span>
      );
    }
    if (s === 'Client Submission') {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800,
          background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd'
        }}>
          📤 Client Submission
        </span>
      );
    }
    if (s === 'Manager Submit') {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800,
          background: '#e0e7ff', color: '#4338ca', border: '1px solid #a5b4fc'
        }}>
          📋 Manager Submit
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800,
        background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1'
      }}>
        🏷️ Tagged
      </span>
    );
  };


  const handleExport = () => {
    if (!job) return;

    const escapeXML = (val) => {
      if (val === null || val === undefined) return '';
      return String(val)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const getStyleByStage = (stage) => {
      if (stage === 'Manager Submit') return 'StyleManagerSubmit';
      if (stage === 'Client Submission') return 'StyleClientSubmission';
      if (stage === 'Feedback') return 'StyleFeedback';
      return 'StylePipeline';
    };

    const rawSheetName = `${job.jobCode} ${job.jobTitle || ''}`.trim();
    const sanitizedSheetName = rawSheetName.replace(/[\\/?*:[\]]/g, ' ');
    const finalSheetName = sanitizedSheetName.length > 31 ? sanitizedSheetName.slice(0, 31) : sanitizedSheetName;

    const xmlContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:CharSet="1" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="TableHeader">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#000000"/>
   <Interior ss:Color="#CCE0F5" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A6B9D0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A6B9D0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A6B9D0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A6B9D0"/>
   </Borders>
  </Style>
  <Style ss:ID="TableCell">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#333333"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="StylePipeline">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#475569"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="StyleManagerSubmit">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#C2410C"/>
   <Interior ss:Color="#FFF7ED" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDBA74"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDBA74"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDBA74"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDBA74"/>
   </Borders>
  </Style>
  <Style ss:ID="StyleClientSubmission">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#1E40AF"/>
   <Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
   </Borders>
  </Style>
  <Style ss:ID="StyleFeedback">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#166534"/>
   <Interior ss:Color="#F0FDF4" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXML(finalSheetName)}">
  <Table>
   <Column ss:Width="50"/>
   <Column ss:Width="150"/>
   <Column ss:Width="200"/>
   <Column ss:Width="120"/>
   <Column ss:Width="150"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="200"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Row ss:Height="22">
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">S.No</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Candidate Name</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Email</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Mobile Number</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Location</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Current CTC</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Expected CTC</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Education</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Current Status</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Tagged By</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Tagged On</Data></Cell>
   </Row>
   ${shortlistedForJob.map((c, idx) => {
     const firstColStyle = getStyleByStage(c.currentStage);
     return `
   <Row ss:Height="18">
    <Cell ss:StyleID="${firstColStyle}"><Data ss:Type="String">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXML(c.name || 'N/A')}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXML(c.email || 'N/A')}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXML(c.contactNumber || 'N/A')}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXML(c.currentLocation || 'N/A')}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXML(c.currentCTC || 'N/A')}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXML(c.expectedPay || 'N/A')}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXML(c.education || 'N/A')}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXML(c.currentStage || 'Pipeline')}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXML(c.shortlistedBy || 'N/A')}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXML(c.shortlistedOn ? formatDate(c.shortlistedOn) : (c.date ? formatDate(c.date) : 'N/A'))}</Data></Cell>
   </Row>`;
   }).join('')}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${job.jobCode}_Snapshot_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
        <FiRefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
        <h2>Loading Job Details...</h2>
      </div>
    );
  }

  if (!job) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#e11d48' }}>
        <h2>Job not found!</h2>
        <button onClick={() => navigate('/admin/client-jobs')} style={{ padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}>Go Back</button>
      </div>
    );
  }

  const isBoxActive = job.status?.toLowerCase() === 'active';

  return (
    <div style={{ padding: '24px 32px', background: '#f8fafc', minHeight: '100vh' }}>

      {/* Top Banner Area */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>

        {/* Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => navigate('/admin/client-jobs')} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', display: 'flex' }}>
              <FiArrowLeft size={24} />
            </button>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiBriefcase color="#f59e0b" /> {job.jobCode} - {job.jobTitle}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {matchingEnabled && job._uuid && (
              <button
                type="button"
                onClick={handleOpenAiDrawer}
                className="apple-ai-pill-btn"
                title="AI Candidate Recommendations"
                aria-label="Open AI Candidate Recommendations"
              >
                <div className="apple-ai-pill-inner">
                  <div className="apple-ai-stars-box">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                      <path
                        className="star-orbit-node star-node-1"
                        d="M14 4C14 7.2 16.8 10 20 10C16.8 10 14 12.8 14 16C14 12.8 11.2 10 8 10C11.2 10 14 7.2 14 4Z"
                      />
                      <path
                        className="star-orbit-node star-node-2"
                        d="M6 3C6 4.5 7 5.5 8.5 5.5C7 5.5 6 6.5 6 8C6 6.5 5 5.5 3.5 5.5C5 5.5 6 4.5 6 3Z"
                      />
                      <path
                        className="star-orbit-node star-node-3"
                        d="M6 14C6 15.3 6.9 16.2 8 16.2C6.9 16.2 6 17.1 6 18.4C6 17.1 5.1 16.2 4 16.2C5.1 16.2 6 15.3 6 14Z"
                      />
                    </svg>
                  </div>
                  <span className="apple-ai-text">AI</span>
                </div>
              </button>
            )}
            <button
              onClick={() => navigate('/admin/client-jobs', { state: { editJobCode: job.jobCode } })}
              style={{
                background: '#fff', border: '1px solid #e2e8f0', color: '#0f172a',
                padding: '6px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
              }}
            >
              Edit Job
            </button>
            <div style={{
              background: isBoxActive ? '#22c55e' : '#ef4444',
              color: '#fff', padding: '6px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 800
            }}>
              {job.status?.toUpperCase() || 'ACTIVE'}
            </div>
          </div>
        </div>

        {/* Sub Header (Client & Location) */}
        <div style={{ paddingLeft: '44px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#475569', fontWeight: 500 }}>
            <span style={{ color: '#3b82f6', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}><FiUser /> {job.clientName}</span>
            <span>|</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FiMapPin /> {job.location}{job.state ? `, ${job.state}` : ''}, {job.country}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Assigned To:</span>
            {job.assignedTo ? (
              job.assignedTo.split(',').map((hr, idx) => (
                <span key={idx} style={{
                  display: 'inline-block', background: '#ecfdf5', color: '#059669',
                  border: '1px solid #a7f3d0', padding: '3px 10px', borderRadius: '16px',
                  fontSize: '12px', fontWeight: 700
                }}>
                  {hr.trim()}
                </span>
              ))
            ) : (
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>N/A</span>
            )}
          </div>
          <div style={{ fontSize: '13px', color: '#3b82f6', marginTop: '8px', fontWeight: 600 }}>Tagged Applicants {shortlistedForJob.length}</div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '0 0 24px 0' }} />

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', alignItems: 'center', paddingLeft: '44px' }}>
          {/* Column 1: Client Reporting Contact (Moved Left First) */}
          <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: '16px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>Client Reporting Contact</div>
            {job.reportingClientName ? (
              <div>
                <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 700 }}>{job.reportingClientName}</div>
                {job.reportingClientEmail && (
                  <a href={`mailto:${job.reportingClientEmail}`} style={{ fontSize: '12px', color: '#2563eb', textDecoration: 'none', display: 'block', marginTop: '3px' }}>
                    {job.reportingClientEmail}
                  </a>
                )}
                {job.reportingClientContact && (
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{job.reportingClientContact}</div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>Not assigned</div>
            )}
          </div>

          {/* Column 2: Pay Rate / Salary (Moved from Col 1) */}
          <div style={{ borderRight: '1px solid #e2e8f0', padding: '0 16px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>Pay Rate / Salary</div>
            <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 700 }}>{job.payRate || 'N/A'}</div>
          </div>

          {/* Column 3: Recruitment Manager */}
          <div style={{ borderRight: '1px solid #e2e8f0', padding: '0 16px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>Recruitment Manager</div>
            <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 700 }}>{job.recruitmentManager || '—'}</div>
          </div>

          {/* Column 4: Job Type / Mode */}
          <div style={{ borderRight: '1px solid #e2e8f0', padding: '0 16px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>Job Type / Mode</div>
            <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 700 }}>{job.jobType || '-'}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{job.jobMode || '-'}</div>
          </div>

          {/* Column 5: Created By & On */}
          <div style={{ borderRight: '1px solid #e2e8f0', padding: '0 16px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>Created By & On</div>
            <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 700 }}>{job.createdBy}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>On {formatDate(job.createdOn)}</div>
          </div>

          {/* Column 6: Business Unit */}
          <div style={{ paddingLeft: '16px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>Business Unit</div>
            <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 700 }}>{job.businessUnit || 'Broccoli and Carrots Global Services'}</div>
          </div>
        </div>



        <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '24px 0' }} />

        {/* Job Description Box */}
        <div style={{ paddingLeft: '44px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>Job Description</h3>
          <div style={{
            fontSize: '14px', color: '#475569', lineHeight: '1.7',
            whiteSpace: 'pre-wrap', background: '#f8fafc', padding: '16px', borderRadius: '12px',
            maxHeight: isDescExpanded ? 'none' : '100px',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {job.jobDescription || 'No description provided.'}
            {!isDescExpanded && (job.jobDescription?.length > 200) && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40px', background: 'linear-gradient(transparent, #f8fafc)' }} />
            )}
          </div>
          {(job.jobDescription?.length > 200) && (
            <button
              onClick={() => setIsDescExpanded(!isDescExpanded)}
              style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 700, fontSize: '13px', cursor: 'pointer', marginTop: '8px', padding: 0 }}
            >
              {isDescExpanded ? 'View Less' : 'View More'}
            </button>
          )}
        </div>
      </div>

      {/* ── Submissions Section with Pipeline Stepper ── */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
        {/* ── Submissions Section Top Bar: View Switcher (Left) & Compact Actions (Right) ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          {/* View Switcher Tabs */}
          <div style={{
            display: 'inline-flex',
            background: '#f1f5f9',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            gap: '4px'
          }}>
            {[
              { id: '4-step', label: '4-Step Pipeline', Icon: FiLayers },
              { id: 'full', label: 'Full Pipeline', Icon: FiActivity },
              { id: 'kanban', label: 'Kanban Board', Icon: FiColumns },
              { id: 'timeline', label: 'Timeline Table', Icon: FiClock }
            ].map(view => {
              const isActive = activePipelineView === view.id;
              const IconComp = view.Icon;
              return (
                <button
                  key={view.id}
                  onClick={() => setActivePipelineView(view.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 13px',
                    borderRadius: '7px',
                    border: 'none',
                    background: isActive ? '#fff' : 'transparent',
                    color: isActive ? '#0f172a' : '#64748b',
                    fontSize: '12.5px',
                    fontWeight: isActive ? 800 : 600,
                    cursor: 'pointer',
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <IconComp size={14} color={isActive ? '#2563eb' : '#64748b'} />
                  <span>{view.label}</span>
                </button>
              );
            })}
          </div>

          {/* Compact Action Buttons (Small & Pushed to Right) */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
            <button
              onClick={() => setEmailLogsModalOpen(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px', borderRadius: '7px', border: '1px solid #cbd5e1',
                background: '#fff', color: '#334155', fontSize: '12px', fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap', height: '32px'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              title="View all sent emails and communication logs for this JPC"
            >
              <FiMail size={13} color="#3b82f6" /> Email Logs ({emailLogs.length})
            </button>
            <button
              onClick={handleExport}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px', borderRadius: '7px', border: '1px solid #cbd5e1',
                background: '#fff', color: '#334155', fontSize: '12px', fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap', height: '32px'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <FiDownload size={13} /> Export Snapshot
            </button>
            <button
              onClick={() => navigate(`/admin/client-jobs/${jobCode}/email`)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '6px 14px', borderRadius: '7px', border: 'none',
                background: '#3b82f6', color: '#fff', fontSize: '12px', fontWeight: 700,
                cursor: 'pointer', transition: 'background 0.15s', whiteSpace: 'nowrap', height: '32px'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#2563eb'}
              onMouseLeave={e => e.currentTarget.style.background = '#3b82f6'}
            >
              📧 Email Automation
            </button>
          </div>
        </div>

        {/* Filter Pills and Search */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search candidate..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', boxSizing: 'border-box', fontSize: '13px' }}
            />
          </div>
          {[
            { label: 'All', count: shortlistedForJob.length },
            { label: 'Tagged', count: shortlistedForJob.filter(c => (c.currentStage || 'Pipeline') === 'Pipeline').length },
            { label: 'Manager Submit', count: shortlistedForJob.filter(c => c.currentStage === 'Manager Submit').length },
            { label: 'Client Submission', count: shortlistedForJob.filter(c => c.currentStage === 'Client Submission').length },
            { label: 'Interviews', count: shortlistedForJob.filter(c => c.currentStage?.startsWith('Interview') || c.currentStage === 'Client Cleared').length },
            { label: 'Hired', count: shortlistedForJob.filter(c => c.currentStage === 'Hired').length },
            { label: 'Rejected / Hold', count: shortlistedForJob.filter(c => c.currentStage?.includes('Reject') || c.currentStage === 'On Hold').length },
          ].map((filter) => {
            const isActive = activeFilter === filter.label;
            return (
              <div
                key={filter.label}
                onClick={() => setActiveFilter(filter.label)}
                style={{
                  padding: '6px 13px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                  background: isActive ? '#3b82f6' : '#f1f5f9',
                  color: isActive ? '#fff' : '#64748b', cursor: 'pointer',
                  border: isActive ? 'none' : '1px solid #e2e8f0',
                  transition: 'all 0.2s'
                }}>
                {filter.label} {filter.count}
              </div>
            );
          })}
        </div>

        {/* ── Candidate Submissions Views ── */}
        {(() => {
          const filteredSubmissions = shortlistedForJob.filter(c => {
            const searchMatch = !searchTerm.trim() ||
              c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              c.contactNumber?.includes(searchTerm);

            let tabMatch = true;
            if (activeFilter === 'Tagged') {
              tabMatch = (c.currentStage || 'Pipeline') === 'Pipeline';
            } else if (activeFilter === 'Manager Submit') {
              tabMatch = c.currentStage === 'Manager Submit';
            } else if (activeFilter === 'Client Submission') {
              tabMatch = c.currentStage === 'Client Submission';
            } else if (activeFilter === 'Interviews') {
              tabMatch = c.currentStage?.startsWith('Interview') || c.currentStage === 'Client Cleared';
            } else if (activeFilter === 'Hired') {
              tabMatch = c.currentStage === 'Hired';
            } else if (activeFilter === 'Rejected / Hold') {
              tabMatch = c.currentStage?.includes('Reject') || c.currentStage === 'On Hold';
            }

            return searchMatch && tabMatch;
          });

          if (filteredSubmissions.length === 0) {
            return (
              <div style={{ padding: '50px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', border: '1px dashed #cbd5e1', borderRadius: '12px' }}>
                {searchTerm || activeFilter !== 'All' ? 'No candidates match your search or filter.' : 'No submissions yet. Navigate to the Applicant Database to shortlist candidates for this job.'}
              </div>
            );
          }

          {/* ═══════════ VIEW 1: 4-STEP PIPELINE (DEFAULT) ═══════════ */}
          if (activePipelineView === '4-step') {
            return (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                {/* Table Header */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1.4fr 1.1fr 1.1fr 1.3fr 110px',
                  padding: '12px 32px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', gap: '20px'
                }}>
                  {['NAME', 'TAGGED BY/ON', 'CONTACT/LOCATION', 'STAGE & STATUS', 'ACTION'].map(h => (
                    <div key={h} style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px' }}>{h}</div>
                  ))}
                </div>

                {filteredSubmissions.map((c, idx) => {
                  const pipe = getPipelineStatus(c.currentStage);
                  const STEPS = [
                    { label: 'Tagged', col: 1, date: c.shortlistedOn || c.date || c.createdOn, isDone: pipe.step >= 1 },
                    { label: 'Manager Submit', col: 2, date: c.managerSubmittedAt, isDone: pipe.step >= 2 },
                    { label: 'Client Submission', col: 3, date: c.clientSubmittedAt, isDone: pipe.step >= 3 },
                    {
                      label: pipe.s4Label,
                      col: 4,
                      date: c.feedbackReceivedAt || c.scheduledAt,
                      isDone: pipe.step >= 4,
                      state: pipe.s4State
                    }
                  ];

                  return (
                    <div key={idx} style={{ borderBottom: idx < filteredSubmissions.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                      {/* Data Row */}
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1.4fr 1.1fr 1.1fr 1.3fr 110px',
                        padding: '14px 32px', alignItems: 'center', gap: '20px'
                      }}>
                        {/* Name */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ color: '#3b82f6', marginTop: '3px' }}>
                            <FiFileText size={16} />
                          </div>
                          <div>
                            <a
                              onClick={() => navigate(`/admin/applicants/${c.applicantId}`)}
                              style={{ color: '#2563eb', fontWeight: 700, fontSize: '13px', cursor: 'pointer', textDecoration: 'none' }}
                            >
                              {c.name}
                            </a>
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>#{c.applicantId}</div>
                          </div>
                        </div>

                        {/* Tagged By / On */}
                        <div>
                          <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 600 }}>{c.shortlistedBy || c.uploadedBy || 'Recruiter'}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{formatDate(c.shortlistedOn || c.date || c.createdOn)}</div>
                        </div>

                        {/* Contact / Location */}
                        <div>
                          <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 600 }}>{c.contactNumber || 'N/A'}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{c.currentLocation || 'N/A'}</div>
                        </div>

                        {/* Stage & Status Badge */}
                        <div>
                          {renderStageBadge(c)}
                        </div>

                        {/* Action: Update Stage Button */}
                        <div>
                          <button
                            onClick={() => openStageModal(c)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              padding: '6px 12px', borderRadius: '6px',
                              background: '#f1f5f9', border: '1px solid #cbd5e1',
                              color: '#1e293b', fontSize: '12px', fontWeight: 700,
                              cursor: 'pointer', transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                          >
                            Update ▾
                          </button>
                        </div>
                      </div>

                      {/* 4-Step Stepper Progress Bar */}
                      <div style={{ padding: '0 32px 16px 32px' }}>
                        <div style={{
                          display: 'grid', gridTemplateColumns: '1.4fr 1.1fr 1.1fr 1.3fr 110px',
                          alignItems: 'flex-start', gap: '20px'
                        }}>
                          {STEPS.map((step, si) => {
                            const isDone = step.isDone;
                            const hasNext = si < STEPS.length - 1;
                            const centerOffset = '36px';

                            let activeBg = '#22c55e';
                            let activeBorder = '#22c55e';
                            let stepIcon = '✓';

                            if (si === 3 && isDone) {
                              if (step.state === 'rejected') {
                                activeBg = '#ef4444';
                                activeBorder = '#ef4444';
                                stepIcon = '✕';
                              } else if (step.state === 'interview') {
                                activeBg = '#2563eb';
                                activeBorder = '#2563eb';
                                stepIcon = '🎯';
                              } else if (step.state === 'hold') {
                                activeBg = '#f59e0b';
                                activeBorder = '#f59e0b';
                                stepIcon = '❚❚';
                              }
                            }

                            const nextStep = STEPS[si + 1];
                            let nextLineColor = '#e2e8f0';
                            if (hasNext && nextStep.isDone) {
                              if (si === 2 && nextStep.state === 'rejected') {
                                nextLineColor = '#ef4444';
                              } else if (si === 2 && nextStep.state === 'interview') {
                                nextLineColor = '#2563eb';
                              } else if (si === 2 && nextStep.state === 'hold') {
                                nextLineColor = '#f59e0b';
                              } else {
                                nextLineColor = '#22c55e';
                              }
                            }

                            return (
                              <div key={step.label} style={{ gridColumn: step.col, position: 'relative', height: '60px' }}>
                                {si === 0 && (
                                  <div style={{
                                    position: 'absolute', top: '8px', left: '0px',
                                    width: centerOffset, height: '4px',
                                    background: isDone ? '#22c55e' : '#e2e8f0', zIndex: 0
                                  }} />
                                )}

                                {hasNext && (
                                  <div style={{
                                    position: 'absolute', top: '8px', left: centerOffset,
                                    width: 'calc(100% + 20px)', height: '4px',
                                    background: nextLineColor, zIndex: 0
                                  }} />
                                )}

                                {!hasNext && (
                                  <div style={{
                                    position: 'absolute', top: '8px', left: centerOffset,
                                    width: '40px', height: '4px',
                                    background: '#e2e8f0', zIndex: 0
                                  }} />
                                )}

                                <div style={{
                                  position: 'absolute', left: centerOffset, top: '0',
                                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                                  width: '84px', transform: 'translateX(-50%)'
                                }}>
                                  <div style={{
                                    width: '20px', height: '20px', borderRadius: '50%', zIndex: 1,
                                    background: isDone ? activeBg : '#fff',
                                    border: isDone ? `2px solid ${activeBorder}` : '2px solid #cbd5e1',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: si === 3 && step.state === 'interview' ? '9px' : '11px',
                                    color: isDone ? '#fff' : '#cbd5e1', fontWeight: 800
                                  }}>
                                    {isDone ? stepIcon : (si + 1)}
                                  </div>

                                  <div style={{
                                    fontSize: '10px',
                                    color: isDone ? (si === 3 && step.state === 'rejected' ? '#b91c1c' : '#1e293b') : '#94a3b8',
                                    fontWeight: isDone ? 700 : 500,
                                    marginTop: '8px', textAlign: 'center', lineHeight: '1.2'
                                  }}>
                                    {step.label}
                                  </div>

                                  <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px', textAlign: 'center' }}>
                                    {isDone && step.date ? formatDate(step.date) : ''}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }

          {/* ═══════════ VIEW 2: FULL PIPELINE (HORIZONTAL STEPPER) ═══════════ */}
          if (activePipelineView === 'full') {
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {filteredSubmissions.map((c, idx) => {
                  const progression = buildFullProgression(c);
                  return (
                    <div
                      key={idx}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e3e8ee',
                        borderRadius: '14px',
                        overflow: 'hidden',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                      }}
                    >
                      {/* Candidate Top Header */}
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1.4fr 1.1fr 1.1fr 1.3fr 110px',
                        padding: '16px 24px', alignItems: 'center', gap: '16px', background: '#fbfcfe', borderBottom: '1px solid #eef2f6'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#2563eb' }}><FiFileText size={16} /></span>
                          <div>
                            <a
                              onClick={() => navigate(`/admin/applicants/${c.applicantId}`)}
                              style={{ color: '#2563eb', fontWeight: 800, fontSize: '14px', cursor: 'pointer', textDecoration: 'none' }}
                            >
                              {c.name}
                            </a>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>#{c.applicantId}</div>
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>{c.shortlistedBy || 'Recruiter'}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{formatDate(c.shortlistedOn || c.date || c.createdOn)}</div>
                        </div>

                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>{c.contactNumber || 'N/A'}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{c.currentLocation || 'N/A'}</div>
                        </div>

                        <div>
                          {renderStageBadge(c)}
                        </div>

                        <div>
                          <button
                            onClick={() => openStageModal(c)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              padding: '6px 12px', borderRadius: '6px',
                              background: '#f1f5f9', border: '1px solid #cbd5e1',
                              color: '#1e293b', fontSize: '12px', fontWeight: 700,
                              cursor: 'pointer', transition: 'all 0.15s'
                            }}
                          >
                            Update ▾
                          </button>
                        </div>
                      </div>

                      {/* Horizontal Pipeline Journey Stepper */}
                      <div style={{ padding: '20px 24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                            <span style={{ color: '#2563eb', display: 'flex' }}><FiClock size={16} /></span>
                            Complete Pipeline Journey ( {progression.length} Milestones Recorded )
                          </div>
                          <div style={{ fontSize: '13px', color: '#64748b' }}>
                            Current Status: <strong style={{ color: '#0f172a' }}>{c.currentStage || 'Pipeline'}</strong>
                          </div>
                        </div>

                        {/* Scrollable Track with Connected Line */}
                        <div style={{ overflowX: 'auto', paddingBottom: '16px' }}>
                          <div style={{
                            position: 'relative',
                            minWidth: progression.length > 5 ? `${progression.length * 130}px` : '100%',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            padding: '10px 30px'
                          }}>
                            {/* Connected Continuous Line */}
                            <div style={{
                              position: 'absolute',
                              top: '26px',
                              left: '46px',
                              right: '46px',
                              height: '3px',
                              background: '#22c55e',
                              zIndex: 0
                            }} />

                            {/* Milestones */}
                            {progression.map((item, pi) => {
                              const meta = getMilestoneMeta(item.title);
                              const col = MILESTONE_COLORS[meta.type] || MILESTONE_COLORS.int;
                              const isCurrent = item.isCurrent;

                              return (
                                <div
                                  key={item.key || pi}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    textAlign: 'center',
                                    position: 'relative',
                                    zIndex: 1,
                                    width: '110px'
                                  }}
                                >
                                  {/* Circle with checkmark */}
                                  <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: col.color,
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '13px',
                                    fontWeight: 800,
                                    border: '2px solid #ffffff',
                                    boxShadow: isCurrent ? `0 0 0 6px ${col.ring}` : '0 1px 3px rgba(0,0,0,0.1)',
                                    transition: 'transform 0.2s'
                                  }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                                    </svg>
                                  </div>

                                  {/* Milestone Title */}
                                  <div style={{
                                    marginTop: '10px',
                                    fontSize: '12px',
                                    fontWeight: isCurrent ? 800 : 700,
                                    color: isCurrent ? '#0f172a' : '#334155',
                                    lineHeight: '1.25'
                                  }}>
                                    {item.title}
                                  </div>

                                  {/* Date underneath */}
                                  <div style={{
                                    marginTop: '4px',
                                    fontSize: '11px',
                                    color: '#64748b',
                                    fontWeight: 600
                                  }}>
                                    {formatShortDate(item.date)}
                                  </div>

                                  {/* Note / Scheduled preview pill */}
                                  {item.scheduledDate && (
                                    <div style={{
                                      marginTop: '4px',
                                      fontSize: '9.5px',
                                      fontWeight: 700,
                                      color: '#2563eb',
                                      background: '#eff6ff',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      maxWidth: '100px',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                    }}>
                                      📅 {formatShortDate(item.scheduledDate)}
                                    </div>
                                  )}
                                  {item.notes && (
                                    <div
                                      style={{
                                        marginTop: '4px',
                                        fontSize: '9.5px',
                                        color: '#475569',
                                        background: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        maxWidth: '105px',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                      }}
                                      title={item.notes}
                                    >
                                      "{item.notes}"
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }

          {/* ═══════════ VIEW 3: KANBAN BOARD (5 BOARDS) ═══════════ */}
          if (activePipelineView === 'kanban') {
            const kanbanColumns = [
              {
                id: 'tag',
                label: 'Tag',
                Icon: FiTag,
                color: '#10b981',
                filter: c => (c.currentStage || 'Pipeline') === 'Pipeline'
              },
              {
                id: 'manager',
                label: 'Manager Submission',
                Icon: FiFileText,
                color: '#3b82f6',
                filter: c => c.currentStage === 'Manager Submit'
              },
              {
                id: 'client',
                label: 'Client Submission',
                Icon: FiSend,
                color: '#8b5cf6',
                filter: c => c.currentStage === 'Client Submission'
              },
              {
                id: 'interviews',
                label: 'Interviews',
                Icon: FiTarget,
                color: '#f97316',
                filter: c => c.currentStage?.startsWith('Interview') || c.currentStage === 'Client Cleared'
              },
              {
                id: 'closure',
                label: 'Closure',
                Icon: FiAward,
                color: '#059669',
                filter: c => c.currentStage === 'Hired' || c.currentStage?.includes('Reject') || c.currentStage === 'On Hold'
              }
            ];

            return (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, minmax(220px, 1fr))',
                gap: '16px',
                overflowX: 'auto',
                paddingBottom: '16px',
                alignItems: 'start'
              }}>
                {kanbanColumns.map(col => {
                  const colCandidates = filteredSubmissions.filter(col.filter);
                  const ColIcon = col.Icon;
                  return (
                    <div
                      key={col.id}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: '480px'
                      }}
                    >
                      {/* Column Header */}
                      <div style={{
                        padding: '12px 14px',
                        background: '#ffffff',
                        borderBottom: '1px solid #e2e8f0',
                        borderTop: `3px solid ${col.color}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                          <ColIcon size={14} color={col.color} />
                          <span>{col.label}</span>
                        </div>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: '#f1f5f9',
                          color: '#475569'
                        }}>
                          {colCandidates.length}
                        </span>
                      </div>

                      {/* Cards Container */}
                      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                        {colCandidates.length === 0 ? (
                          <div style={{
                            padding: '30px 10px',
                            textAlign: 'center',
                            color: '#94a3b8',
                            fontSize: '12px',
                            border: '1px dashed #cbd5e1',
                            borderRadius: '8px',
                            marginTop: '8px'
                          }}>
                            No candidates
                          </div>
                        ) : (
                          colCandidates.map(c => {
                            return (
                              <div
                                key={c.applicantId}
                                style={{
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '10px',
                                  padding: '12px',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px'
                                }}
                              >
                                {/* Name & ID */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <div>
                                    <a
                                      onClick={() => navigate(`/admin/applicants/${c.applicantId}`)}
                                      style={{ color: '#2563eb', fontWeight: 800, fontSize: '13px', cursor: 'pointer', textDecoration: 'none' }}
                                    >
                                      {c.name}
                                    </a>
                                    <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>#{c.applicantId}</div>
                                  </div>
                                </div>

                                {/* Status badge */}
                                <div>
                                  {renderStageBadge(c)}
                                </div>

                                {/* Contact & Tagged details */}
                                <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                                  <div>📞 {c.contactNumber || 'No phone'}</div>
                                  <div>📍 {c.currentLocation || 'N/A'}</div>
                                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                                    Tagged: {formatShortDate(c.shortlistedOn || c.date || c.createdOn)} by {c.shortlistedBy || 'Recruiter'}
                                  </div>
                                </div>

                                {/* Schedule pill if exists */}
                                {c.scheduledAt && (
                                  <div style={{ fontSize: '10.5px', color: '#2563eb', background: '#eff6ff', padding: '3px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                    📅 Scheduled: {formatDate(c.scheduledAt)}
                                  </div>
                                )}

                                {/* Latest note if exists */}
                                {c.stageNotes && (
                                  <div style={{
                                    fontSize: '11px',
                                    color: '#475569',
                                    background: '#f8fafc',
                                    padding: '5px 8px',
                                    borderRadius: '4px',
                                    borderLeft: '2px solid #3b82f6',
                                    fontStyle: 'italic',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }} title={c.stageNotes}>
                                    "{c.stageNotes}"
                                  </div>
                                )}

                                {/* Action: Update stage button */}
                                <button
                                  onClick={() => openStageModal(c)}
                                  style={{
                                    width: '100%',
                                    marginTop: '4px',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    background: '#f8fafc',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    color: '#1e293b',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    textAlign: 'center'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; }}
                                >
                                  Update Stage ▾
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }

          {/* ═══════════ VIEW 4: TIMELINE TABLE (DELAY TRACKING TABLE) ═══════════ */}
          if (activePipelineView === 'timeline') {
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {filteredSubmissions.map((c, idx) => {
                  const progression = buildFullProgression(c);
                  const lastIndex = progression.length - 1;

                  const firstDate = new Date(progression[0].date);
                  const lastDate = new Date(progression[lastIndex].date);
                  const journeyMs = lastDate - firstDate;
                  const journey = calcElapsed(journeyMs);

                  const rows = progression.map((r, i) => {
                    const d = new Date(r.date);
                    const isLast = i === lastIndex;
                    const prevDate = i > 0 ? new Date(progression[i - 1].date) : null;
                    const gap = i === 0 ? 'Start' : '+' + calcElapsed(d - prevDate);
                    const meta = getMilestoneMeta(r.title);
                    const col = MILESTONE_COLORS[meta.type] || MILESTONE_COLORS.int;
                    const iconPath = MILESTONE_ICONS[meta.icon] || MILESTONE_ICONS.target;

                    return {
                      title: r.title,
                      time: formatFullDateTime(r.date),
                      by: r.user || c.shortlistedBy || 'Recruiter',
                      note: r.notes || r.rejectionReason || '—',
                      noteColor: (r.notes || r.rejectionReason) ? '#34405a' : '#b3bac6',
                      sched: r.scheduledDate ? formatFullDateTime(r.scheduledDate) : '',
                      hasSched: !!r.scheduledDate,
                      gap,
                      gapColor: i === 0 ? '#5b6678' : '#34405a',
                      gapBg: i === 0 ? '#eef1f5' : '#f3f5f8',
                      color: col.color,
                      bg: col.bg,
                      iconPath,
                      ringBg: isLast ? '#f0faf3' : '#ffffff',
                      rowBg: isLast ? '#f0faf3' : '#ffffff',
                      lineTop: i === 0 ? '50%' : '0',
                      lineBottom: isLast ? '50%' : '0'
                    };
                  });

                  return (
                    <div
                      key={idx}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e3e8ee',
                        borderRadius: '12px',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Candidate Profile Bar */}
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 1.2fr 1.1fr 0.9fr',
                        gap: '16px', padding: '18px 24px 14px', alignItems: 'start', background: '#f8fafc', borderBottom: '1px solid #e3e8ee'
                      }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb', fontSize: '15px', fontWeight: 800 }}>
                            <FiFileText size={16} />
                            <a
                              onClick={() => navigate(`/admin/applicants/${c.applicantId}`)}
                              style={{ color: '#2563eb', cursor: 'pointer', textDecoration: 'none' }}
                            >
                              {c.name}
                            </a>
                          </div>
                          <div style={{ margin: '4px 0 0 24px', fontSize: '12px', color: '#7b8697' }}>#{c.applicantId}</div>
                        </div>

                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1b2430' }}>{c.shortlistedBy || 'Recruiter'}</div>
                          <div style={{ marginTop: '2px', fontSize: '12px', color: '#7b8697' }}>{formatDate(c.shortlistedOn || c.date || c.createdOn)}</div>
                        </div>

                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1b2430' }}>{c.contactNumber || 'N/A'}</div>
                          <div style={{ marginTop: '2px', fontSize: '12px', color: '#7b8697' }}>{c.currentLocation || 'N/A'}</div>
                        </div>

                        <div>
                          {renderStageBadge(c)}
                        </div>

                        <div>
                          <button
                            onClick={() => openStageModal(c)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '6px',
                              border: '1px solid #d5dbe4', background: '#f4f6f9', borderRadius: '8px',
                              padding: '7px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', color: '#1b2430'
                            }}
                          >
                            Update ▾
                          </button>
                        </div>
                      </div>

                      {/* Timeline Card */}
                      <div style={{ margin: '16px 20px 20px', border: '1px solid #e3e8ee', borderRadius: '12px', background: '#ffffff', overflow: 'hidden' }}>
                        {/* Timeline Header */}
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          flexWrap: 'wrap', gap: '10px', padding: '14px 20px', borderBottom: '1px solid #e6eaf0', background: '#fbfcfe'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800, color: '#1b2430' }}>
                            <span style={{ color: '#2563eb', display: 'flex' }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="9" />
                                <path d="M12 7v5l3 2" />
                              </svg>
                            </span>
                            Complete Pipeline Journey ({progression.length} Milestones Recorded)
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#5b6678' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#1f6a2e', background: '#e3f5e8', borderRadius: '999px', padding: '4px 10px' }}>
                              Total journey {journey}
                            </span>
                            <span>Current Status: <span style={{ fontWeight: 800, color: '#1b2430' }}>{c.currentStage || 'Pipeline'}</span></span>
                          </div>
                        </div>

                        {/* Grid Columns Header */}
                        <div style={{
                          display: 'grid', gridTemplateColumns: '44px 1.5fr 1.3fr 0.9fr 1.1fr 1.7fr',
                          alignItems: 'center', gap: '12px', padding: '10px 20px', fontSize: '11px', fontWeight: 700,
                          letterSpacing: '0.06em', color: '#7b8697', borderBottom: '1px solid #eef1f5', background: '#fcfdfe'
                        }}>
                          <span></span><span>MILESTONE</span><span>DATE &amp; TIME</span><span>ELAPSED</span><span>UPDATED BY</span><span>NOTES</span>
                        </div>

                        {/* Grid Rows */}
                        {rows.map((m, ri) => (
                          <div
                            key={ri}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '44px 1.5fr 1.3fr 0.9fr 1.1fr 1.7fr',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '0 20px',
                              minHeight: '56px',
                              borderBottom: ri < rows.length - 1 ? '1px solid #f0f2f6' : 'none',
                              background: m.rowBg
                            }}
                          >
                            {/* Vertical Connector Line + Check Circle */}
                            <div style={{ position: 'relative', alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{
                                position: 'absolute',
                                left: '50%',
                                marginLeft: '-1px',
                                width: '2px',
                                top: m.lineTop,
                                bottom: m.lineBottom,
                                background: '#b9e2c3'
                              }} />
                              <div style={{
                                position: 'relative',
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: m.color,
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: `0 0 0 4px ${m.ringBg}`
                              }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                                </svg>
                              </div>
                            </div>

                            {/* Milestone Icon + Title */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                              <span style={{
                                width: '26px',
                                height: '26px',
                                flex: 'none',
                                borderRadius: '7px',
                                background: m.bg,
                                color: m.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d={m.iconPath} />
                                </svg>
                              </span>
                              <span style={{ fontSize: '13px', fontWeight: 800, color: '#1b2430' }}>{m.title}</span>
                            </div>

                            {/* Date & Time */}
                            <div style={{ fontSize: '12.5px', color: '#34405a', fontVariantNumeric: 'tabular-nums' }}>
                              {m.time}
                            </div>

                            {/* Elapsed Badge */}
                            <div>
                              <span style={{
                                display: 'inline-block',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: m.gapColor,
                                background: m.gapBg,
                                borderRadius: '6px',
                                padding: '3px 8px',
                                fontVariantNumeric: 'tabular-nums'
                              }}>
                                {m.gap}
                              </span>
                            </div>

                            {/* Updated By */}
                            <div style={{ fontSize: '12.5px', color: '#34405a' }}>
                              {m.by}
                            </div>

                            {/* Notes / Scheduled */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '6px 0' }}>
                              {m.hasSched && (
                                <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#2a47c4' }}>
                                  📅 Scheduled: {m.sched}
                                </div>
                              )}
                              <div style={{ fontSize: '11.5px', color: m.noteColor, lineHeight: '1.3' }}>
                                {m.note}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }

          return null;
        })()}

        {/* Bottom entries summary */}
        <div style={{ padding: '14px 16px', fontSize: '12px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Showing {shortlistedForJob.length} submission{shortlistedForJob.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* ── Email Activity Logs Modal ── */}
      {emailLogsModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}
          onClick={() => setEmailLogsModalOpen(false)}
        >
          <div
            style={{
              background: '#fff', borderRadius: '16px', maxWidth: '780px', width: '100%',
              maxHeight: '90vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Communication & Email Logs</h3>
                  <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '10px', background: '#e0e7ff', color: '#4338ca' }}>
                    {jobCode}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Permanent log of emails sent to managers and clients for this JPC, including custom remarks and candidate snapshots.
                </p>
              </div>
              <button
                onClick={() => setEmailLogsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
              >
                <FiX size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {emailLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
                  <FiMail size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#475569' }}>No Emails Logged Yet</div>
                  <p style={{ fontSize: '13px', maxWidth: '420px', margin: '8px auto 0', lineHeight: 1.5 }}>
                    Whenever you send submissions from the <strong>Email Automation</strong> screen, the email subject, recipient, recruiter remarks, and candidates list will be permanently logged here.
                  </p>
                </div>
              ) : (
                emailLogs.map((log, li) => (
                  <div
                    key={log.id || li}
                    style={{
                      border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px',
                      background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '8px',
                          background: log.submissionType === 'Client Submission' ? '#ede9fe' : '#e0e7ff',
                          color: log.submissionType === 'Client Submission' ? '#6d28d9' : '#4338ca'
                        }}>
                          {log.submissionType || 'Email Log'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                          {formatDate(log.sentAt || log.createdAt)}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                        background: '#dcfce7', color: '#166534', display: 'inline-flex', alignItems: 'center', gap: '4px'
                      }}>
                        <FiCheck size={12} /> {log.status || 'Sent'}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                      {log.subject || 'Submission Update'}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: '#475569', marginBottom: '12px' }}>
                      <div><strong style={{ color: '#0f172a' }}>To:</strong> {log.recipientEmail || 'N/A'}</div>
                      <div><strong style={{ color: '#0f172a' }}>Sent By:</strong> {log.sentBy || 'Recruiter'}</div>
                    </div>

                    {/* Remarks Callout if present */}
                    {log.remarks && (
                      <div style={{
                        background: '#fffbeb', borderLeft: '4px solid #f59e0b',
                        borderRadius: '0 8px 8px 0', padding: '10px 14px', marginBottom: '12px'
                      }}>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                          Recruiter Remarks / Note:
                        </div>
                        <div style={{ fontSize: '12px', color: '#78350f', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                          {log.remarks}
                        </div>
                      </div>
                    )}

                    {/* Candidates Included Snapshot */}
                    {log.candidatesSnapshot && log.candidatesSnapshot.length > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                          Candidates in this submission ({log.candidatesSnapshot.length}):
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {log.candidatesSnapshot.map((cand, ci) => (
                            <span
                              key={ci}
                              style={{
                                fontSize: '11px', fontWeight: 600, padding: '3px 8px',
                                borderRadius: '6px', background: '#f1f5f9', color: '#1e293b',
                                border: '1px solid #cbd5e1'
                              }}
                            >
                              {cand.name} {cand.code ? `(#${cand.code})` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc' }}>
              <button
                onClick={() => setEmailLogsModalOpen(false)}
                style={{
                  padding: '8px 20px', borderRadius: '8px', border: '1px solid #cbd5e1',
                  background: '#fff', color: '#334155', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stage Update Modal ── */}
      {stageModalCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}
          onClick={() => !updatingStage && setStageModalCandidate(null)}
        >
          <div
            style={{
              background: '#fff', borderRadius: '16px', maxWidth: '560px', width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  Update Pipeline Stage
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Candidate: <strong style={{ color: '#0f172a' }}>{stageModalCandidate.name}</strong> (#{stageModalCandidate.applicantId})
                </p>
              </div>
              <button
                disabled={updatingStage}
                onClick={() => setStageModalCandidate(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
              >
                <FiX size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Previous Interview Rounds History Timeline */}
              {stageModalCandidate.interviewHistory && stageModalCandidate.interviewHistory.length > 0 && (
                <div style={{
                  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px',
                  padding: '12px 14px', maxHeight: '180px', overflowY: 'auto'
                }}>
                  <div style={{
                    fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase',
                    letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    <FiClock size={13} color="#3b82f6" /> Interview History ({stageModalCandidate.interviewHistory.length} round{stageModalCandidate.interviewHistory.length > 1 ? 's' : ''} logged)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {stageModalCandidate.interviewHistory.map((item, hi) => (
                      <div key={hi} style={{
                        background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px',
                        padding: '8px 10px', fontSize: '12px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                          <span style={{ fontWeight: 800, color: '#1e293b' }}>
                            {item.round || item.stage}
                          </span>
                          <span style={{ fontSize: '10px', color: '#64748b' }}>
                            {formatDate(item.updated_at || item.scheduled_at)}
                          </span>
                        </div>
                        {item.scheduled_at && (
                          <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600, marginBottom: '2px' }}>
                            📅 Scheduled: {formatDate(item.scheduled_at)}
                          </div>
                        )}
                        {item.notes && (
                          <div style={{ fontSize: '11px', color: '#334155', background: '#f1f5f9', padding: '5px 8px', borderRadius: '4px', marginTop: '3px', whiteSpace: 'pre-wrap' }}>
                            "{item.notes}"
                          </div>
                        )}
                        {item.rejection_reason && (
                          <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '3px', fontWeight: 600 }}>
                            Reason: {item.rejection_reason}
                          </div>
                        )}
                        <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '3px', textAlign: 'right' }}>
                          Updated by: {item.updated_by || 'HR'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Select Stage */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  Select Next Pipeline Stage
                </label>
                <select
                  value={selectedStageOption}
                  onChange={e => setSelectedStageOption(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600,
                    color: '#0f172a', background: '#fff', outline: 'none'
                  }}
                >
                  <optgroup label="Interview Rounds">
                    <option value="Interview Round 1">🎯 Interview Round 1</option>
                    <option value="Interview Round 2">🎯 Interview Round 2</option>
                    <option value="Interview Round 3">🎯 Interview Round 3</option>
                    <option value="CUSTOM_ROUND">🎯 Custom Interview Round (Round 4, 5, 6...)</option>
                    <option value="Client Cleared">✨ Client Cleared (Final Round Passed)</option>
                  </optgroup>
                  <optgroup label="Final Outcomes">
                    <option value="Hired">🎉 Hired / Placed</option>
                    <option value="On Hold">⏸️ On Hold (Client Feedback)</option>
                    <option value="Client Rejected">🚫 Client Rejected (This Job Only)</option>
                  </optgroup>
                </select>
              </div>

              {/* Custom Round Number Selector */}
              {selectedStageOption === 'CUSTOM_ROUND' && (
                <div style={{
                  background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px',
                  padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af' }}>
                      Select or Type Round Number:
                    </label>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb', background: '#dbeafe', padding: '2px 8px', borderRadius: '6px' }}>
                      Stage: Interview Round {customRoundNumber || 4}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {[4, 5, 6, 7].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCustomRoundNumber(num)}
                        style={{
                          padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                          border: customRoundNumber === num ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          background: customRoundNumber === num ? '#2563eb' : '#fff',
                          color: customRoundNumber === num ? '#fff' : '#334155',
                          cursor: 'pointer'
                        }}
                      >
                        Round {num}
                      </button>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Other:</span>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={customRoundNumber}
                        onChange={e => setCustomRoundNumber(Math.max(1, parseInt(e.target.value, 10) || 4))}
                        style={{
                          width: '65px', padding: '6px 10px', borderRadius: '6px',
                          border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700,
                          textAlign: 'center', outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Scope notice when rejected */}
              {selectedStageOption.includes('Reject') && (
                <div style={{
                  background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
                  padding: '12px 14px', fontSize: '12px', color: '#991b1b', lineHeight: 1.4
                }}>
                  <strong>ℹ️ Job-Scoped Rejection:</strong> This candidate will only be marked as rejected for <strong>{jobCode}</strong> ({job?.company}). Their master profile in the Applicant Database will remain <strong>Active / Available</strong> so recruiters can tag and submit them to other companies.
                </div>
              )}

              {/* Rejection Reason if rejecting */}
              {selectedStageOption.includes('Reject') && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Rejection Reason / Client Feedback
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Budget mismatch, Notice period too long, Skill gap in React..."
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '8px',
                      border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', outline: 'none'
                    }}
                  />
                </div>
              )}

              {/* Scheduled Date if Interview */}
              {(selectedStageOption.startsWith('Interview') || selectedStageOption === 'CUSTOM_ROUND') && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Interview Date & Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledDate}
                    onChange={e => setScheduledDate(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '8px',
                      border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', outline: 'none'
                    }}
                  />
                </div>
              )}

              {/* Stage Notes / Remarks */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Recruiter Notes / Client Feedback Remarks
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter any feedback shared by the client, interview details, or instructions..."
                  value={stageNotes}
                  onChange={e => setStageNotes(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box',
                    outline: 'none', resize: 'vertical'
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#f8fafc' }}>
              <button
                disabled={updatingStage}
                onClick={() => setStageModalCandidate(null)}
                style={{
                  padding: '9px 18px', borderRadius: '8px', border: '1px solid #cbd5e1',
                  background: '#fff', color: '#334155', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                disabled={updatingStage}
                onClick={handleSaveStage}
                style={{
                  padding: '9px 20px', borderRadius: '8px', border: 'none',
                  background: '#3b82f6', color: '#fff', fontSize: '13px', fontWeight: 700,
                  cursor: updatingStage ? 'not-allowed' : 'pointer', opacity: updatingStage ? 0.7 : 1
                }}
              >
                {updatingStage ? 'Saving...' : 'Save & Update Stage'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── Apple Liquid Glass AI Recommendations Drawer ── */}
      {matchingEnabled && job._uuid && aiDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="AI Candidate Recommendations"
          className="liquid-glass-drawer-overlay"
          onClick={handleCloseAiDrawer}
        >
          <div
            id="liquid-glass-drawer-panel"
            className="liquid-glass-drawer-panel"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="liquid-glass-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="apple-ai-pill-btn large" style={{ cursor: 'default', pointerEvents: 'none' }}>
                  <div className="apple-ai-pill-inner">
                    <div className="apple-ai-stars-box">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <path
                          className="star-orbit-node star-node-1"
                          d="M14 4C14 7.2 16.8 10 20 10C16.8 10 14 12.8 14 16C14 12.8 11.2 10 8 10C11.2 10 14 7.2 14 4Z"
                        />
                        <path
                          className="star-orbit-node star-node-2"
                          d="M6 3C6 4.5 7 5.5 8.5 5.5C7 5.5 6 6.5 6 8C6 6.5 5 5.5 3.5 5.5C5 5.5 6 4.5 6 3Z"
                        />
                        <path
                          className="star-orbit-node star-node-3"
                          d="M6 14C6 15.3 6.9 16.2 8 16.2C6.9 16.2 6 17.1 6 18.4C6 17.1 5.1 16.2 4 16.2C5.1 16.2 6 15.3 6 14Z"
                        />
                      </svg>
                    </div>
                    <span className="apple-ai-text">AI Match</span>
                  </div>
                </div>

                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                    Candidate Recommendations
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                    {job.jobCode} · {job.jobTitle}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div id="ai-drawer-header-actions" style={{ display: 'flex', alignItems: 'center' }} />
                <button
                  type="button"
                  className="liquid-glass-close-btn"
                  onClick={handleCloseAiDrawer}
                  aria-label="Close recommendations panel"
                  title="Close (Esc)"
                >
                  <FiX size={18} />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="liquid-glass-drawer-body">
              <CandidateRecommendations key={job._uuid} job={job} onTagged={reloadTagged} />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
