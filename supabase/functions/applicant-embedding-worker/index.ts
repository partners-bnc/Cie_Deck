import { buildProfile, CONFIG, safeError, validateVector } from '../_shared/matching/core.js';
import { db, diagnostics, embedding, env, json, rpc, tokenizer, workerAuthorized } from '../_shared/matching/runtime.ts';

Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  try {
    if (!await workerAuthorized(request)) return json({ error: 'Worker authorization required' }, 401);
    const client = db();
    const body = await request.json().catch(() => ({}));
    if (body.action === 'preflight') {
      const model = Deno.env.get('GROQ_MODEL');
      const checks = await Promise.all([
        fetch('https://api.openai.com/v1/models/text-embedding-3-large', { headers: { Authorization: `Bearer ${env('OPENAI_API_KEY')}` }, signal: AbortSignal.timeout(15000) }),
        fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${env('GROQ_API_KEY')}` }, signal: AbortSignal.timeout(15000) }),
      ]);
      const groqModels = checks[1].ok ? await checks[1].json() : null;
      return json({ openai_model_access: checks[0].status, groq_model_access: checks[1].status,
        configured_groq_model: model || null, groq_model_available: Boolean(model && groqModels?.data?.some((entry: { id: string }) => entry.id === model)) });
    }
    if (body.action === 'coverage') return json(await rpc(client, 'matching_coverage'));
    if (body.action === 'seed') return json(await rpc(client, 'matching_seed', { p_after: body.after || null, p_limit: 500, p_dry_run: body.enqueue !== true }));
    if (body.action === 'pilot') return json(await rpc(client, 'matching_pilot', { p_dry_run: body.enqueue !== true }));
    if (body.action === 'retry') return json({ retried: await rpc(client, 'matching_retry_failed', { p_kind: body.kind }) });
    if (body.action === 'evaluate') {
      const { data: run, error } = await client.from('job_match_runs').select('query_embedding,requirements').eq('id', body.runId).maybeSingle();
      if (error || !run?.query_embedding || !run.requirements) return json({ error: 'Run with cached query embedding required' }, 400);
      const req = run.requirements;
      const retrieve = async (mode: string, exact: boolean) => (await rpc(client, 'matching_search', {
        p_vector: run.query_embedding, p_keywords: req.keywords, p_min_years: req.min_total_years,
        p_locations: req.eligible_locations || [], p_max_notice_days: req.max_notice_days ?? null, p_exact: exact, p_mode: mode,
      })).slice(0, 20).map((row: { applicant_id: string }) => row.applicant_id);
      const hybrid = await retrieve('hybrid', false), exact = await retrieve('hybrid', true);
      const semantic = await retrieve('semantic', false), keyword = await retrieve('keyword', true);
      const positives = Array.isArray(body.positives) ? body.positives : [];
      const recall = (ids: string[]) => positives.length ? ids.filter(id => positives.includes(id)).length / new Set(positives).size : null;
      return json({ hybrid, semantic, keyword, exact_hybrid: exact,
        approximate_exact_overlap_at_20: exact.length ? hybrid.filter((id: string) => exact.includes(id)).length / exact.length : null,
        known_positive_recall_at_20: { hybrid: recall(hybrid), semantic: recall(semantic), keyword: recall(keyword) },
        note: 'Retrieval metrics only; recruiter usefulness and assessment quality require human review.' });
    }
    if (body.action && body.action !== 'tick') return json({ error: 'Unknown worker action' }, 400);
    const jobs = await rpc(client, 'matching_claim_embeddings', { p_limit: 4, p_pilot_only: body.pilotOnly === true });
    let completed = 0, failed = 0, superseded = 0, inputTokens = 0;
    // Four parallel, individually leased tasks keep invocations within bounded provider timeouts.
    await Promise.all(jobs.map(async (job: Record<string, unknown>) => {
      try {
        const profile = buildProfile(job.source, tokenizer);
        const existing = job.existing_embedding && job.existing_embedding_hash === job.embedding_hash
          ? validateVector(JSON.parse(String(job.existing_embedding))) : null;
        let providerTokens = 0;
        const vector = profile.text ? existing || await embedding(profile.text, tokens => { providerTokens = tokens; inputTokens += tokens; }) : null;
        const saved = await rpc(client, 'matching_finish_embedding', {
          p_applicant: job.applicant_id, p_claim: job.claim_token, p_source_hash: job.source_hash,
          p_profile: profile.text, p_embedding: vector ? JSON.stringify(vector) : null,
          p_embedding_hash: job.embedding_hash, p_attributes: profile.attributes,
          p_shortened: profile.shortened, p_completeness: profile.completeness,
          p_tokens: profile.tokens, p_provider_tokens: providerTokens,
        });
        if (saved) completed++; else superseded++;
      } catch (error) {
        failed++; diagnostics(error);
        await rpc(client, 'matching_fail_embedding', { p_applicant: job.applicant_id, p_claim: job.claim_token, p_error: safeError(error) });
      }
    }));
    return json({ completed, failed, superseded, inputTokens, model: CONFIG.model });
  } catch (error) { diagnostics(error); return json({ error: safeError(error) }, 500); }
});
