import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { Window } from 'happy-dom';
import React, { act } from 'react';

test('one-click matching, nonblocking warnings, search visibility, evidence and tagging', async () => {
  const window = new Window({ url: 'http://localhost/' });
  Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import('react-dom/client');
  const { MemoryRouter } = await import('react-router-dom');
  const req = { mandatory: ['Kubernetes'], preferred: ['AWS'], keywords: ['Kubernetes'], conflicts: ['Resolve experience conflict'], min_total_years: null, eligible_locations: [], max_notice_days: null };
  let warnings = ['Description takes precedence over experience field'];
  let status = 'draft', stale = false, tagged = false, findCalls = 0, tagCalls = 0, statusCalls = 0, fail = false, empty = false, noSearchMatches = false, analysis = 'The supplied Kubernetes skills support the role. AWS depth needs verification.';
  const state = () => ({ run: { status, phase: 'assessment', requirements: req, is_stale: stale, completed_at: new Date().toISOString() },
    searchMatches: !noSearchMatches && (status==='running'||status==='failed') ? [{applicant_id:'a1',retrieval_rank:1,applicants:{applicant_code:'APP-1',full_name:'Search Candidate',current_position:'Engineer',skills:'Kubernetes'}}] : [],
    requirementWarnings: warnings, assessed: 1, retrieved: 2, coverage: { total: 100, indexed: 50, pending: 49, failed: 1, insufficient: 0 },
    results: status === 'completed' && !empty ? [{ applicant_id: 'a1', final_rank: 1, score: 67, evidence_coverage: 0.5, alreadyTagged: tagged,
      applicants: { applicant_code: 'APP-1', full_name: 'Sample Candidate', current_position: 'Engineer', total_experience: '6-10', education: 'Bachelor of Engineering', notice_period: 'Immediate' },
      assessment: { reason: 'Direct Kubernetes evidence', analysis, evidence: [{ field: 'skills', quote: 'Kubernetes' }], gaps: [], unknowns: ['AWS depth'] },
    }] : [] });
  globalThis.__matchingFixture = {
    service: {
      latest: async () => ({ runId: 'run1' }),
      status: async () => { statusCalls++; if (fail) throw new Error('Temporary matching failure'); return state(); },
      prepare: async () => { findCalls++; status = 'running'; return { runId: 'run1' }; },
      verifyTag: async () => ({ recruiter: 'Test Recruiter' }),
      retryAssessment: async () => { status='running'; return {runId:'run1'}; },
    },
    jobs: { shortlistCandidate: async () => { tagCalls++; tagged = true; return { success: true }; } },
  };
  const bundled = await build({ entryPoints: ['src/components/admin/CandidateRecommendations.jsx'], bundle: true, write: false,
    format: 'esm', platform: 'node', packages: 'external', jsx: 'automatic', plugins: [{ name: 'fixture-services', setup(builder) {
      builder.onResolve({ filter: /candidateMatchingService\.js$/ }, () => ({ path: 'matching', namespace: 'fixture' }));
      builder.onResolve({ filter: /jobService\.js$/ }, () => ({ path: 'jobs', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'matching'
        ? 'export const candidateMatchingService=globalThis.__matchingFixture.service;'
        : 'export const jobService=globalThis.__matchingFixture.jobs;' }));
    } }] });
  const output = new URL('../../node_modules/.cache/matching-ui-test.mjs', import.meta.url);
  await mkdir(new URL('.', output), { recursive: true }); await writeFile(output, bundled.outputFiles[0].text);
  const Component = (await import(output.href)).default;
  const host = window.document.createElement('div'); window.document.body.append(host);
  const root = createRoot(host);
  const click = async text => {
    const target = [...host.querySelectorAll('button')].find(button => button.textContent.includes(text));
    assert.ok(target, `Button exists: ${text}`); await act(async () => { target.click(); }); return target;
  };
  try {
    await act(async () => { root.render(React.createElement(MemoryRouter, null, React.createElement(Component, { job: { _uuid: 'job1', jobCode: 'JPC-1' }, onTagged: async () => {} }))); });
    assert.equal(host.querySelectorAll('textarea').length,0);
    assert.doesNotMatch(host.textContent,/Review job requirements|Confirm requirements/);
    assert.equal(findCalls,0);
    await click('Find matching candidates');
    assert.equal(findCalls,1);
    assert.doesNotMatch(host.textContent,/Description takes precedence/);
    const callsBeforeNotes = statusCalls;
    const notesToggle = await click('Job interpretation notes');
    assert.equal(notesToggle.getAttribute('aria-expanded'), 'true');
    assert.match(host.textContent,/Description takes precedence/);
    await click('Job interpretation notes');
    assert.doesNotMatch(host.textContent,/Description takes precedence/);
    assert.equal(statusCalls, callsBeforeNotes);
    await click('Job interpretation notes');
    assert.match(host.textContent, /Search complete/);
    assert.match(host.textContent, /Search Candidate/);
    assert.doesNotMatch(host.textContent, /Tag for this job/);
    assert.doesNotMatch(host.textContent, /No sufficiently supported/);
    await act(async()=>host.querySelector('[aria-controls^="candidate-details-"][aria-expanded="false"]').click());
    assert.match(host.textContent,/Analysis pending/);
    await act(async()=>host.querySelector('[aria-controls^="candidate-details-"][aria-expanded="true"]').click());
    status = 'completed';
    // Force a status read through a refresh action rather than waiting for the poll timer.
    globalThis.__matchingFixture.service.prepare = async () => ({ runId: 'run1' });
    // Running disables refresh; use the existing poll once with a short test timer.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 4100)); });
    assert.match(host.textContent, /Sample Candidate/);
    assert.match(host.textContent, /Description takes precedence/); // Polling preserves disclosure state.
    const callsBeforeExpand=statusCalls;
    await act(async()=>host.querySelector('[aria-controls^="candidate-details-"][aria-expanded="false"]').click());
    assert.equal(statusCalls,callsBeforeExpand);
    assert.match(host.textContent, /skills: “Kubernetes”/);
    assert.match(host.textContent, /AWS depth needs verification/);
    assert.match(host.textContent, /Bachelor of Engineering/);
    assert.equal(host.querySelector('[aria-controls^="candidate-details-"][aria-expanded="true"]').getAttribute('aria-controls'),'candidate-details-a1');
    await act(async()=>host.querySelector('[aria-controls^="candidate-details-"][aria-expanded="true"]').click());
    assert.doesNotMatch(host.textContent,/AWS depth needs verification/);
    assert.equal(statusCalls,callsBeforeExpand);
    assert.doesNotMatch(host.textContent, /Evidence \d+%/);
    await click('Tag for this job');
    assert.equal(tagCalls, 1);
    assert.equal([...host.querySelectorAll('button')].find(button => button.textContent.includes('Already tagged')).disabled, true);
    status='failed'; await click('Refresh recommendations');
    assert.match(host.textContent,/Search Candidate/);
    assert.match(host.textContent,/Search matches remain available/);
    await click('Retry AI recommendations');
    assert.match(host.textContent,/Search Candidate/);
    status='completed'; await act(async()=>{await new Promise(resolve=>setTimeout(resolve,1100));});
    stale = true; tagged = false;
    await click('Refresh recommendations');
    assert.match(host.textContent, /Refresh recommendations before tagging/);
    assert.equal([...host.querySelectorAll('button')].find(button => button.textContent.includes('Tag for this job')).disabled, true);
    analysis=undefined; await click('Refresh recommendations');
    await act(async()=>host.querySelector('[aria-controls^="candidate-details-"][aria-expanded="false"]').click());
    assert.match(host.textContent,/Detailed analysis unavailable/);
    assert.match(host.textContent,/Direct Kubernetes evidence/);
    fail = true; await click('Refresh recommendations');
    assert.match(host.querySelector('[role="alert"]').textContent, /Temporary matching failure/);
    assert.doesNotMatch(host.textContent, /No sufficiently supported/);
    fail = false; empty = true; stale = false; await click('Retry');
    assert.match(host.textContent, /No sufficiently supported recommendations/);
    noSearchMatches=true; status='failed'; await click('Refresh recommendations');
    assert.match(host.textContent,/No candidates were retrieved/);
    assert.doesNotMatch(host.textContent,/Search matches remain available/);
    globalThis.__matchingFixture.service.prepare = async () => ({ runId: 'run2' });
    await click('Refresh recommendations');
    assert.doesNotMatch(host.textContent,/Description takes precedence/);
    warnings = [];
    await click('Refresh recommendations');
    assert.doesNotMatch(host.textContent,/Job interpretation notes/);
  } finally { await act(async () => root.unmount()); await window.happyDOM.close(); delete globalThis.__matchingFixture; }
});
