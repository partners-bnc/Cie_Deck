import { createElement, useCallback, useEffect, useId, useState } from 'react';
import { FiUsers, FiSearch, FiRefreshCw, FiDatabase, FiInfo, FiChevronDown } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { candidateMatchingService } from '../../services/candidateMatchingService.js';
import { jobService } from '../../services/jobService.js';

const panel = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, marginBottom: 24, fontFamily: 'inherit', fontSize: 13 };
const button = { padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 };
const cell = { padding: '14px 16px', fontSize: 13, color: '#374151' };
const running = status => ['extracting', 'queued', 'running'].includes(status);
const icon = (component, size = 16, style = {}) => createElement(component, { size, 'aria-hidden': true, focusable: false, style: { flexShrink: 0, ...style } });

export function InterpretationNotes({ warnings }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  if (!warnings?.length) return null;
  return <div style={{ margin: '16px 0', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
    <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 14px', background: '#f8fafc', border: 0, color: '#475569', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, textAlign: 'left', cursor: 'pointer' }}>
      {icon(FiInfo)}<span>Job interpretation notes</span>
      <span style={{ borderRadius: 12, background: '#e2e8f0', padding: '1px 7px', fontSize: 11 }}>{warnings.length}</span>
      {icon(FiChevronDown, 16, { marginLeft: 'auto', transform: expanded ? 'rotate(180deg)' : undefined })}
    </button>
    <div id={id} hidden={!expanded}>
      {expanded && <ul style={{ margin: 0, padding: '12px 18px 12px 32px', borderTop: '1px solid #e2e8f0', color: '#92400e', fontSize: 13, lineHeight: 1.7 }}>
        {warnings.map((warning, i) => <li key={i}>{warning}</li>)}
      </ul>}
    </div>
  </div>;
}

export function CandidateTable({ children }) {
  return <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #e8ecf0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
        <thead><tr style={{ background: '#f9fafb' }}>
          {['Candidate', 'Current role', 'Experience', 'Location', 'Notice', 'Relevance /100', 'Actions', ''].map((label, i) =>
            <th key={i} scope="col" aria-label={label || 'Expand details'} style={{ padding: '13px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{label}</th>)}
        </tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  </div>;
}

export function CandidateRow({ result, expanded, onToggle, onView, onTag, tagging, run, final = false }) {
  const applicant = result.applicants;
  const assessment = result.assessment || {};
  const detailId = `candidate-details-${result.applicant_id}`;
  return <>
    <tr style={{ borderTop: '1px solid #f3f4f6', transition: 'background 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.background = '#fafbff'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
      <td style={cell}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{applicant.full_name || applicant.applicant_code}</div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>#{final ? result.final_rank : result.retrieval_rank} · {applicant.applicant_code}</div>
      </td>
      <td style={{ ...cell, fontSize: 12, maxWidth: 180, lineHeight: 1.4 }}>{applicant.current_position || '—'}</td>
      <td style={{ ...cell, whiteSpace: 'nowrap' }}>{applicant.total_experience || '—'}</td>
      <td style={{ ...cell, fontSize: 12 }}>{applicant.current_location || '—'}</td>
      <td style={{ ...cell, fontSize: 12 }}>{applicant.notice_period || '—'}</td>
      <td style={cell}>{final ? <span aria-label={`Relevance ${result.score} out of 100`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', fontSize: 13, fontWeight: 700,
        color: result.score >= 80 ? '#15803d' : result.score >= 60 ? '#0369a1' : '#b45309', background: result.score >= 80 ? '#dcfce7' : result.score >= 60 ? '#e0f2fe' : '#fef3c7' }}>{result.score}</span>
        : <span style={{ color: '#9ca3af', fontSize: 11 }}>Pending</span>}</td>
      <td style={cell}><div style={{ display: 'flex', gap: 8, whiteSpace: 'nowrap' }}>
        <button style={button} onClick={onView}>View applicant</button>
        {final && <button style={button} disabled={result.alreadyTagged || run.is_stale || Boolean(tagging)} onClick={onTag}>
        {result.alreadyTagged ? 'Already tagged' : tagging === result.applicant_id ? 'Tagging…' : 'Tag for this job'}
        </button>}
      </div></td>
      <td style={cell}><button aria-label={`${expanded ? 'Collapse' : 'Expand'} details for ${applicant.full_name || applicant.applicant_code}`}
        aria-expanded={expanded} aria-controls={detailId} onClick={onToggle}
        style={{ background: 'none', border: 'none', padding: '2px 6px', borderRadius: 6, color: '#6b7280', cursor: 'pointer', fontSize: 18 }}>
        <span aria-hidden="true" style={{ display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>›</span>
      </button></td>
    </tr>
    {expanded && <tr style={{ background: '#f8faff', borderTop: '1px solid #e8f0ff' }}><td colSpan={8} id={detailId} style={{ padding: '20px 24px', borderBottom: '1px solid #e8f0ff' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        {[
          ['Current location', applicant.current_location], ['Education', applicant.education],
          ['Current company', applicant.current_company], ['Current position', applicant.current_position],
          ['Notice period', applicant.notice_period],
        ].map(([label, value]) => <div key={label}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#9ca3af', marginBottom: 3 }}>{label}</div>
          <div style={{ fontSize: 13, color: '#374151', fontWeight: 500, overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>{value || '—'}</div>
        </div>)}
      </div>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, lineHeight: 1.5 }}>
        <div style={{ fontSize: 11, color: '#0b2f5b', fontWeight: 700, textTransform: 'uppercase' }}>AI analysis</div>
        {final ? <>
          {run.is_stale && <p style={{ color: '#92400e', fontSize: 13 }}>This analysis uses an earlier job or applicant snapshot. Refresh recommendations for current analysis.</p>}
          <p style={{ color: '#333', fontSize: 13 }}>{assessment.analysis || assessment.reason || 'Analysis unavailable for this result.'}</p>
          {!assessment.analysis && <p style={{ color: '#64748b', fontSize: 13 }}>Detailed analysis unavailable for this saved result. Refresh recommendations to generate it.</p>}
          {assessment.evidence?.length > 0 && <div style={{ background: '#f0fdf4', borderLeft: '3px solid #16a34a', borderRadius: 8, padding: '10px 14px' }}>
            <strong style={{ color: '#16a34a', fontSize: 11, textTransform: 'uppercase' }}>Supporting evidence</strong>
            {assessment.evidence.map((ref, i) => <p key={i} style={{ margin: '4px 0', color: '#374151', fontSize: 12 }}>{ref.field.replaceAll('_', ' ')}: “{ref.quote}”</p>)}
          </div>}
          {assessment.gaps?.length > 0 && <p style={{ fontSize: 13 }}>Gaps to verify: {assessment.gaps.join('; ')}</p>}
          {assessment.unknowns?.length > 0 && <p style={{ fontSize: 13 }}>Unknown information: {assessment.unknowns.join('; ')}</p>}
          {assessment.requirements?.length > 0 && <ul>{assessment.requirements.map(item => <li key={item.index}>
            {[...(run.requirements?.mandatory || []), ...(run.requirements?.preferred || [])][item.index]} — {item.status}
            {item.evidence?.map((ref, i) => <p key={i}>{ref.field.replaceAll('_', ' ')}: “{ref.quote}”</p>)}
          </li>)}</ul>}
        </> : <p style={{ color: '#64748b', fontSize: 13 }}>{running(run?.status) ? 'Analysis pending — final recommendations are being prepared.' : 'AI analysis is unavailable for this search match.'}</p>}
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
    if (!runId || !running(snapshot?.run?.status)) return undefined;
    let stopped = false;
    let timer;
    const poll = async () => {
      try { await load(runId); if (!stopped) setError(''); }
      catch (err) { if (!stopped) setError(err.message); }
      if (!stopped) timer = setTimeout(poll, 1000);
    };
    timer = setTimeout(poll, 500);
    return () => { stopped = true; clearTimeout(timer); };
  }, [runId, snapshot?.run?.status, load]);

  async function prepare(refresh = false) {
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
  const coverage = snapshot?.coverage;
  return <section style={panel} aria-label="Recommended candidates">
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, flexShrink: 0, borderRadius: 10, background: '#eff6ff', color: '#0b2f5b' }}>{icon(FiUsers, 19)}</span>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0b2f5b', lineHeight: 1.35 }}>Recommended candidates</h2>
      </div>
      <button style={{ ...button, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 14px', background: '#0b2f5b', color: '#fff', borderColor: '#0b2f5b', opacity: busy || running(run?.status) ? 0.6 : 1, cursor: busy || running(run?.status) ? 'not-allowed' : 'pointer' }} disabled={busy || running(run?.status)} onClick={() => prepare(Boolean(run))}>
        {icon(run && !['draft', 'extracting'].includes(run.status) ? FiRefreshCw : FiSearch, 14)}
        {busy ? 'Please wait…' : run && !['draft', 'extracting'].includes(run.status) ? 'Refresh recommendations' : 'Find matching candidates'}
      </button>
    </div>
    {coverage && <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 16px', color: '#64748b', fontSize: 12, lineHeight: 1.6, background: '#f8fafc', borderRadius: 10, padding: '10px 14px', margin: '16px 0' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{icon(FiDatabase, 14)}<span>Search coverage: <strong style={{ color: '#334155', fontWeight: 600 }}>{coverage.indexed.toLocaleString()} / {coverage.total.toLocaleString()}</strong> applicants indexed</span></span>
      <span>{coverage.pending.toLocaleString()} pending · {coverage.failed.toLocaleString()} failed · {coverage.insufficient.toLocaleString()} with insufficient data</span>
    </div>}
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error} <button style={button} onClick={() => runId ? load(runId).catch(err => setError(err.message)) : prepare()}>Retry</button></p>}
    {running(run?.status) && <p role="status">{run.status === 'extracting' ? 'Interpreting job requirements…' : run.phase === 'retrieval' ? 'Finding relevant applicants…' : 'Search complete — preparing final recommendations.'} {run.last_error && run.last_error}</p>}
    {run?.status === 'failed' && <div role="alert"><p>AI recommendations could not finish. {run.last_error} {snapshot?.searchMatches?.length > 0 ? 'Search matches remain available.' : 'No candidates were retrieved. Refresh recommendations to retry.'}</p>
      {!run.is_stale && run.phase === 'assessment' && <button style={button} disabled={busy} onClick={() => retryAssessment()}>Retry AI recommendations</button>}
    </div>}
    {(run?.is_stale || run?.status === 'stale') && <p style={{ color: '#92400e' }}>Job or applicant information has changed. Refresh recommendations before tagging.</p>}
    {snapshot?.newlyIndexed > 0 && run?.status === 'completed' && <p style={{ color: '#64748b' }}>Additional applicant profiles have been indexed since this search. Refresh to include them.</p>}
    {run?.status === 'draft' && <p>Use Find matching candidates to search automatically from this job's description.</p>}
    <InterpretationNotes key={`${job._uuid}-${runId}`} warnings={snapshot?.requirementWarnings} />
    {snapshot?.searchMatches?.length > 0 && (run?.status !== 'completed' || !snapshot.results.length) && <div style={{ marginTop: 16 }}>
      <h3>Search matches</h3><p style={{ color: '#64748b', fontSize: 13 }}>Ranked by semantic and keyword relevance. AI recommendations appear after assessment.</p>
      <CandidateTable>{snapshot.searchMatches.map(result => <CandidateRow
        key={result.applicant_id} result={result} run={run} expanded={expandedCandidate === result.applicant_id}
        onToggle={() => setExpandedCandidate(expandedCandidate === result.applicant_id ? null : result.applicant_id)}
        onView={() => navigate(`/admin/applicants/${encodeURIComponent(result.applicants.applicant_code)}`)} />)}</CandidateTable>
    </div>}
    {run?.status === 'completed' && <>
      <p style={{ color: '#64748b', fontSize: 13 }}>Generated {new Date(run.completed_at).toLocaleString()}. Relevance scores reflect requirement evidence, not a hiring probability.</p>
      {!snapshot.results.length && <p>No sufficiently supported recommendations were found in the indexed pool. Review requirements or use manual applicant search.</p>}
      <CandidateTable>
        {snapshot.results.map(result => <CandidateRow
          key={result.applicant_id} result={result} run={run} final tagging={tagging}
          expanded={expandedCandidate === result.applicant_id}
          onToggle={() => setExpandedCandidate(expandedCandidate === result.applicant_id ? null : result.applicant_id)}
          onView={() => navigate(`/admin/applicants/${encodeURIComponent(result.applicants.applicant_code)}`)}
          onTag={() => tag(result)} />)}
      </CandidateTable>
    </>}
    {!run && !error && <p style={{ color: '#64748b' }}>Find applicants automatically from this job’s description, then review supporting evidence before tagging.</p>}
  </section>;
}
