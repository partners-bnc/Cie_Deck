// Development-only fixture. All matching/tagging calls are stubbed; no production writes or provider calls.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import CandidateRecommendations from '../../src/components/admin/CandidateRecommendations.jsx';
import { candidateMatchingService } from '../../src/services/candidateMatchingService.js';
import { jobService } from '../../src/services/jobService.js';

const job = { _uuid: '11111111-1111-4111-8111-111111111111', jobCode: 'JPC-FIXTURE' };
const coverage = { indexed: 500, total: 88361, pending: 15, failed: 2, insufficient: 3 };
let stage = null, tagged = false, fail = false, empty = false, stale = false, readyAt = 0;
let confirmed = { mandatory: ['Kubernetes'], preferred: ['AWS'], keywords: ['Kubernetes', 'AWS'], conflicts: ['Using job description over conflicting experience field'], min_total_years: null, eligible_locations: [], max_notice_days: null };
candidateMatchingService.latest = async () => ({ runId: null, coverage });
candidateMatchingService.prepare = async () => { stage = 'running'; readyAt = Date.now() + 1200; stale = false; return { runId: 'fixture-run' }; };
candidateMatchingService.status = async () => {
  if (fail) throw new Error('Fixture provider unavailable. Please retry.');
  if (stage === 'running' && Date.now() >= readyAt) stage = 'completed';
  return { coverage, requirementWarnings: ['Using job description over conflicting experience field'], searchMatches: stage==='running' ? [{applicant_id:'22222222-2222-4222-8222-222222222222',retrieval_rank:1,applicants:{applicant_code:'APP-FIXTURE',full_name:'Sample Candidate',current_position:'Platform Engineer',skills:'Kubernetes AWS',total_experience:'6-10'}}] : [], assessed: stage === 'completed' ? 2 : 0, retrieved: 2, newlyIndexed: 0,
    run: { id: 'fixture-run', status: stage, phase: stage === 'draft' ? 'requirements' : 'assessment', is_stale: stale,
      requirements: confirmed, created_at: new Date().toISOString(), completed_at: new Date().toISOString() },
    results: stage === 'completed' && !empty ? [{ applicant_id: '22222222-2222-4222-8222-222222222222', final_rank: 1,
      score: 67, evidence_coverage: 0.5, alreadyTagged: tagged,
      applicants: { applicant_code: 'APP-FIXTURE', full_name: 'Sample Candidate', current_position: 'Platform Engineer', total_experience: '6-10', current_location: 'Bengaluru', education: 'Bachelor of Engineering', current_company: 'Example Systems', notice_period: 'Immediate' },
      assessment: { reason: 'Recorded Kubernetes experience', analysis: 'The supplied profile records Kubernetes experience that supports the platform engineering requirement. AWS is listed, although the depth of that experience is unknown and should be verified.', evidence: [{field:'skills',quote:'Kubernetes'}], gaps: [], unknowns: ['AWS depth'] },
    }] : [] };
};
candidateMatchingService.verifyTag = async () => ({ allowed: !stale, recruiter: 'Fixture Recruiter' });
jobService.shortlistCandidate = async () => { tagged = true; return { success: true }; };

function Fixture() {
  const [revision, setRevision] = React.useState(0);
  return <BrowserRouter><main style={{ fontFamily: 'Arial,sans-serif', background: '#f8fafc', padding: 24, maxWidth: 1100, margin: 'auto' }}>
    <h1>Matching UI test fixture</h1><p>Fictional data. Matching and tagging are simulated.</p>
    <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
      <button onClick={() => { fail = true; }}>Simulate server failure</button>
      <button onClick={() => { fail = false; stale = true; }}>Simulate applicant edit</button>
      <button onClick={() => { fail = false; empty = true; }}>Simulate no matches</button>
      <button onClick={() => { fail = false; empty = false; tagged = false; stale = false; stage = null; setRevision(revision + 1); }}>Reset fixture</button>
    </div>
    <CandidateRecommendations key={revision} job={job} onTagged={async () => {}} />
  </main></BrowserRouter>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
