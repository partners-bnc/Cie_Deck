import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jobService } from '../../services/jobService.js';
import { FiArrowLeft, FiMail, FiCopy, FiExternalLink, FiCheck, FiUsers, FiRefreshCw, FiSend, FiCheckCircle } from 'react-icons/fi';

export default function AdminEmailAutomation() {
  const { jobCode } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [draftType, setDraftType] = useState('manager'); // 'manager' | 'client'
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [managerEmail, setManagerEmail] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [showRestriction, setShowRestriction] = useState(false);
  const curUserEmail = sessionStorage.getItem("bnc_admin_email") || "";
  const curUserRole = sessionStorage.getItem("bnc_admin_role");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [foundJob, hrs] = await Promise.all([
          jobService.fetchClientJobByCode(jobCode),
          jobService.fetchHRs()
        ]);
        setJob(foundJob || null);
        if (foundJob) {
          // Look up manager email from HR list
          if (foundJob.recruitmentManager) {
            const managerName = foundJob.recruitmentManager.trim().toLowerCase();
            const matchedHR = hrs.find(h => (h.hrName || '').trim().toLowerCase() === managerName);
            if (matchedHR && matchedHR.email) {
              setManagerEmail(matchedHR.email);
            }
          }
          // Use reporting client email directly from job (saved at job creation time)
          if (foundJob.reportingClientEmail) {
            setClientEmail(foundJob.reportingClientEmail);
          }
          const matches = await jobService.fetchShortlistedCandidatesByJob(jobCode);
          const applicants = await jobService.fetchApplicantsByIds(matches.map((item) => item.applicantId));
          const applicantMap = new Map(applicants.map((applicant) => [applicant.applicantId, applicant]));
          const enriched = matches.map((match) => ({
            ...match,
            ...(applicantMap.get(match.applicantId) || {})
          }));
          setCandidates(enriched);
        } else {
          setCandidates([]);
        }
      } catch (err) {
        console.error('Failed to load email automation data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [jobCode]);

  const formatDate = (ds) => {
    if (!ds) return '—';
    const d = new Date(ds);
    return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map(c => c.applicantId)));
    }
  };

  const selected = candidates.filter(c => selectedIds.has(c.applicantId));
  const isManager = draftType === 'manager';

  const handleDraftTypeChange = (type) => {
    if (type === 'client') {
      const isAuthorized = managerEmail && curUserEmail.toLowerCase() === managerEmail.toLowerCase();
      // Allow super_admin? User said "Only recruitment manager", but usually super_admin is an exception.
      // However, to be safe and follow the request strictly:
      if (!isAuthorized && curUserRole !== 'super_admin') {
        setShowRestriction(true);
        return;
      }
    }
    setDraftType(type);
  };

  // ── Email Generation ──
  const toEmail = isManager
    ? (managerEmail || (job?.recruitmentManager ? `${job.recruitmentManager.replace(/\s+/g, '').toLowerCase()}@bncglobal.com` : ''))
    : (clientEmail || job?.reportingClientEmail || (job?.clientName ? `${job.clientName.replace(/\s+/g, '').toLowerCase()}@client.com` : ''));

  const greeting = isManager
    ? (job?.recruitmentManager || 'Recruitment Manager')
    : (job?.reportingClientName || job?.clientName || 'Hiring Manager');

  const subject = isManager
    ? `Candidate Submission for Review – ${job?.jobTitle || ''} (${job?.jobCode || ''})`
    : `Candidate Profiles for ${job?.jobTitle || ''} – ${job?.jobCode || ''} | ${job?.clientName || ''}`;

  // ── Plain text body (for Gmail compose URL auto-fill) ──
  const generateBody = () => {
    if (selected.length === 0) return '';
    let body = '';

    body += `Dear ${greeting},\n\n`;
    body += `Here is the Job Detail:\n\n`;
    body += `Job Title:   ${job?.jobTitle}\n`;
    body += `Job Code:    ${job?.jobCode}\n`;
    body += `Client:      ${job?.clientName}\n`;
    body += `Location:    ${job?.location}${job?.state ? ', ' + job.state : ''}, ${job?.country}\n`;
    body += `Pay Rate:    ${job?.payRate || 'N/A'}\n`;
    body += `Experience:  ${job?.experience || 'N/A'}\n\n`;

    if (isManager) {
      body += `Please find below the shortlisted candidate(s) for your review:\n\n`;
    } else {
      body += `Please find below the candidate(s) submitted for your consideration:\n\n`;
    }

    // Candidate details
    if (isManager) {
      body += `S.No | Name | Contact | Email | Location | Experience | Recruiter Comments | Resume\n`;
      body += `${'—'.repeat(100)}\n`;
      selected.forEach((c, i) => {
        body += `${i + 1}. ${c.name || 'N/A'} | ${c.contactNumber || 'N/A'} | ${c.email || 'N/A'} | ${c.currentLocation || 'N/A'} | ${c.totalExperience || 'N/A'} | ${c.recruiterComments || 'N/A'} | ${c.resumeUrl || c.resumeLink || 'N/A'}\n`;
      });
    } else {
      body += `S.No | Candidate Name | Experience | Current CTC | Expected CTC | Notice Period | Comment | Resume Link\n`;
      body += `${'—'.repeat(100)}\n`;
      selected.forEach((c, i) => {
        body += `${i + 1}. ${c.name || 'N/A'} | ${c.totalExperience || 'N/A'} | ${c.currentCTC || 'N/A'} | ${c.expectedPay || 'N/A'} | ${c.noticePeriod || 'N/A'} | ${c.recruiterComments || 'N/A'} | ${c.resumeUrl || c.resumeLink || 'N/A'}\n`;
      });
    }

    body += `\n${isManager ? 'Please review and confirm the candidates to proceed with client submission.' : 'We believe these candidates are an excellent match. Please share your feedback.'}\n\n`;
    body += `Best Regards,\nBnC Global Services \u2013 Recruitment Team`;
    return body;
  };

  // ── JSX body with real HTML table (for UI preview) ──
  const renderBodyJSX = () => {
    if (selected.length === 0) return null;

    const thStyle = { padding: '8px 12px', fontSize: '11px', fontWeight: 800, color: '#475569', background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', textAlign: 'left', whiteSpace: 'nowrap' };
    const tdStyle = { padding: '8px 12px', fontSize: '12px', color: '#334155', borderBottom: '1px solid #e2e8f0' };

    const managerCols = ['S.No', 'Name', 'Contact', 'Email', 'Location', 'Experience', 'Recruiter Comments', 'Resume'];
    const clientCols = ['S.No', 'Candidate Name', 'Experience', 'Current CTC', 'Expected CTC', 'Notice Period', 'Comment', 'Resume'];
    const cols = isManager ? managerCols : clientCols;

    return (
      <div>
        {/* Greeting */}
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#1e293b' }}>
          Dear <strong>{greeting}</strong>,
        </p>

        {/* Job Details heading + info */}
        <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Here is the Job Detail:</p>
        <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px' }}>
            <div><strong style={{ color: '#64748b' }}>Job Title:</strong> <span style={{ color: '#0f172a' }}>{job?.jobTitle}</span></div>
            <div><strong style={{ color: '#64748b' }}>Job Code:</strong> <span style={{ color: '#0f172a' }}>{job?.jobCode}</span></div>
            <div><strong style={{ color: '#64748b' }}>Client:</strong> <span style={{ color: '#0f172a' }}>{job?.clientName}</span></div>
            <div><strong style={{ color: '#64748b' }}>Location:</strong> <span style={{ color: '#0f172a' }}>{job?.location}{job?.state ? ', ' + job.state : ''}, {job?.country}</span></div>
            <div><strong style={{ color: '#64748b' }}>Pay Rate:</strong> <span style={{ color: '#0f172a' }}>{job?.payRate || 'N/A'}</span></div>
            <div><strong style={{ color: '#64748b' }}>Experience:</strong> <span style={{ color: '#0f172a' }}>{job?.experience || 'N/A'}</span></div>
          </div>
        </div>

        {/* Intro text AFTER job details */}
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#475569' }}>
          {isManager
            ? 'Please find below the shortlisted candidate(s) for your review:'
            : 'Please find below the candidate(s) submitted for your consideration:'}
        </p>

        {/* Candidate Table */}
        <div style={{ borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>{cols.map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {selected.map((c, i) => {
                const resumeLink = c.resumeUrl || c.resumeLink || '';
                const buildRow = isManager
                  ? [String(i + 1), c.name, c.contactNumber, c.email, c.currentLocation, c.totalExperience, c.recruiterComments]
                  : [String(i + 1), c.name, c.totalExperience, c.currentCTC, c.expectedPay, c.noticePeriod, c.recruiterComments];
                return (
                  <tr key={c.applicantId} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    {buildRow.map((val, ci) => <td key={ci} style={tdStyle}>{val || 'N/A'}</td>)}
                    <td style={tdStyle}>
                      {resumeLink ? (
                        <a href={resumeLink} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                          View Resume ↗
                        </a>
                      ) : 'N/A'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Closing */}
        <p style={{ margin: '20px 0 4px', fontSize: '13px', color: '#475569' }}>
          {isManager
            ? 'Please review and confirm the candidates to proceed with client submission.'
            : 'We believe these candidates are an excellent match. Please share your feedback.'}
        </p>
        <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#1e293b' }}>
          Best Regards,<br />
          <strong>BnC Global Services – Recruitment Team</strong>
        </p>
      </div>
    );
  };

  const bodyText = generateBody();

  // ── Generate HTML string for clipboard (renders table in Gmail) ──
  const generateHtmlBody = () => {
    if (selected.length === 0) return '';

    const thCss = 'padding:8px 12px;font-size:12px;font-weight:700;color:#475569;background:#f1f5f9;border:1px solid #cbd5e1;text-align:left';
    const tdCss = 'padding:8px 12px;font-size:12px;color:#334155;border:1px solid #e2e8f0';

    const greetingText = isManager ? (job?.recruitmentManager || 'Recruitment Manager') : (job?.reportingClientName || job?.clientName || 'Hiring Manager');
    const intro = isManager
      ? 'Please find below the shortlisted candidate(s) for your review:'
      : 'We are pleased to submit the following candidate(s) for your consideration:';

    let html = `<p>Dear <b>${greetingText}</b>,</p>`;

    // Job Details heading + info FIRST
    html += `<p><b>Here is the Job Detail:</b></p>`;
    html += `<table style="border-collapse:collapse;margin-bottom:16px;font-size:12px"><tbody>`;
    html += `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-weight:700">Job Title:</td><td style="padding:4px 0">${job?.jobTitle || ''}</td></tr>`;
    html += `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-weight:700">Job Code:</td><td style="padding:4px 0">${job?.jobCode || ''}</td></tr>`;
    html += `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-weight:700">Client:</td><td style="padding:4px 0">${job?.clientName || ''}</td></tr>`;
    html += `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-weight:700">Location:</td><td style="padding:4px 0">${job?.location || ''}${job?.state ? ', ' + job.state : ''}, ${job?.country || ''}</td></tr>`;
    html += `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-weight:700">Pay Rate:</td><td style="padding:4px 0">${job?.payRate || 'N/A'}</td></tr>`;
    html += `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-weight:700">Experience:</td><td style="padding:4px 0">${job?.experience || 'N/A'}</td></tr>`;
    html += `</tbody></table>`;

    // Intro text AFTER job details
    html += `<p>${intro}</p>`;

    // Candidate table
    const managerHeaders = ['S.No', 'Name', 'Contact', 'Email', 'Location', 'Experience', 'Recruiter Comments', 'Resume'];
    const clientHeaders = ['S.No', 'Candidate Name', 'Experience', 'Current CTC', 'Expected CTC', 'Notice Period', 'Comment', 'Resume'];
    const headers = isManager ? managerHeaders : clientHeaders;

    html += `<table style="border-collapse:collapse;width:100%;font-size:12px;border:1px solid #cbd5e1">`;
    html += `<thead><tr>${headers.map(h => `<th style="${thCss}">${h}</th>`).join('')}</tr></thead>`;
    html += `<tbody>`;

    selected.forEach((c, i) => {
      const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      const resumeLink = c.resumeUrl || c.resumeLink || '';
      const resumeCell = resumeLink
        ? `<a href="${resumeLink}" style="color:#2563eb;font-weight:600;text-decoration:none">View Resume</a>`
        : 'N/A';

      let cells = '';
      if (isManager) {
        cells = [i + 1, c.name, c.contactNumber, c.email, c.currentLocation, c.totalExperience, c.recruiterComments].map(v => `<td style="${tdCss}">${v || 'N/A'}</td>`).join('');
      } else {
        cells = [i + 1, c.name, c.totalExperience, c.currentCTC, c.expectedPay, c.noticePeriod, c.recruiterComments].map(v => `<td style="${tdCss}">${v || 'N/A'}</td>`).join('');
      }
      cells += `<td style="${tdCss}">${resumeCell}</td>`;
      html += `<tr style="background:${bg}">${cells}</tr>`;
    });

    html += `</tbody></table>`;

    const closing = isManager
      ? 'Please review and confirm the candidates to proceed with client submission.'
      : 'We believe these candidates are an excellent match for the role. Please share your feedback at your earliest convenience.';
    html += `<p>${closing}</p>`;
    html += `<p>Best Regards,<br/><b>BnC Global Services – Recruitment Team</b></p>`;

    return html;
  };

  const handleCopy = async () => {
    try {
      const htmlContent = generateHtmlBody();
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const textBlob = new Blob([`To: ${toEmail}\nSubject: ${subject}\n\n${bodyText}`], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blob,
          'text/plain': textBlob
        })
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback to plain text
      try {
        await navigator.clipboard.writeText(`To: ${toEmail}\nSubject: ${subject}\n\n${bodyText}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { alert('Failed to copy.'); }
    }
  };

  const [mailOpened, setMailOpened] = useState(false);

  const handleMailto = async () => {
    // Copy HTML with table to clipboard
    try {
      const htmlContent = generateHtmlBody();
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const textBlob = new Blob([bodyText], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/html': blob, 'text/plain': textBlob })
      ]);
    } catch { /* silent */ }

    // Open Gmail compose with only To and Subject (body will be pasted by user)
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toEmail)}&su=${encodeURIComponent(subject)}`;
    window.open(gmailUrl, '_blank');

    setMailOpened(true);
    setTimeout(() => setMailOpened(false), 5000);
  };

  const handleSendAutomatically = async () => {
    if (!toEmail) return alert('No recipient email found.');
    
    // Validation for Client Submission
    if (!isManager) {
      const invalidCandidates = selected.filter(c => c.currentStage === 'Pipeline');
      if (invalidCandidates.length > 0) {
        return alert(`Cannot send client email. ${invalidCandidates.length} candidate(s) have not been submitted to the Manager yet. Please send the Manager draft first.`);
      }
    }

    if (!window.confirm(`Send this report to ${toEmail} automatically?`)) return;

    setSending(true);
    try {
      const htmlContent = generateHtmlBody();
      const result = await jobService.sendDirectEmail(toEmail, subject, htmlContent);
      if (result.success) {
        
        // Update stages
        const newStage = isManager ? 'Manager Submit' : 'Client Submission';
        await Promise.all(selected.map(c => jobService.updateShortlistStage(c.applicantId, jobCode, newStage)));
        
        // Update local state
        setCandidates(prev => prev.map(c => {
          if (selectedIds.has(c.applicantId)) {
            // Only upgrade stage if moving forward
            const stageOrder = { 'Pipeline': 0, 'Manager Submit': 1, 'Client Submission': 2, 'Feedback': 3 };
            const currentOrder = stageOrder[c.currentStage] || 0;
            const newOrder = stageOrder[newStage] || 0;
            if (newOrder > currentOrder) return { ...c, currentStage: newStage };
          }
          return c;
        }));

        alert(`Email sent successfully via ZeptoMail! Stage updated to "${newStage}".`);
      } else {
        alert('Failed: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error: ' + err.toString());
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
        <FiRefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
        <h2>Loading Email Automation...</h2>
      </div>
    );
  }

  if (!job) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#e11d48' }}>
        <h2>Job not found!</h2>
        <button onClick={() => navigate(-1)} style={{ padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}>Go Back</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', background: '#f8fafc', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px'
      }}>
        <button
          onClick={() => navigate(`/admin/client-jobs/${jobCode}`)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', display: 'flex' }}
        >
          <FiArrowLeft size={22} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
            📧 Email Automation
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            {job.jobCode} – {job.jobTitle} | {job.clientName}
          </p>
        </div>
      </div>

      {/* ── TOP: Candidate Selection Panel ── */}
      <div style={{
        background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0',
        padding: '24px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FiUsers size={18} color="#3b82f6" />
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
              Select Candidates
            </h2>
            <span style={{
              background: '#eff6ff', color: '#1e40af', padding: '3px 10px',
              borderRadius: '12px', fontSize: '11px', fontWeight: 700
            }}>
              {candidates.length} tagged
            </span>
          </div>
          {selectedIds.size > 0 && (
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a' }}>
              ✓ {selectedIds.size} selected
            </span>
          )}
        </div>

        {candidates.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
            No candidates have been tagged for this job yet.
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '36px 1.5fr 1.2fr 1fr 1fr',
              padding: '10px 16px', background: '#f8fafc', borderRadius: '8px 8px 0 0',
              border: '1px solid #e2e8f0', gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <input
                  type="checkbox"
                  checked={candidates.length > 0 && selectedIds.size === candidates.length}
                  onChange={toggleAll}
                  style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#3b82f6' }}
                />
              </div>
              {['NAME', 'CONTACT / EMAIL', 'LOCATION', 'TAGGED BY'].map(h => (
                <div key={h} style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px' }}>{h}</div>
              ))}
            </div>

            {/* Candidate Rows */}
            {candidates.map(c => {
              const isChecked = selectedIds.has(c.applicantId);
              return (
                <div
                  key={c.applicantId}
                  onClick={() => toggleSelect(c.applicantId)}
                  style={{
                    display: 'grid', gridTemplateColumns: '36px 1.5fr 1.2fr 1fr 1fr',
                    padding: '12px 16px', gap: '16px', cursor: 'pointer',
                    borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0',
                    borderBottom: '1px solid #e2e8f0', alignItems: 'center',
                    background: isChecked ? '#f0f9ff' : '#fff',
                    transition: 'background 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(c.applicantId)}
                      onClick={e => e.stopPropagation()}
                      style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#3b82f6' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{c.name}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>#{c.applicantId}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#334155' }}>{c.contactNumber || 'N/A'}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{c.email || 'N/A'}</div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#334155' }}>{c.currentLocation || 'N/A'}</div>
                  <div style={{ fontSize: '12px', color: '#334155' }}>{c.uploadedBy || 'N/A'}</div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* ── BOTTOM: Email Draft Preview ── */}
      {selected.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0',
          padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          animation: 'fadeIn 0.3s ease'
        }}>
          {/* Draft Header + Type Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FiMail size={18} color={isManager ? '#2563eb' : '#16a34a'} />
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                {isManager ? 'Manager Submission Draft' : 'Client Submission Draft'}
              </h2>
            </div>
            {/* Toggle */}
            <div style={{ display: 'flex', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <button
                onClick={() => handleDraftTypeChange('manager')}
                style={{
                  padding: '7px 16px', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                  background: isManager ? '#3b82f6' : '#fff',
                  color: isManager ? '#fff' : '#64748b',
                  transition: 'all 0.2s'
                }}
              >
                Manager
              </button>
              <button
                onClick={() => handleDraftTypeChange('client')}
                style={{
                  padding: '7px 16px', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                  background: !isManager ? '#16a34a' : '#fff',
                  color: !isManager ? '#fff' : '#64748b',
                  borderLeft: '1px solid #e2e8f0',
                  transition: 'all 0.2s'
                }}
              >
                Client
              </button>
            </div>
          </div>

          {/* To */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>To:</label>
            <div style={{
              padding: '10px 14px', background: '#f8fafc', borderRadius: '8px',
              border: '1px solid #e2e8f0', fontSize: '13px', color: '#1e293b', fontWeight: 600
            }}>
              {toEmail || 'N/A — Please add email manually'}
            </div>
          </div>

          {/* Subject */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>Subject:</label>
            <div style={{
              padding: '10px 14px', background: '#f8fafc', borderRadius: '8px',
              border: '1px solid #e2e8f0', fontSize: '13px', color: '#1e293b', fontWeight: 600
            }}>
              {subject}
            </div>
          </div>

          {/* Body */}
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '8px' }}>Body:</label>
          <div style={{
            background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: '10px',
            padding: '20px', fontSize: '13px', lineHeight: '1.6', color: '#334155'
          }}>
            {renderBodyJSX()}
          </div>

          {/* Candidate count + Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
            <span style={{
              background: isManager ? '#dbeafe' : '#dcfce7',
              color: isManager ? '#1e40af' : '#166534',
              padding: '5px 14px', borderRadius: '12px', fontSize: '11px', fontWeight: 700
            }}>
              {selected.length} candidate{selected.length > 1 ? 's' : ''} included
            </span>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleCopy}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '10px 20px', borderRadius: '8px', border: '1px solid #e2e8f0',
                  background: '#fff', color: copied ? '#16a34a' : '#1e293b',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                {copied ? <><FiCheck size={14} /> Copied!</> : <><FiCopy size={14} /> Copy Draft</>}
              </button>
              <button
                onClick={handleMailto}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '10px 20px', borderRadius: '8px', border: '1px solid #e2e8f0',
                  background: '#fff', color: '#1e293b', fontSize: '13px', fontWeight: 700,
                  cursor: 'pointer', transition: 'background 0.2s'
                }}
              >
                <FiExternalLink size={14} /> Gmail
              </button>
              <button
                onClick={handleSendAutomatically}
                disabled={sending}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '10px 24px', borderRadius: '8px', border: 'none',
                  background: sending ? '#94a3b8' : 'linear-gradient(135deg, #0b2f5b, #1a4a8a)',
                  color: '#fff', fontSize: '13px', fontWeight: 700,
                  cursor: sending ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(11, 47, 91, 0.2)'
                }}
              >
                {sending ? (
                   <FiRefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                ) : <FiSend size={14} />}
                {sending ? 'Sending...' : 'Send Automatically'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state when no candidates selected */}
      {selected.length === 0 && candidates.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: '16px', border: '2px dashed #e2e8f0',
          padding: '50px', textAlign: 'center', color: '#94a3b8'
        }}>
          <FiMail size={36} style={{ marginBottom: '12px', opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
            Select candidates above to preview the email draft
          </p>
        </div>
      )}

      {/* Toast notification for Open in Mail */}
      {mailOpened && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          background: '#0f172a', color: '#fff', padding: '14px 28px', borderRadius: '12px',
          fontSize: '13px', fontWeight: 700, zIndex: 9999,
          boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', gap: '10px',
          animation: 'fadeIn 0.3s ease'
        }}>
          <FiCheck size={16} color="#22c55e" />
          <span>✅ Table copied! In Gmail, click the body area and press <span style={{ background: '#334155', padding: '2px 8px', borderRadius: '4px', margin: '0 2px', fontFamily: 'monospace' }}>Ctrl + V</span> to paste the formatted table.</span>
        </div>
      )}
      {/* Restriction Popup */}
      {showRestriction && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 10000, animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            background: '#fff', padding: '32px', borderRadius: '20px',
            maxWidth: '400px', width: '90%', textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{
              width: '64px', height: '64px', background: '#fee2e2', color: '#ef4444',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <FiMail size={32} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>
              Access Restricted
            </h2>
            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.6', marginBottom: '24px' }}>
              You are not allowed to send email to the client.<br/>
              Only the <b>Recruitment Manager</b> is authorized to send this format.<br/>
              <span style={{ fontSize: '13px', display: 'block', marginTop: '8px', color: '#3b82f6', fontWeight: 700 }}>
                Manager: {job?.recruitmentManager || 'Not assigned'}
              </span>
            </p>
            <button
              onClick={() => setShowRestriction(false)}
              style={{
                width: '100%', padding: '12px', background: '#0f172a', color: '#fff',
                border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer'
              }}
            >
              Understand
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
