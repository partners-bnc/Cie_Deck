import { createElement, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiUsers, FiSearch, FiRefreshCw, FiInfo, FiEye, FiBookmark, FiCheck, FiX, FiCpu, FiZap } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { candidateMatchingService } from '../../services/candidateMatchingService.js';
import { jobService } from '../../services/jobService.js';
import CandidateRecommendationDetailModal from './CandidateRecommendationDetailModal.jsx';

const panel = {
  background: 'transparent',
  border: 'none',
  borderRadius: 0,
  padding: '0 0 20px 0',
  marginBottom: 0,
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Plus Jakarta Sans", sans-serif',
  fontSize: 13,
};

const button = {
  padding: '7px 15px',
  borderRadius: 9999,
  border: '1px solid rgba(203, 213, 225, 0.8)',
  background: 'rgba(255, 255, 255, 0.85)',
  color: '#0f172a',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 600,
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
};

const cell = { padding: '14px 16px', fontSize: 13, color: '#334155', background: 'transparent' };
const running = status => ['extracting', 'queued', 'running'].includes(status);
const icon = (component, size = 16, style = {}) => createElement(component, { size, 'aria-hidden': true, focusable: false, style: { flexShrink: 0, ...style } });

/** Slide-in Right Popup for Job Interpretation Notes */
export function JobInterpretationNotesDrawer({ warnings, open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open || !warnings?.length) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(15, 23, 42, 0.35)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'liquidFadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(440px, 92vw)',
          height: '100%',
          background: 'linear-gradient(165deg, rgba(255, 255, 255, 0.96) 0%, rgba(248, 250, 252, 0.94) 100%)',
          backdropFilter: 'blur(35px)',
          WebkitBackdropFilter: 'blur(35px)',
          borderLeft: '1.5px solid rgba(255, 255, 255, 0.95)',
          boxShadow: '-16px 0 40px rgba(15, 23, 42, 0.16)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(226, 232, 240, 0.8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiInfo size={17} />
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Job Interpretation Notes</h3>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>{warnings.length} requirement note{warnings.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="liquid-glass-close-btn"
            aria-label="Close notes"
            title="Close"
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '22px 24px', overflowY: 'auto', flex: 1 }}>
          <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
            The AI engine identified the following nuances and requirement interpretations while analyzing this job description:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {warnings.map((warning, i) => (
              <div key={i} style={{
                background: 'rgba(254, 252, 232, 0.85)',
                border: '1px solid rgba(254, 240, 138, 0.9)',
                borderRadius: 14,
                padding: '12px 16px',
                color: '#92400e',
                fontSize: 13,
                lineHeight: 1.6,
                display: 'flex',
                gap: 10
              }}>
                <span style={{ color: '#d97706', flexShrink: 0, marginTop: 1, fontWeight: 700 }}>•</span>
                <div>{warning}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CandidateTable({ children }) {
  return <div style={{
    background: 'transparent',
    borderRadius: 0,
    border: 'none',
    boxShadow: 'none',
    overflow: 'hidden'
  }}>
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880, background: 'transparent' }}>
        <thead>
          <tr style={{ background: 'transparent', borderBottom: '1.5px solid rgba(203, 213, 225, 0.6)' }}>
            {['#', 'Candidate', 'Current role', 'Experience', 'Location', 'Relevance /100', 'Actions'].map((label, i) =>
              <th
                key={i}
                scope="col"
                style={{
                  padding: i === 0 ? '12px 10px 12px 16px' : '12px 16px',
                  textAlign: i === 0 ? 'center' : 'left',
                  width: i === 0 ? 44 : undefined,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  whiteSpace: 'nowrap',
                  background: 'transparent',
                  border: 'none'
                }}
              >
                {label}
              </th>
            )}
          </tr>
        </thead>
        <tbody style={{ background: 'transparent' }}>{children}</tbody>
      </table>
    </div>
  </div>;
}

export function CandidateRow({ result, index, expanded, onToggle, onView, onTag, tagging, run, final = false }) {
  const applicant = result.applicants;
  const assessment = result.assessment || {};
  const detailId = `candidate-details-${result.applicant_id}`;
  const rankNumber = final ? (result.final_rank || index + 1) : (result.retrieval_rank || index + 1);

  return <>
    <tr style={{ borderBottom: '1px solid rgba(203, 213, 225, 0.45)', background: 'transparent', transition: 'background 0.15s ease' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.35)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>

      {/* # Column with clean number badge */}
      <td style={{ ...cell, width: 44, textAlign: 'center', padding: '14px 10px 14px 16px' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 26,
          borderRadius: 7,
          background: rankNumber <= 3 ? 'rgba(2, 132, 199, 0.1)' : 'rgba(148, 163, 184, 0.12)',
          color: rankNumber <= 3 ? '#0284c7' : '#64748b',
          fontSize: 12,
          fontWeight: 700,
        }}>
          {rankNumber}
        </span>
      </td>

      {/* Candidate Column */}
      <td style={cell}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{applicant.full_name || applicant.applicant_code}</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{applicant.applicant_code}</div>
      </td>

      {/* Current Role */}
      <td style={{ ...cell, fontSize: 12, maxWidth: 180, lineHeight: 1.4, color: '#334155' }}>{applicant.current_position || '—'}</td>

      {/* Experience */}
      <td style={{ ...cell, whiteSpace: 'nowrap', fontWeight: 600 }}>{applicant.total_experience || '—'}</td>

      {/* Location */}
      <td style={{ ...cell, fontSize: 12 }}>{applicant.current_location || '—'}</td>

      {/* Relevance Score */}
      <td style={cell}>{final ? <span aria-label={`Relevance ${result.score} out of 100`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, height: 28, padding: '0 8px', borderRadius: 9999, fontSize: 12, fontWeight: 800,
        color: '#fff',
        background: result.score >= 80 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : result.score >= 60 ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        boxShadow: result.score >= 80 ? '0 2px 8px rgba(16, 185, 129, 0.3)' : result.score >= 60 ? '0 2px 8px rgba(2, 132, 199, 0.3)' : '0 2px 8px rgba(245, 158, 11, 0.3)' }}>{result.score}</span>
        : <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600 }}>Pending</span>}</td>

      {/* Action Column: View, Tag, and Detail Expand combined with no extra gap */}
      <td style={cell}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <button
            type="button"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid rgba(203, 213, 225, 0.85)',
              background: 'rgba(255, 255, 255, 0.75)',
              color: '#334155',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.15s ease',
              padding: 0
            }}
            onClick={onView}
            title="View applicant"
            aria-label="View applicant"
          >
            {icon(FiEye, 15, { color: '#475569' })}
          </button>

          {final && (
            <button
              type="button"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: result.alreadyTagged
                  ? '1px solid rgba(203, 213, 225, 0.8)'
                  : '1px solid rgba(147, 197, 253, 0.85)',
                background: result.alreadyTagged
                  ? 'rgba(241, 245, 249, 0.7)'
                  : 'rgba(239, 246, 255, 0.85)',
                color: result.alreadyTagged ? '#94a3b8' : '#2563eb',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: result.alreadyTagged || run.is_stale || Boolean(tagging) ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                transition: 'all 0.15s ease',
                padding: 0
              }}
              disabled={result.alreadyTagged || run.is_stale || Boolean(tagging)}
              onClick={onTag}
              title={result.alreadyTagged ? 'Already tagged' : tagging === result.applicant_id ? 'Tagging…' : 'Tag for this job'}
              aria-label={result.alreadyTagged ? 'Already tagged' : tagging === result.applicant_id ? 'Tagging…' : 'Tag for this job'}
            >
              {icon(
                result.alreadyTagged
                  ? FiCheck
                  : tagging === result.applicant_id
                  ? FiRefreshCw
                  : FiBookmark,
                15,
                {
                  color: result.alreadyTagged ? '#64748b' : '#2563eb',
                  animation: tagging === result.applicant_id ? 'spin 1s linear infinite' : 'none'
                }
              )}
            </button>
          )}

          {/* Detail Expand button inside Actions column */}
          <button
            type="button"
            aria-label={`${expanded ? 'Collapse' : 'Expand'} details for ${applicant.full_name || applicant.applicant_code}`}
            aria-expanded={expanded}
            aria-controls={detailId}
            onClick={onToggle}
            title={expanded ? 'Collapse details' : 'Expand AI analysis details'}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid rgba(203, 213, 225, 0.85)',
              background: expanded ? 'rgba(2, 132, 199, 0.12)' : 'rgba(255, 255, 255, 0.75)',
              color: expanded ? '#0284c7' : '#475569',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              padding: 0
            }}
          >
            <span aria-hidden="true" style={{ display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', fontWeight: 700 }}>›</span>
          </button>
        </div>
      </td>
    </tr>

    {expanded && <tr style={{ background: 'rgba(255, 255, 255, 0.22)', borderBottom: '1px solid rgba(203, 213, 225, 0.45)' }}><td colSpan={7} id={detailId} style={{ padding: '20px 24px', background: 'transparent' }}>
      {/* Text fold metadata cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          ['Current location', applicant.current_location], ['Education', applicant.education],
          ['Current company', applicant.current_company], ['Current position', applicant.current_position],
          ['Notice period', applicant.notice_period],
        ].map(([label, value]) => <div key={label} style={{ background: 'rgba(255, 255, 255, 0.72)', backdropFilter: 'blur(16px)', border: '1.5px solid rgba(255, 255, 255, 0.9)', borderRadius: 14, padding: '10px 14px', boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.95), 0 2px 6px rgba(15, 23, 42, 0.02)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#94a3b8', marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600, overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>{value || '—'}</div>
        </div>)}
      </div>

      {/* Liquid glass AI analysis card */}
      <div style={{ background: 'rgba(255, 255, 255, 0.88)', border: '1.5px solid rgba(255, 255, 255, 0.95)', borderRadius: 18, padding: '18px 20px', lineHeight: 1.6, boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.95), 0 4px 16px rgba(15, 23, 42, 0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0284c7', display: 'inline-block' }} />
          <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI analysis</div>
        </div>
        {final ? <>
          {run.is_stale && <p style={{ color: '#92400e', fontSize: 13, background: 'rgba(254, 243, 199, 0.5)', padding: '8px 12px', borderRadius: 8, margin: '8px 0' }}>This analysis uses an earlier job or applicant snapshot. Refresh recommendations for current analysis.</p>}
          <p style={{ color: '#1e293b', fontSize: 13, margin: '6px 0 12px 0' }}>{assessment.analysis || assessment.reason || 'Analysis unavailable for this result.'}</p>
          {!assessment.analysis && <p style={{ color: '#64748b', fontSize: 13 }}>Detailed analysis unavailable for this saved result. Refresh recommendations to generate it.</p>}
          {assessment.evidence?.length > 0 && <div style={{ background: 'rgba(240, 253, 244, 0.85)', borderLeft: '3px solid #16a34a', borderRadius: 10, padding: '12px 16px', margin: '12px 0' }}>
            <strong style={{ color: '#16a34a', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Supporting evidence</strong>
            {assessment.evidence.map((ref, i) => <p key={i} style={{ margin: '4px 0', color: '#1e293b', fontSize: 12 }}>{ref.field.replaceAll('_', ' ')}: “{ref.quote}”</p>)}
          </div>}
          {assessment.gaps?.length > 0 && <p style={{ fontSize: 13, color: '#b45309', margin: '6px 0' }}>Gaps to verify: {assessment.gaps.join('; ')}</p>}
          {assessment.unknowns?.length > 0 && <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0' }}>Unknown information: {assessment.unknowns.join('; ')}</p>}
          {assessment.requirements?.length > 0 && <ul style={{ margin: '8px 0', paddingLeft: 20 }}>{assessment.requirements.map(item => <li key={item.index} style={{ margin: '4px 0' }}>
            {[...(run.requirements?.mandatory || []), ...(run.requirements?.preferred || [])][item.index]} — {item.status}
            {item.evidence?.map((ref, i) => <p key={i} style={{ margin: '2px 0', color: '#475569' }}>{ref.field.replaceAll('_', ' ')}: “{ref.quote}”</p>)}
          </li>)}</ul>}
        </> : <p style={{ color: '#64748b', fontSize: 13 }}>{running(run?.status) ? 'Analysis pending — final recommendations are being prepared.' : 'AI analysis is unavailable for this search match.'}</p>}
      </div>

      {/* Prominent Action to Open Full Pop-up Panel */}
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onView}
          style={{
            padding: '8px 20px',
            borderRadius: 10,
            border: 'none',
            background: '#0f172a',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.15)',
            transition: 'background 0.15s ease'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#1e293b'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#0f172a'; }}
        >
          <span>Show Details</span>
          <span style={{ fontSize: 13, fontWeight: 800 }}>›</span>
        </button>
      </div>
    </td></tr>}
  </>;
}

export default function CandidateRecommendations({ job, onTagged }) {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState(null);
  const [runId, setRunId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tagging, setTagging] = useState(null);
  const [expandedCandidate, setExpandedCandidate] = useState(null);
  const [detailModalIndex, setDetailModalIndex] = useState(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [headerTarget, setHeaderTarget] = useState(() => typeof document !== 'undefined' ? document.getElementById('ai-drawer-header-actions') : null);

  useEffect(() => {
    if (!headerTarget && typeof document !== 'undefined') {
      const el = document.getElementById('ai-drawer-header-actions');
      if (el) setHeaderTarget(el);
    }
  }, [headerTarget]);

  const load = useCallback(async id => {
    const next = await candidateMatchingService.status(job._uuid, id);
    setSnapshot(next);
    return next;
  }, [job._uuid]);

  useEffect(() => {
    let cancelled = false;
    candidateMatchingService.latest(job._uuid).then(async latest => {
      if (cancelled) return;
      if (latest.runId) { setRunId(latest.runId); await load(latest.runId); }
      else setSnapshot({ coverage: latest.coverage, results: [] });
    }).catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [job._uuid, load]);

  useEffect(() => {
    if (!hasStarted || !runId || !running(snapshot?.run?.status)) return undefined;
    let stopped = false;
    let timer;
    const poll = async () => {
      try { await load(runId); if (!stopped) setError(''); }
      catch (err) { if (!stopped) setError(err.message); }
      if (!stopped) timer = setTimeout(poll, 1000);
    };
    timer = setTimeout(poll, 500);
    return () => { stopped = true; clearTimeout(timer); };
  }, [hasStarted, runId, snapshot?.run?.status, load]);

  async function prepare(refresh = false) {
    setHasStarted(true);
    setBusy(true); setError(''); setExpandedCandidate(null);
    try {
      const result = await candidateMatchingService.prepare(job._uuid, refresh);
      setRunId(result.runId); await load(result.runId);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function tag(result) {
    setTagging(result.applicant_id); setError('');
    try {
      const verified = await candidateMatchingService.verifyTag(job._uuid, runId, result.applicant_id);
      const applicant = verified.applicant || result.applicants;
      const response = await jobService.shortlistCandidate({ applicantId: applicant.applicant_code, name: applicant.full_name,
        jobRole: applicant.current_position, company: applicant.current_company, shortlistedBy: verified.recruiter, jobCode: job.jobCode });
      if (response.error) throw new Error(response.error);
      await load(runId); await onTagged();
    } catch (err) { setError(err.message); }
    finally { setTagging(null); }
  }

  async function retryAssessment() {
    setBusy(true); setError('');
    try {
      await candidateMatchingService.retryAssessment(job._uuid, runId);
      await load(runId);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const run = snapshot?.run;
  const isMatching = hasStarted && (busy || running(run?.status));

  // Sorted candidates descending by relevance score (highest relevance first)
  const sortedResults = [...(snapshot?.results || [])].sort((a, b) => (b.score || 0) - (a.score || 0));

  const refreshButton = (
    <button
      type="button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        padding: '7px 15px',
        background: '#0f172a',
        color: '#ffffff',
        border: '1px solid #0f172a',
        borderRadius: 9999,
        fontFamily: 'inherit',
        fontSize: 12,
        fontWeight: 600,
        boxShadow: '0 2px 6px rgba(15, 23, 42, 0.16)',
        opacity: isMatching ? 0.65 : 1,
        cursor: isMatching ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        whiteSpace: 'nowrap',
      }}
      disabled={isMatching}
      onClick={() => {
        if (!hasStarted) {
          prepare(true);
        } else {
          prepare(Boolean(run));
        }
      }}
      title={hasStarted && run && run.status === 'completed' ? 'Refresh recommendations' : 'Start Matching AI'}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          animation: isMatching ? 'spin 1s linear infinite' : 'none',
        }}
      >
        {isMatching ? icon(FiRefreshCw, 13) : hasStarted && run && run.status === 'completed' ? icon(FiRefreshCw, 13) : icon(FiZap, 13, { color: '#38bdf8' })}
      </span>
      <span>
        {isMatching ? 'Matching in progress…' : hasStarted && run && run.status === 'completed' ? 'Refresh recommendations' : 'Start Matching AI'}
      </span>
    </button>
  );

  return <section style={panel} aria-label="Recommended candidates">
    {/* Portal actions into the top header (next to cut button) */}
    {headerTarget ? createPortal(
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Job Interpretation Notes Top-Right Icon */}
        {Boolean(snapshot?.requirementWarnings?.length) && (
          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            title={`Job interpretation notes (${snapshot.requirementWarnings.length})`}
            aria-label="Job interpretation notes"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 11px',
              background: 'rgba(255, 255, 255, 0.85)',
              border: '1px solid rgba(203, 213, 225, 0.85)',
              borderRadius: 9999,
              color: '#0369a1',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <FiInfo size={14} color="#0284c7" />
            <span style={{
              background: 'rgba(224, 242, 254, 0.95)',
              color: '#0284c7',
              borderRadius: 9999,
              padding: '1px 7px',
              fontSize: 11,
              fontWeight: 700
            }}>
              {snapshot.requirementWarnings.length}
            </span>
          </button>
        )}

        {/* Primary Action Button */}
        {refreshButton}
      </div>,
      headerTarget
    ) : null}

    {/* Header / Title */}
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, flexShrink: 0, borderRadius: '50%', background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', border: '1px solid rgba(186, 230, 253, 0.6)' }}>
          {icon(FiUsers, 17)}
        </span>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
            Recommended candidates
          </h2>
          {/* Documentation directly below heading only when viewing completed results */}
          {hasStarted && (run?.status === 'completed' || run?.completed_at) && !isMatching && (
            <p style={{ margin: '3px 0 0', color: '#64748b', fontSize: 12, fontWeight: 500, lineHeight: 1.4 }}>
              Generated {run.completed_at ? new Date(run.completed_at).toLocaleString() : 'recently'}. Relevance scores reflect requirement evidence, not a hiring probability.
            </p>
          )}
        </div>
      </div>
      {!headerTarget && <div style={{ marginTop: 10 }}>{refreshButton}</div>}
    </div>

    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error} <button style={button} onClick={() => runId ? load(runId).catch(err => setError(err.message)) : prepare()}>Retry</button></p>}

    {run?.status === 'failed' && hasStarted && <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, padding: '14px 18px', margin: '14px 0' }}>
      <p style={{ margin: 0, color: '#991b1b', fontSize: 13 }}>AI recommendations could not finish. {run.last_error || 'Please retry.'}</p>
      {!run.is_stale && run.phase === 'assessment' && (
        <button style={{ ...button, marginTop: 10 }} disabled={busy} onClick={() => retryAssessment()}>Retry AI recommendations</button>
      )}
    </div>}

    {(run?.is_stale || run?.status === 'stale') && hasStarted && <p style={{ color: '#92400e', fontSize: 13, background: 'rgba(254, 243, 199, 0.6)', padding: '8px 12px', borderRadius: 8 }}>Job or applicant information has changed. Refresh recommendations before tagging.</p>}
    {snapshot?.newlyIndexed > 0 && run?.status === 'completed' && hasStarted && <p style={{ color: '#64748b', fontSize: 12 }}>Additional applicant profiles have been indexed since this search. Refresh to include them.</p>}

    {/* ── 1. Initial State Hero Card: Shown FIRST when opening AI panel ── */}
    {!hasStarted && (
      <div style={{
        padding: '48px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        background: 'rgba(255, 255, 255, 0.45)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1.5px solid rgba(255, 255, 255, 0.85)',
        borderRadius: 24,
        boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.95), 0 12px 36px rgba(15, 23, 42, 0.04)',
        margin: '18px 0'
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(14, 165, 233, 0.18) 100%)',
          border: '1px solid rgba(186, 230, 253, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0284c7',
          marginBottom: 16
        }}>
          <FiCpu size={30} />
        </div>
        <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
          Discover Top Candidate Matches with AI
        </h3>
        <p style={{ margin: '8px 0 24px', fontSize: 13, color: '#64748b', maxWidth: 460, lineHeight: 1.5 }}>
          Our neural matching engine analyzes the requirements of <strong>{job.jobTitle}</strong> against candidate profiles, scoring evidence and relevance for instant review.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => {
              setHasStarted(true);
              prepare(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 28px',
              borderRadius: 9999,
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: '#ffffff',
              border: 'none',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 18px rgba(15, 23, 42, 0.28)',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(15, 23, 42, 0.35)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(15, 23, 42, 0.28)'; }}
          >
            <FiZap size={16} color="#38bdf8" />
            <span>Start Matching AI</span>
          </button>

          {Boolean(snapshot?.results?.length) && run?.status === 'completed' && (
            <button
              type="button"
              onClick={() => setHasStarted(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '11px 22px',
                borderRadius: 9999,
                background: 'rgba(255, 255, 255, 0.9)',
                color: '#0f172a',
                border: '1px solid rgba(203, 213, 225, 0.9)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.2s'
              }}
            >
              <span>View Saved Results ({snapshot.results.length})</span>
            </button>
          )}
        </div>
      </div>
    )}

    {/* ── 2. Beautiful AI Loading Animation: Shown only when user clicks Start Matching ── */}
    {isMatching && (
      <div className="ai-matching-loading-card">
        <div className="ai-matching-orb">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z"
              stroke="#ffffff"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            <path
              d="M12 7V17M7 12H17"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
          AI Matching in Progress…
        </h3>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b', maxWidth: 440, lineHeight: 1.5 }}>
          Evaluating candidate profiles, skills, and experience against the requirements of <strong>{job.jobTitle}</strong>.
        </p>

        {/* Shimmering Progress Track */}
        <div className="ai-progress-track">
          <div className="ai-progress-fill" />
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(2, 132, 199, 0.08)',
          border: '1px solid rgba(186, 230, 253, 0.8)',
          color: '#0369a1',
          padding: '6px 14px',
          borderRadius: 9999,
          fontSize: 12,
          fontWeight: 600,
          marginTop: 6
        }}>
          <span style={{ display: 'inline-flex', animation: 'spin 1s linear infinite' }}>
            <FiRefreshCw size={12} />
          </span>
          <span>
            {run?.status === 'extracting'
              ? 'Interpreting job description & requirements…'
              : run?.phase === 'retrieval'
              ? 'Finding relevant applicants in talent pool…'
              : 'Calculating semantic relevance scores & evidence…'}
          </span>
        </div>
      </div>
    )}

    {/* ── 3. Final Sorted Data Table Loaded at Once ── */}
    {hasStarted && !isMatching && run?.status === 'completed' && (
      <>
        {!sortedResults.length ? (
          <p style={{ color: '#64748b', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>
            No sufficiently supported recommendations were found in the indexed pool. Review requirements or use manual applicant search.
          </p>
        ) : (
          <CandidateTable>
            {sortedResults.map((result, idx) => (
              <CandidateRow
                key={result.applicant_id}
                result={result}
                index={idx}
                run={run}
                final
                tagging={tagging}
                expanded={expandedCandidate === result.applicant_id}
                onToggle={() => setExpandedCandidate(expandedCandidate === result.applicant_id ? null : result.applicant_id)}
                onView={() => setDetailModalIndex(idx)}
                onTag={() => tag(result)}
              />
            ))}
          </CandidateTable>
        )}
      </>
    )}

    {/* Right Popup Drawer for Job Interpretation Notes */}
    <JobInterpretationNotesDrawer
      warnings={snapshot?.requirementWarnings}
      open={notesOpen}
      onClose={() => setNotesOpen(false)}
    />

    {/* Pop-up Panel for Candidate Recommendation Detail & Resume Preview */}
    {detailModalIndex !== null && (
      <CandidateRecommendationDetailModal
        isOpen={detailModalIndex !== null}
        currentIndex={detailModalIndex}
        results={sortedResults}
        job={job}
        onClose={() => setDetailModalIndex(null)}
        onNavigate={(newIdx) => setDetailModalIndex(newIdx)}
        onTagCandidate={tag}
        tagging={tagging}
      />
    )}
  </section>;
}
