import { CONFIG, safeError } from '../_shared/matching/core.js';
import { ASSESSMENT_MODEL, MATCHING_VERSION } from '../_shared/matching/batch.js';
import { authenticate, db, diagnostics, env, HttpError, json, rpc } from '../_shared/matching/runtime.ts';

const RUN_COLUMNS = 'id,client_job_id,job_hash,requirements,confirmed_at,status,phase,coverage,is_stale,last_error,created_at,completed_at,config_version,final_ai_calls,retrieval_ms';
const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function wakeWorker(runId: string) {
  // An optional immediate tick; cron remains responsible for durable continuation.
  const work = fetch(`${env('SUPABASE_URL')}/functions/v1/candidate-match-worker`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-match-worker-secret': env('MATCH_WORKER_SECRET') },
    body: JSON.stringify({ action: 'tick', runId }), signal: AbortSignal.timeout(60000),
  }).then(response => { if (!response.ok) console.error(`Matching worker HTTP ${response.status}`); }).catch(diagnostics);
  const runtime = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (work: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime) runtime.waitUntil(work);
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return json({});
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  try {
    const client = db();
    const admin = await authenticate(request, client);
    const raw = await request.text();
    if (raw.length > 30000) throw new HttpError(400, 'Request too large');
    let body;
    try { body = JSON.parse(raw); } catch { throw new HttpError(400, 'Invalid request'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Invalid request');
    if (!uuid(body.jobId)) throw new HttpError(400, 'A client job UUID is required');
    const { data: job, error: jobError } = await client.from('client_jobs').select('id,job_code,job_title,job_description').eq('id', body.jobId).maybeSingle();
    if (jobError) throw new Error('Job lookup failed');
    if (!job) throw new HttpError(404, 'Job not found');
    if (body.action === 'prepare') {
      if (!String(job.job_description || '').trim()) throw new HttpError(400, 'Add a meaningful job description using Edit job before matching');
      const prepared = await rpc(client, 'matching_prepare', { p_job: job.id, p_requester: admin.id, p_model: ASSESSMENT_MODEL, p_refresh: body.refresh === true });
      if (prepared.status === 'extracting' || prepared.status === 'queued') wakeWorker(prepared.id);
      return json({ runId: prepared.id });
    }
    if (body.action === 'latest') {
      const { data, error } = await client.from('job_match_runs').select('id').eq('client_job_id', job.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error('Run lookup failed');
      return json({ runId: data?.id || null, coverage: await rpc(client, 'matching_coverage') });
    }
    if (!uuid(body.runId)) throw new HttpError(400, 'A matching run UUID is required');
    const { data: run, error } = await client.from('job_match_runs').select(RUN_COLUMNS).eq('id', body.runId).eq('client_job_id', job.id).maybeSingle();
    if (error) throw new Error('Run lookup failed');
    if (!run) throw new HttpError(404, 'Matching run not found');
    if (body.action === 'start') {
      throw new HttpError(409, 'Requirement review has been removed. Reload the app and use Find matching candidates.');
    }
    if (body.action === 'retry-assessment') {
      const retried = await rpc(client, 'matching_retry_batch', { p_run: run.id });
      wakeWorker(retried.id);
      return json({ runId: retried.id });
    }
    if (body.action === 'review-requirements') {
      throw new HttpError(409, 'Requirement review has been removed. Reload the app and use Edit job to correct the description.');
    }
    if (body.action === 'status') {
      const { data: results, error: resultError } = await client.from('job_match_results')
        .select('applicant_id,source_hash,retrieval,assessment,score,evidence_coverage,final_rank,stale,applicants!inner(id,applicant_code,full_name,current_position,current_company,total_experience,skills,current_location,education,notice_period)')
        .eq('run_id', run.id);
      if (resultError) throw new Error('Result lookup failed');
      // The applicant foreign key cascades deletions; this result lookup already
      // contains the same rows as the two former exact-count requests.
      const retrieved = results?.length || 0;
      const assessed = (results || []).filter(result => result.assessment != null).length;
      const { data: tags, error: tagsError } = await client.from('tagged_candidates').select('applicant_id').eq('job_code', job.job_code);
      if (tagsError) throw new Error('Progress lookup failed');
      const tagged = new Set((tags || []).map(tag => tag.applicant_id));
      const current = (results || []).filter(result => !result.stale).map(result => ({ ...result, alreadyTagged: tagged.has(result.applicant_id) }));
      const searchMatches = [...current].sort((a, b) => Number(b.retrieval?.rrf || 0) - Number(a.retrieval?.rrf || 0) || a.applicant_id.localeCompare(b.applicant_id))
        .slice(0, 50).map((result, i) => ({ applicant_id: result.applicant_id, applicants: result.applicants, retrieval_rank: i + 1, alreadyTagged: result.alreadyTagged }));
      const completeScores = current.filter(result => result.final_rank !== null && Number.isInteger(result.score) && result.score >= 0 && result.score <= 100 && result.assessment?.analysis?.trim()).length;
      const assessmentStatus = run.is_stale || run.status === 'stale' ? 'stale' : run.status === 'completed' ? (run.config_version === MATCHING_VERSION && completeScores !== retrieved ? 'failed' : 'completed')
        : run.status === 'failed' ? 'failed' : current.length || run.phase === 'assessment' ? 'pending' : 'not_started';
      // This reminder is only shown for completed runs. Avoid scanning the index
      // every second while retrieval and ranking need the database's cache.
      let newlyIndexed = 0;
      if (run.status === 'completed') {
        const { count, error: newError } = await client.from('applicant_search_index').select('applicant_id', { count: 'exact', head: true }).eq('is_current', true).gt('indexed_at', run.created_at);
        if (newError) throw new Error('Coverage lookup failed');
        newlyIndexed = count || 0;
      }
      return json({ run, assessed, retrieved, newlyIndexed, coverage: await rpc(client, 'matching_coverage'),
        searchMatches, assessmentStatus, requirementWarnings: run.requirements?.conflicts || [],
        results: current.filter(result => result.final_rank !== null).sort((a, b) => a.final_rank - b.final_rank),
        config: CONFIG.version, pipeline: MATCHING_VERSION });
    }
    if (body.action === 'verify-tag') {
      if (!uuid(body.applicantId)) throw new HttpError(400, 'Applicant UUID required');
      const { data: result, error: resultError } = await client.from('job_match_results').select('stale,final_rank').eq('run_id', run.id).eq('applicant_id', body.applicantId).maybeSingle();
      if (resultError) throw new Error('Result lookup failed');
      if (run.status !== 'completed' || run.is_stale || !result?.final_rank || result.stale) throw new HttpError(409, 'Refresh recommendations before tagging');
      const { data: applicant, error: applicantError } = await client.from('applicants').select('applicant_code,full_name,current_position,current_company,status').eq('id', body.applicantId).maybeSingle();
      if (applicantError) throw new Error('Applicant lookup failed');
      if (!applicant?.applicant_code) throw new HttpError(409, 'Applicant is no longer available for tagging');
      return json({ allowed: true, recruiter: admin.name, applicant });
    }
    throw new HttpError(400, 'Unknown matching action');
  } catch (error) {
    diagnostics(error);
    return json({ error: error instanceof HttpError ? error.message : safeError(error) }, error instanceof HttpError ? error.status : 500);
  }
});
