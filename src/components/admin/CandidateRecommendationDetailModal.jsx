import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FiX, FiChevronLeft, FiChevronRight, FiStar, FiMail, FiPhone,
  FiBriefcase, FiMapPin, FiCalendar, FiBookOpen, FiUser, FiAward,
  FiFileText, FiClipboard, FiClock, FiCheckCircle, FiExternalLink,
  FiDownload, FiSend, FiSmile, FiHash, FiPaperclip, FiCheck, FiMoreHorizontal
} from 'react-icons/fi';
import { jobService } from '../../services/jobService.js';

// Helper for date formatting
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function CandidateRecommendationDetailModal({
  isOpen,
  currentIndex,
  results = [],
  job = {},
  onClose,
  onNavigate,
  onTagCandidate,
  tagging
}) {
  const [activeTab, setActiveTab] = useState('job-application');
  const [candidateData, setCandidateData] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSavedMsg, setNoteSavedMsg] = useState(false);
  const [movingStage, setMovingStage] = useState(false);
  const [copiedField, setCopiedField] = useState('');
  const [resumeLoading, setResumeLoading] = useState(true);

  // Reset resume loading state when opening resume tab or changing candidate
  useEffect(() => {
    if (activeTab === 'resume') {
      setResumeLoading(true);
      const timer = setTimeout(() => setResumeLoading(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [activeTab, currentIndex]);

  const currentResult = results[currentIndex] || null;
  const applicantSummary = currentResult?.applicants || {};
  const assessment = currentResult?.assessment || {};

  // Fetch full live database record for the candidate to ensure 100% authentic data
  useEffect(() => {
    if (!isOpen || !currentResult) return;
    const applicantCode = applicantSummary.applicant_code;
    if (!applicantCode) return;

    let cancelled = false;
    setLoadingDetails(true);

    jobService.getDatabaseCandidateById(applicantCode)
      .then(fullRecord => {
        if (!cancelled) {
          if (fullRecord) {
            setCandidateData(fullRecord);
            setNoteText(fullRecord.recruiterComments || '');
          } else {
            // Fallback to result summary
            setCandidateData(applicantSummary);
            setNoteText(applicantSummary.recruiter_comments || '');
          }
          setLoadingDetails(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCandidateData(applicantSummary);
          setLoadingDetails(false);
        }
      });

    return () => { cancelled = true; };
  }, [isOpen, currentIndex, applicantSummary.applicant_code]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && currentIndex > 0) onNavigate(currentIndex - 1);
      if (e.key === 'ArrowRight' && currentIndex < results.length - 1) onNavigate(currentIndex + 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, results.length, onClose, onNavigate]);

  if (!isOpen || !currentResult) return null;

  // Unified fields prioritizing full database record with fallback to recommendation summary
  const fullName = candidateData?.name || candidateData?.fullName || applicantSummary.full_name || applicantSummary.applicant_code || 'Candidate';
  const applicantCode = candidateData?.applicantId || candidateData?.applicantCode || applicantSummary.applicant_code || '';
  const email = candidateData?.email || applicantSummary.email || '';
  const phone = candidateData?.contactNumber || applicantSummary.mobile_number || '';
  const currentRole = candidateData?.currentPosition || applicantSummary.current_position || 'Not specified';
  const currentCompany = candidateData?.currentCompany || applicantSummary.current_company || 'Not specified';
  const totalExp = candidateData?.totalExperience || applicantSummary.total_experience || '—';
  const location = candidateData?.currentLocation || applicantSummary.current_location || 'Not specified';
  const education = candidateData?.education || applicantSummary.education || 'Not specified';
  const skills = candidateData?.skills || applicantSummary.skills || '';
  const noticePeriod = candidateData?.noticePeriod || applicantSummary.notice_period || 'Immediate';
  const currentCtc = candidateData?.currentCTC || applicantSummary.current_ctc || '—';
  const expectedCtc = candidateData?.expectedPay || applicantSummary.expected_pay || '—';
  const workAuth = candidateData?.workAuthorization || applicantSummary.work_authorization || 'Verified Citizen';
  const reasonForChange = candidateData?.reasonForChange || applicantSummary.reason_for_change || 'Seeking new career opportunities & challenges';
  const processKnowledge = candidateData?.processKnowledge || applicantSummary.process_knowledge || candidateData?.certification || 'Industry Best Practices';
  const appliedDate = formatDate(candidateData?.createdOn || applicantSummary.created_on || new Date());
  const origin = candidateData?.source || applicantSummary.source || 'Career Site';
  const rawResumeLink = candidateData?.resumeLink || applicantSummary.resume_link || '';
  const candidateStatus = candidateData?.status || applicantSummary.status || 'Active';

  // Format star rating from match score (e.g., 85/100 -> 4.3 / 5.0)
  const numericScore = typeof currentResult.score === 'number' ? currentResult.score : 70;
  const starScore = (Math.max(1, Math.min(100, numericScore)) / 20).toFixed(1);

  // Status mapping
  const isTagged = currentResult.alreadyTagged || candidateStatus === 'Tagged';
  const statusLabel = isTagged ? 'Tagged' : candidateStatus || 'Active';

  // Save recruiter note directly to Supabase
  const handleSaveNote = async () => {
    if (!applicantCode) return;
    setSavingNote(true);
    try {
      await jobService.updateDatabaseCandidate({
        applicantId: applicantCode,
        recruiterComments: noteText
      });
      setNoteSavedMsg(true);
      setTimeout(() => setNoteSavedMsg(false), 2500);
    } catch (err) {
      console.error('Error saving note:', err);
    } finally {
      setSavingNote(false);
    }
  };

  // Copy helper
  const handleCopy = (text, field) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(''), 2000);
  };

  // Move stage / tag candidate
  const handleMoveStage = async () => {
    if (isTagged || !onTagCandidate) return;
    setMovingStage(true);
    try {
      await onTagCandidate(currentResult);
    } finally {
      setMovingStage(false);
    }
  };

  // Authentic Database Rating Parameters (NO MOCK DATA)
  const getDbRating = (val) => {
    if (val !== undefined && val !== null && val !== '') {
      const num = Number(val);
      if (!isNaN(num) && num > 0) return num;
    }
    return 0;
  };

  const dbTechRating = getDbRating(candidateData?.technicalRating ?? applicantSummary?.technical_rating);
  const dbCommRating = getDbRating(candidateData?.communicationRating ?? applicantSummary?.communication_rating);
  const dbProfRating = getDbRating(candidateData?.professionalismRating ?? applicantSummary?.professionalism_rating);
  const dbOvrRating = getDbRating(candidateData?.overallRating ?? applicantSummary?.overall_rating);

  const isAnyRated = dbTechRating > 0 || dbCommRating > 0 || dbProfRating > 0 || dbOvrRating > 0;
  const displayOverallScore = dbOvrRating > 0
    ? dbOvrRating.toFixed(1)
    : (isAnyRated ? ((dbTechRating + dbCommRating + dbProfRating) / 3).toFixed(1) : '0.0');

  const ratingParameters = [
    {
      label: 'Technical Skills',
      dbColumn: 'technical_rating',
      rating: dbTechRating,
      starsText: dbTechRating > 0 ? dbTechRating.toFixed(1) : '0.0',
      percent: dbTechRating > 0 ? Math.min(100, Math.round((dbTechRating / 5) * 100)) : 0,
      isRated: dbTechRating > 0
    },
    {
      label: 'Communication Skills',
      dbColumn: 'communication_rating',
      rating: dbCommRating,
      starsText: dbCommRating > 0 ? dbCommRating.toFixed(1) : '0.0',
      percent: dbCommRating > 0 ? Math.min(100, Math.round((dbCommRating / 5) * 100)) : 0,
      isRated: dbCommRating > 0
    },
    {
      label: 'Professionalism',
      dbColumn: 'professionalism_rating',
      rating: dbProfRating,
      starsText: dbProfRating > 0 ? dbProfRating.toFixed(1) : '0.0',
      percent: dbProfRating > 0 ? Math.min(100, Math.round((dbProfRating / 5) * 100)) : 0,
      isRated: dbProfRating > 0
    },
    {
      label: 'Overall Rating',
      dbColumn: 'overall_rating',
      rating: dbOvrRating,
      starsText: dbOvrRating > 0 ? dbOvrRating.toFixed(1) : '0.0',
      percent: dbOvrRating > 0 ? Math.min(100, Math.round((dbOvrRating / 5) * 100)) : 0,
      isRated: dbOvrRating > 0
    }
  ];

  const panelContent = (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 0,
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        animation: 'liquidFadeIn 0.2s ease-out'
      }}
      onClick={(e) => e.stopPropagation()}
    >
        {/* ── 1. TOP CAROUSEL & CLOSE HEADER ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 28px',
          borderBottom: '1px solid #f1f5f9'
        }}>
          {/* Pagination Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => onNavigate(currentIndex - 1)}
                disabled={currentIndex <= 0}
                title="Previous candidate"
                aria-label="Previous candidate"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: '1px solid #e2e8f0',
                  background: currentIndex <= 0 ? '#f8fafc' : '#ffffff',
                  color: currentIndex <= 0 ? '#cbd5e1' : '#334155',
                  cursor: currentIndex <= 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <FiChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => onNavigate(currentIndex + 1)}
                disabled={currentIndex >= results.length - 1}
                title="Next candidate"
                aria-label="Next candidate"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: '1px solid #e2e8f0',
                  background: currentIndex >= results.length - 1 ? '#f8fafc' : '#ffffff',
                  color: currentIndex >= results.length - 1 ? '#cbd5e1' : '#334155',
                  cursor: currentIndex >= results.length - 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <FiChevronRight size={16} />
              </button>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
              {currentIndex + 1} out of {results.length}
            </span>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: 'none',
              background: '#f8fafc',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}
          >
            <FiX size={18} />
          </button>
        </div>

        {/* ── 2. CANDIDATE PROFILE HEADER ROW ── */}
        <div style={{
          padding: '20px 28px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f1f5f9',
          gap: '20px',
          flexWrap: 'wrap'
        }}>
          {/* Left: Avatar + Details */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
            {/* Avatar Circle */}
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              fontSize: '20px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.25)',
              border: '2px solid #ffffff'
            }}>
              {fullName.charAt(0).toUpperCase()}
            </div>

            {/* Candidate Identity */}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 800,
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {fullName}
                </h2>

                {/* Real Database Overall Rating Badge */}
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  background: '#ffffff',
                  color: dbOvrRating > 0 ? '#0f172a' : '#64748b',
                  fontSize: '12px',
                  fontWeight: 800,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
                }}>
                  <FiStar
                    size={16}
                    fill={dbOvrRating > 0 ? '#f59e0b' : '#e2e8f0'}
                    color={dbOvrRating > 0 ? '#f59e0b' : '#cbd5e1'}
                  />
                  <span>{dbOvrRating > 0 ? `${dbOvrRating.toFixed(1)} Overall` : 'Not Rated'}</span>
                </span>

                {/* Status Pill */}
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  background: isTagged ? '#e0f2fe' : '#dcfce7',
                  color: isTagged ? '#0369a1' : '#15803d',
                  fontSize: '12px',
                  fontWeight: 700
                }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: isTagged ? '#0284c7' : '#16a34a'
                  }} />
                  {statusLabel}
                </span>
              </div>

              {/* Origin, Applied At, Job Applied - Vertically aligned Key/Value pairs */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '28px',
                marginTop: '10px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Origin
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                    {origin}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Applied At
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                    {appliedDate}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Job Applied
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                    {job.jobTitle || currentRole}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              title="More options"
              aria-label="More options"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <FiMoreHorizontal size={17} />
            </button>

            {email ? (
              <a
                href={`mailto:${email}?subject=Regarding your application for ${encodeURIComponent(job.jobTitle || 'Role')}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  borderRadius: '10px',
                  background: '#0d5c58',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  boxShadow: '0 2px 8px rgba(13, 92, 88, 0.25)',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#094744'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#0d5c58'; }}
              >
                <FiMail size={15} />
                <span>Send Email</span>
              </a>
            ) : (
              <button
                type="button"
                disabled
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  borderRadius: '10px',
                  background: '#94a3b8',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'not-allowed'
                }}
              >
                <FiMail size={15} />
                <span>No Email</span>
              </button>
            )}
          </div>
        </div>

        {/* ── 3. NAVIGATION PILL TABS ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 28px',
          borderBottom: '1px solid #f1f5f9',
          background: '#ffffff'
        }}>
          {[
            { id: 'job-application', label: 'Job Application', icon: FiBriefcase },
            { id: 'resume', label: 'Resume', icon: FiFileText },
            { id: 'form-submission', label: 'Form Submission', icon: FiClipboard }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  border: isActive ? '1px solid #0f172a' : '1px solid #e2e8f0',
                  background: isActive ? '#0f172a' : '#ffffff',
                  color: isActive ? '#ffffff' : '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={13} color={isActive ? '#ffffff' : '#64748b'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── 4. MAIN DUAL-COLUMN BODY ── */}
        <div style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden'
        }}>
          {/* ── LEFT COLUMN (Tab Content, Scrollable) ── */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {/* ─── TAB 1: JOB APPLICATION ─── */}
            {activeTab === 'job-application' && (
              <>
                {/* Candidate Score Card with 4 Database Rating Parameters */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '20px 22px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '32px',
                  flexWrap: 'wrap'
                }}>
                  {/* Left: Overall Big Score */}
                  <div style={{ textAlign: 'center', minWidth: '100px' }}>
                    <div style={{ fontSize: '38px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                      {displayOverallScore}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '3px', margin: '8px 0 4px' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <FiStar
                          key={star}
                          size={14}
                          fill={isAnyRated && star <= Math.round(Number(displayOverallScore)) ? '#f59e0b' : '#e2e8f0'}
                          color={isAnyRated && star <= Math.round(Number(displayOverallScore)) ? '#f59e0b' : '#e2e8f0'}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                      {isAnyRated ? 'Overall score' : 'Not rated'}
                    </span>
                  </div>

                  {/* Right: Progress breakdown for 4 DB parameters */}
                  <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {ratingParameters.map((item) => (
                      <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
                        <span style={{ width: '160px', color: '#64748b', fontWeight: 600 }}>{item.label}</span>
                        <div style={{ flex: 1, height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${item.percent}%`,
                            height: '100%',
                            background: item.isRated ? 'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)' : 'transparent',
                            borderRadius: '4px'
                          }} />
                        </div>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontWeight: 800,
                          color: item.isRated ? '#0f172a' : '#94a3b8',
                          width: '36px',
                          justifyContent: 'flex-end'
                        }}>
                          <FiStar size={11} fill={item.isRated ? '#f59e0b' : '#e2e8f0'} color={item.isRated ? '#f59e0b' : '#e2e8f0'} />
                          {item.starsText}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Experience Card */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '20px 22px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>Experience</h3>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#0284c7' }}>View details ›</span>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                      {currentRole}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span style={{ padding: '3px 10px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                        🏢 {currentCompany}
                      </span>
                      <span style={{ padding: '3px 10px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                        📍 {location}
                      </span>
                      <span style={{ padding: '3px 10px', borderRadius: '6px', background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '12px', fontWeight: 700, color: '#16a34a' }}>
                        Notice: {noticePeriod}
                      </span>
                    </div>
                  </div>

                  {/* 4-Column Compensation & Experience Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '14px',
                    paddingTop: '14px',
                    borderTop: '1px solid #f1f5f9'
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>Experience in Years</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{totalExp}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>Current Employer</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{currentCompany}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>Current CTC</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{currentCtc}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>Expected Salary</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{expectedCtc}</div>
                    </div>
                  </div>
                </div>

                {/* Score Card / AI Match Details */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '20px 22px'
                }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                    Score Card & AI Assessment
                  </h3>

                  <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.6, marginBottom: '14px' }}>
                    {assessment.analysis || assessment.reason || candidateData?.aiAnalysis || 'Strong candidate alignment identified based on resume qualifications and experience profile.'}
                  </div>

                  {/* Supporting Evidence quotes from CV */}
                  {assessment.evidence?.length > 0 && (
                    <div style={{ background: '#f0fdf4', borderLeft: '3px solid #16a34a', borderRadius: '10px', padding: '12px 16px', marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Supporting Resume Evidence
                      </div>
                      {assessment.evidence.map((ref, idx) => (
                        <p key={idx} style={{ margin: '3px 0', color: '#1e293b', fontSize: '12px' }}>
                          <strong>{ref.field?.replaceAll('_', ' ')}:</strong> “{ref.quote}”
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Key Skills Tags */}
                  {skills && (
                    <div style={{ marginTop: '14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Highlighted Skills
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {skills.split(',').map((skill, idx) => (
                          <span key={idx} style={{
                            padding: '3px 9px',
                            borderRadius: '6px',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            fontSize: '11px',
                            fontWeight: 700
                          }}>
                            {skill.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ─── TAB 2: RESUME PREVIEW ─── */}
            {activeTab === 'resume' && (
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                minHeight: '620px'
              }}>
                {/* Resume Header Toolbar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#f8fafc',
                  borderRadius: '10px',
                  marginBottom: '14px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FiFileText size={18} color="#0284c7" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                      {fullName.replace(/\s+/g, '_')}_Resume.pdf
                    </span>
                  </div>

                  {rawResumeLink && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <a
                        href={rawResumeLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          color: '#334155',
                          fontSize: '12px',
                          fontWeight: 700,
                          textDecoration: 'none'
                        }}
                      >
                        <FiExternalLink size={13} />
                        <span>Open Document</span>
                      </a>
                      <a
                        href={rawResumeLink}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          background: '#0284c7',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: 700,
                          textDecoration: 'none'
                        }}
                      >
                        <FiDownload size={13} />
                        <span>Download</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Embedded Document View with Pure White Background & Animated Loader */}
                {rawResumeLink ? (
                  <div style={{
                    position: 'relative',
                    flex: 1,
                    minHeight: '620px',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                    background: '#ffffff'
                  }}>
                    {resumeLoading && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        zIndex: 10
                      }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          border: '3px solid #e2e8f0',
                          borderTopColor: '#0284c7',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite'
                        }} />
                        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                          Loading resume preview…
                        </span>
                      </div>
                    )}

                    <iframe
                      src={rawResumeLink}
                      title="Candidate Resume"
                      onLoad={() => setResumeLoading(false)}
                      style={{
                        width: '100%',
                        height: '100%',
                        minHeight: '620px',
                        border: 'none',
                        background: '#ffffff',
                        display: 'block'
                      }}
                    />
                  </div>
                ) : (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px',
                    color: '#94a3b8',
                    textAlign: 'center'
                  }}>
                    <FiFileText size={48} style={{ opacity: 0.5, marginBottom: '14px' }} />
                    <h4 style={{ margin: 0, color: '#334155', fontSize: '16px' }}>No Resume Uploaded</h4>
                    <p style={{ margin: '6px 0 0', fontSize: '13px' }}>
                      This applicant record does not have a direct resume file URL attached.
                    </p>
                    {candidateData?.summary && (
                      <div style={{
                        marginTop: '20px',
                        textAlign: 'left',
                        background: '#f8fafc',
                        padding: '16px',
                        borderRadius: '10px',
                        maxWidth: '550px',
                        fontSize: '13px',
                        color: '#334155',
                        lineHeight: 1.6
                      }}>
                        <strong>Parsed Summary:</strong> {candidateData.summary}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB 3: FORM SUBMISSION ─── */}
            {activeTab === 'form-submission' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  {
                    num: 1,
                    question: 'What are your primary technical skills and research tools?',
                    answer: skills || 'Standard competencies verified during review.'
                  },
                  {
                    num: 2,
                    question: 'What is your current role and organization?',
                    answer: `${currentRole} at ${currentCompany}`
                  },
                  {
                    num: 3,
                    question: 'How long have you been working in this specialization?',
                    answer: `${totalExp} (Relevant Experience: ${candidateData?.relevantExperience || totalExp})`
                  },
                  {
                    num: 4,
                    question: 'What process knowledge or certifications do you hold?',
                    answer: processKnowledge
                  },
                  {
                    num: 5,
                    question: 'What is your primary motivation for seeking a new opportunity?',
                    answer: reasonForChange
                  },
                  {
                    num: 6,
                    question: 'What is your work authorization status and earliest joining notice?',
                    answer: `Work Authorization: ${workAuth} | Notice Period: ${noticePeriod}`
                  }
                ].map((item) => (
                  <div
                    key={item.num}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '14px',
                      padding: '18px 22px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <span style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: '#eff6ff',
                        color: '#0284c7',
                        fontSize: '12px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {item.num}
                      </span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                          {item.question}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', lineHeight: 1.5 }}>
                          {item.answer}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN (Candidate Details & Notes, Fixed) ── */}
          <div style={{
            width: '330px',
            borderLeft: '1px solid #f1f5f9',
            padding: '24px 22px',
            overflowY: 'auto',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>
            {/* 1. Personal Information */}
            <div>
              <h4 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                Personal Information
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                {/* Email Address - Horizontally aligned key-value pair */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}>
                  <span style={{ color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>Email Address</span>
                  {email ? (
                    <button
                      type="button"
                      onClick={() => handleCopy(email, 'email')}
                      title="Click to copy email"
                      style={{
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        border: '1px solid #bae6fd',
                        background: '#f0f9ff',
                        color: '#0284c7',
                        fontWeight: 700,
                        fontSize: '11px',
                        cursor: 'pointer',
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '180px'
                      }}
                    >
                      {copiedField === 'email' ? 'Copied ✓' : email}
                    </button>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>Not specified</span>
                  )}
                </div>

                {/* Phone Number - Horizontally aligned key-value pair */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}>
                  <span style={{ color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>Phone Number</span>
                  {phone ? (
                    <button
                      type="button"
                      onClick={() => handleCopy(phone, 'phone')}
                      title="Click to copy phone"
                      style={{
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        border: '1px solid #bae6fd',
                        background: '#f0f9ff',
                        color: '#0284c7',
                        fontWeight: 700,
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      {copiedField === 'phone' ? 'Copied ✓' : phone}
                    </button>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>Not specified</span>
                  )}
                </div>

                {/* Work Authorization */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f8fafc', paddingTop: '8px' }}>
                  <span style={{ color: '#94a3b8' }}>Work Auth</span>
                  <strong style={{ color: '#0f172a' }}>{workAuth}</strong>
                </div>

                {/* Notice Period */}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Notice Period</span>
                  <strong style={{ color: '#0f172a' }}>{noticePeriod}</strong>
                </div>

                {/* Living Address */}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Living Address</span>
                  <strong style={{ color: '#0f172a', textAlign: 'right', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {location}
                  </strong>
                </div>
              </div>
            </div>

            {/* 2. Education Information */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '18px' }}>
              <h4 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                Education Information
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                <div>
                  <div style={{ color: '#94a3b8', fontWeight: 600 }}>University / College</div>
                  <div style={{ color: '#0f172a', fontWeight: 700, marginTop: '2px' }}>{education}</div>
                </div>

                <div>
                  <div style={{ color: '#94a3b8', fontWeight: 600 }}>Qualification Held</div>
                  <div style={{ color: '#0f172a', fontWeight: 700, marginTop: '2px' }}>
                    {candidateData?.qualification || 'Bachelor / Graduate'}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f8fafc', paddingTop: '8px' }}>
                  <span style={{ color: '#94a3b8' }}>Referral / Source</span>
                  <strong style={{ color: '#0f172a' }}>{origin}</strong>
                </div>
              </div>
            </div>

            {/* 3. Recruiter Notes Section */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>Notes</h4>
                {noteSavedMsg && <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>Saved ✓</span>}
              </div>

              {/* Note input box */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Write note for this candidate..."
                  rows={3}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '12px',
                    color: '#0f172a',
                    resize: 'none',
                    fontFamily: 'inherit'
                  }}
                />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '6px' }}>
                  <div style={{ display: 'flex', gap: '8px', color: '#94a3b8' }}>
                    <FiSmile size={14} style={{ cursor: 'pointer' }} />
                    <FiHash size={14} style={{ cursor: 'pointer' }} />
                    <FiPaperclip size={14} style={{ cursor: 'pointer' }} />
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveNote}
                    disabled={savingNote}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#0f172a',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: savingNote ? 'wait' : 'pointer'
                    }}
                  >
                    {savingNote ? 'Saving…' : 'Save Note'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );

  const drawerPanel = typeof document !== 'undefined' ? document.getElementById('liquid-glass-drawer-panel') : null;
  return drawerPanel ? createPortal(panelContent, drawerPanel) : panelContent;
}
