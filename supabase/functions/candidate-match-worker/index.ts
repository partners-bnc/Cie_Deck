import { safeError, validateRequirements, validateVector } from '../_shared/matching/core.js';
import { BATCH_INSTRUCTION, BATCH_OUTPUT_TOKENS, MATCHING_VERSION, buildBatchPayload, validateBatch } from '../_shared/matching/batch.js';
import { boundedFields, db, diagnostics, embedding, env, groq, json, DatabaseError, ProviderError, rpc, stageDiagnostic, tokenizer, workerAuthorized } from '../_shared/matching/runtime.ts';

const extractionInstruction = `Extract professional job requirements as JSON with mandatory:string[], preferred:string[], keywords:string[], conflicts:string[], min_total_years:number|null, eligible_locations:string[], max_notice_days:number|null.
Only populate eligible_locations for an explicit mandatory location restriction (exact lowercase location labels); otherwise use []. Only populate max_notice_days when an explicit maximum number of days is stated, otherwise null. Do not exclude unknown applicant values.
Use the detailed job_description as authoritative when it conflicts with structured job fields. Structured fields only fill details absent from the description. Distinguish total and domain experience; a lower domain-experience requirement is not a contradiction with a higher total-experience requirement.
Record short nonblocking warnings in conflicts when choosing the description over a field. If statements WITHIN the description contradict each other, omit the disputed mandatory restriction from mandatory and keywords, leave its min_total_years/eligible_locations/max_notice_days filter unset as appropriate, and record a warning. Keep other clear requirements. Never turn unresolved ambiguity into candidate exclusion.
Do not invent requirements or infer salary units. Keywords should contain up to 30 short meaningful skill/role phrases, including punctuation such as C++ or .NET where relevant.
Use no more than 20 entries in each other list, each <=500 characters. conflicts contains informational warnings, never questions requiring recruiter confirmation.`;

Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  let run: Record<string, unknown> | null = null;
  const invocationStarted = performance.now();
  let stage = 'claim', stageStarted = invocationStarted;
  const client = db();
  try {
    if (!await workerAuthorized(request)) return json({ error: 'Worker authorization required' }, 401);
    const body = await request.json().catch(() => ({}));
    if (body.action === 'health') return json({ ok: true, pipeline: MATCHING_VERSION, groq_model: env('GROQ_MODEL') });
    if (body.action && body.action !== 'tick') return json({ error: 'Unknown worker action' }, 400);
    if (body.runId && !/^[0-9a-f-]{36}$/i.test(body.runId)) return json({ error: 'Invalid run' }, 400);
    run = await rpc(client, 'matching_claim_batch_run', { p_run: body.runId || null });
    if (!run?.id) return json({ processed: 0 });
    if (run.groq_model !== env('GROQ_MODEL') || run.config_version !== MATCHING_VERSION) throw new Error('Run configuration changed');
    const context = await rpc(client, 'matching_run_context', { p_run: run.id });
    if (!context || context.current_job_hash !== run.job_hash) throw new Error('Job changed during matching');
    if (run.phase === 'requirements') {
      const job = { ...boundedFields(context.job, ['job_description'], 5000),
        ...boundedFields(context.job, Object.keys(context.job).filter(key => key !== 'job_description'), 1500) };
      let requirements;
      try { requirements = validateRequirements(await groq(extractionInstruction, job)); }
      catch (error) {
        if (error instanceof ProviderError || error instanceof Error && ['TimeoutError', 'AbortError', 'TypeError'].includes(error.name)) throw error;
        throw new Error('Job requirements could not be interpreted; correct the job description using Edit job and retry');
      }
      const advanced = await rpc(client, 'matching_save_auto_requirements', { p_run: run.id, p_claim: run.claim_token, p_requirements: requirements });
      if (!advanced?.id) throw new Error('Job changed during interpretation');
      run = advanced as Record<string, unknown>;
    }
    const requirements = validateRequirements(run.requirements);
    if (run.phase === 'retrieval') {
      stage = 'query_embedding'; stageStarted = performance.now();
      const { conflicts: _warnings, ...searchRequirements } = requirements;
      const queryText = tokenizer.decode(tokenizer.encode(JSON.stringify(searchRequirements)).slice(0, 7600));
      const vector = run.query_embedding ? validateVector(JSON.parse(String(run.query_embedding))) : await embedding(queryText);
      if (!run.query_embedding) {
        const cached = await rpc(client, 'matching_save_query_embedding', { p_run: run.id, p_claim: run.claim_token, p_vector: JSON.stringify(vector) });
        if (!cached) throw new Error('Run changed while saving query embedding');
      }
      stageDiagnostic(run.id, stage, performance.now() - stageStarted, run.attempts);
      stage = 'retrieval_rpc'; stageStarted = performance.now();
      const started = performance.now();
      const pool = await rpc(client, 'matching_search', {
        p_vector: JSON.stringify(vector), p_keywords: requirements.keywords, p_min_years: requirements.min_total_years,
        p_locations: requirements.eligible_locations, p_max_notice_days: requirements.max_notice_days,
      });
      const retrievalMs = Math.round(performance.now() - started);
      stageDiagnostic(run.id, stage, retrievalMs, run.attempts);
      stage = 'coverage_lookup'; stageStarted = performance.now();
      const coverage = await rpc(client, 'matching_coverage');
      stageDiagnostic(run.id, stage, performance.now() - stageStarted, run.attempts);
      if (coverage.indexed === 0) throw new Error('Applicant index not ready');
      stage = 'save_pool'; stageStarted = performance.now();
      const saved = await rpc(client, 'matching_save_pool', { p_run: run.id, p_claim: run.claim_token, p_vector: JSON.stringify(vector), p_pool: pool, p_coverage: coverage });
      if (!saved) throw new Error('Run changed during retrieval');
      await client.from('job_match_runs').update({ retrieval_ms: retrievalMs }).eq('id', run.id).eq('claim_token', run.claim_token);
      stageDiagnostic(run.id, 'search_matches_available', performance.now() - invocationStarted, run.attempts);
      // Pool is committed and visible before this invocation makes the final AI call.
    }
    stage = 'assessment'; stageStarted = performance.now();
    const candidates = await rpc(client, 'matching_batch_candidates', { p_run: run.id });
    let results = [];
    if (candidates.length) {
      const { conflicts: _warnings, ...rankingRequirements } = requirements;
      const { payload } = buildBatchPayload(candidates, rankingRequirements, tokenizer);
      if (!await rpc(client, 'matching_begin_batch', { p_run: run.id, p_claim: run.claim_token })) throw new Error('Run changed before assessment');
      const output = await groq(BATCH_INSTRUCTION, payload, BATCH_OUTPUT_TOKENS);
      results = validateBatch(output, candidates, payload);
    }
    const poolHashes = candidates.map((candidate: Record<string, unknown>) => ({ applicant_id: candidate.applicant_id, source_hash: candidate.source_hash }));
    const finished = await rpc(client, 'matching_finish_batch', { p_run: run.id, p_claim: run.claim_token, p_pool: poolHashes, p_results: results });
    if (!finished) throw new Error('Sources changed during assessment');
    return json({ processed: 1, phase: 'complete', recommendations: results.length });
  } catch (error) {
    stageDiagnostic(run?.id, stage, performance.now() - stageStarted, run?.attempts, error);
    diagnostics(error);
    const errorMessage = error instanceof DatabaseError && error.code === '57014' && Number(run?.attempts) >= 3
      ? 'Candidate retrieval timed out after three attempts; refresh the search after the database issue is resolved'
      : safeError(error);
    if (run?.id) await rpc(client, 'matching_release_batch_run', {
      p_run: run.id, p_claim: run.claim_token, p_error: errorMessage,
      p_transient: error instanceof ProviderError || error instanceof DatabaseError ? error.transient : error instanceof Error && ['TimeoutError', 'AbortError', 'TypeError'].includes(error.name),
      p_retry_seconds: error instanceof ProviderError ? error.retrySeconds : null,
    });
    return json({ error: errorMessage }, 500);
  }
});
