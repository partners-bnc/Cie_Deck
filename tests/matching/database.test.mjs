import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';

const fixture = `
create schema extensions; create schema auth;
create role anon; create role authenticated; create role service_role bypassrls;
grant usage on schema public,extensions,auth to anon,authenticated,service_role;
create table auth.users(id uuid primary key);
create table public.admin_users(auth_id uuid primary key,is_active boolean);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function public.is_admin() returns boolean language sql security definer set search_path='' as $$select exists(select 1 from public.admin_users where auth_id=auth.uid() and is_active)$$;
create table public.applicants(id uuid primary key default gen_random_uuid(),applicant_code text,full_name text,email text,status text,
  current_position text,skills text,total_experience text,relevant_experience text,education text,certification text,process_knowledge text,cv_summary text,
  current_location text,expected_pay text,notice_period text,work_authorization text);
create table public.client_jobs(id uuid primary key default gen_random_uuid(),job_code text,job_title text,job_description text,experience text,
  location text,state text,country text,pay_rate text,job_mode text,job_type text,status text);
grant select on public.applicants,public.client_jobs to service_role;
`;
const v = JSON.stringify(Array.from({ length: 3072 }, (_, i) => i === 0 ? 1 : 0.01));
const requirements = { mandatory: ['Kubernetes'], preferred: [], keywords: ['Kubernetes'], conflicts: [], min_total_years: null };

test('migration and matching workflow on isolated PostgreSQL with pgvector 0.8.0', async t => {
  const db = new PGlite({ extensions: { vector } });
  const query = async (sql, args = []) => (await db.query(sql, args)).rows;
  const scalar = async (sql, args = []) => Object.values((await query(sql, args))[0])[0];
  const insertApplicant = async (skills = 'Kubernetes C++ .NET', experience = '6-10') => scalar("insert into applicants(applicant_code,skills,current_position,total_experience) values(gen_random_uuid()::text,$1,'Engineer',$2) returning id", [skills, experience]);
  const claim = async () => scalar('select matching_claim_embeddings(8)');
  const finish = async (job, text = 'skills: Kubernetes C++ .NET') => scalar('select matching_finish_embedding($1,$2,$3,$4,$5,$6,$7,false,0.5)',
    [job.applicant_id, job.claim_token, job.source_hash, text, text ? v : null, job.embedding_hash,
      { experience: { min: 6, max: 10 }, location: null, notice_days: null }]);
  try {
    await db.exec(fixture);
    await db.exec(await readFile(new URL('../../supabase/migrations/20261009131701_applicant_matching.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../../supabase/migrations/20261009160809_matching_batch_v2.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../../supabase/migrations/20261009175632_matching_auto_v3.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../../supabase/migrations/20261010145617_matching_retrieval_performance.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../../supabase/migrations/20261010191235_matching_compact_retrieval.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../../supabase/migrations/20261010192151_matching_ranked_retrieval.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../../supabase/migrations/20261010192701_matching_unknown_location_index.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../../supabase/migrations/20261010192920_matching_filtered_semantic.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../../supabase/migrations/20261010193948_matching_gurgaon_semantic_index.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../../supabase/migrations/20261010194254_matching_bounded_location_retrieval.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../../supabase/migrations/20261010194857_matching_ordered_lexical_stage.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../../supabase/migrations/20261010195755_matching_ordered_lexical_switch.sql', import.meta.url), 'utf8'));
    const userId = await scalar('insert into auth.users values(gen_random_uuid()) returning id');
    await db.query('insert into admin_users values($1,true)', [userId]);
    const applicantId = await insertApplicant();
    let jobs;
    await t.test('triggers coalesce changes and stale workers cannot overwrite edits', async () => {
      jobs = await claim(); assert.equal(jobs.length, 1);
      const first = jobs[0];
      await db.query("update applicants set skills='Kubernetes C++ .NET AWS' where id=$1", [applicantId]);
      assert.equal(await finish(first), false);
      jobs = await claim(); assert.equal(jobs.length, 1);
      assert.equal(await finish(jobs[0]), true);
      assert.equal(await scalar('select count(*) from applicant_search_index'), 1);
      assert.equal(await scalar("select status from applicant_embedding_jobs where applicant_id=$1", [applicantId]), 'done');
    });
    await t.test('metadata changes reuse embeddings; viewing and tagging do not enqueue', async () => {
      await db.query("update applicants set status='Tagged',full_name='Display Name' where id=$1", [applicantId]);
      assert.equal((await claim()).length, 0);
      await db.query("update applicants set notice_period='30 days' where id=$1", [applicantId]);
      jobs = await claim();
      assert.equal(jobs[0].embedding_hash, jobs[0].existing_embedding_hash);
      assert.ok(jobs[0].existing_embedding);
      assert.equal(await finish(jobs[0]), true);
    });
    await t.test('delete during processing cascades and cannot resurrect profiles', async () => {
      const id = await insertApplicant('Docker');
      const pending = (await claim())[0];
      await db.query('delete from applicants where id=$1', [id]);
      assert.equal(await finish(pending), false);
      assert.equal(await scalar('select count(*) from applicant_embedding_jobs where applicant_id=$1', [id]), 0);
    });
    await t.test('expired leases recover and retry failures become visible', async () => {
      const id = await insertApplicant('Java');
      const oldClaim = (await claim())[0];
      await db.query("update applicant_embedding_jobs set lease_until=now()-interval '1 minute' where applicant_id=$1", [id]);
      const newClaim = (await claim())[0];
      assert.notEqual(oldClaim.claim_token, newClaim.claim_token);
      assert.equal(await finish(oldClaim), false);
      await db.query('select matching_fail_embedding($1,$2,$3)', [id, newClaim.claim_token, 'Safe provider error']);
      assert.equal((await claim()).length, 0);
      await db.query("update applicant_embedding_jobs set attempts=6,next_retry_at=now() where applicant_id=$1", [id]);
      await claim();
      assert.equal(await scalar('select status from applicant_embedding_jobs where applicant_id=$1', [id]), 'failed');
      await db.query('delete from applicants where id=$1', [id]);
    });
    await t.test('dry-run and keyset seeding do not write applicants or schedule work', async () => {
      const dry = await scalar('select matching_seed(null,500,true)');
      assert.equal(dry.scanned, 1); assert.equal(dry.needs_indexing, 0);
      const after = await scalar('select matching_seed($1,500,true)', [dry.next_cursor]);
      assert.equal(after.scanned, 0);
      assert.equal((await scalar('select matching_reconcile(500)')).scanned, 1);
      assert.equal(await scalar('select after_id from matching_private.reconciliation_cursor'), null);
    });
    await t.test('hybrid search preserves unknowns, skill punctuation and full-vector reranking', async () => {
      const results = await scalar('select matching_search($1,$2,5,true)', [v, ['C++', '.NET']]);
      assert.equal(results.length, 1); assert.ok(results[0].keyword_rank);
      const none = await scalar('select matching_search($1,$2,12,true)', [v, ['Kubernetes']]);
      assert.equal(none.length, 0);
      await db.query('update applicant_search_index set attributes=$1 where applicant_id=$2', [{ experience: { min: null, max: null }, location: null, notice_days: null }, applicantId]);
      assert.equal((await scalar('select matching_search($1,$2,12,true)', [v, ['Kubernetes']])).length, 1);
      assert.equal((await scalar('select matching_search($1,$2,null,true,$3,10)', [v, ['Kubernetes'], ['mumbai']])).length, 1);
      await db.query('update applicant_search_index set attributes=$1 where applicant_id=$2', [{ experience: { min: null, max: null }, location: 'delhi', notice_days: 30 }, applicantId]);
      assert.equal((await scalar('select matching_search($1,$2,null,true,$3,10)', [v, ['Kubernetes'], ['mumbai']])).length, 0);
      await db.query('update applicant_search_index set attributes=$1 where applicant_id=$2', [{ experience: { min: null, max: null }, location: null, notice_days: null }, applicantId]);
      await db.exec('set enable_seqscan=off');
      const plan = await query('explain select applicant_id from applicant_search_index where is_current and embedding is not null order by embedding::extensions.halfvec(3072) OPERATOR(extensions.<=>) $1::extensions.halfvec(3072) limit 20', [v]);
      assert.ok(plan.some(line => line['QUERY PLAN'].includes('applicant_search_hnsw')));
      await db.exec('reset enable_seqscan');
      assert.equal((await scalar('select matching_pilot(true)')).sampled, 1);
    });
    await t.test('punctuation keywords distinguish C++ from C# and .NET from plain NET', async () => {
      await db.exec('begin');
      try {
        const cpp=await insertApplicant('C++'),csharp=await insertApplicant('C#'),dotnet=await insertApplicant('.NET'),net=await insertApplicant('NET');
        let pending;
        while((pending=await claim()).length) for(const item of pending) {
          const text=item.applicant_id===cpp?'skills: C++':item.applicant_id===csharp?'skills: C#':item.applicant_id===dotnet?'skills: .NET':item.applicant_id===net?'skills: NET':'skills: Kubernetes';
          assert.equal(await finish(item,text),true);
        }
        const cppIds=(await scalar("select matching_search($1,array['C++'],null,false,'{}',null,'keyword')",[v])).map(x=>x.applicant_id);
        const dotnetIds=(await scalar("select matching_search($1,array['.NET'],null,false,'{}',null,'keyword')",[v])).map(x=>x.applicant_id);
        assert.ok(cppIds.includes(cpp)&&!cppIds.includes(csharp));
        assert.ok(dotnetIds.includes(dotnet)&&!dotnetIds.includes(net));
      } finally { await db.exec('rollback'); }
    });
    await t.test('keyword evaluation skips semantic execution and semantic evaluation skips keyword results', async () => {
      const seqscan = await scalar("select current_setting('enable_seqscan')");
      await db.exec('begin');
      try {
        await db.exec(`create or replace function public.matching_semantic_pool(p_vector extensions.vector,p_min_years numeric,p_exact boolean,p_locations text[],p_max_notice_days integer)
          returns table(applicant_id uuid,embedding extensions.vector) language plpgsql as $$begin raise exception 'Semantic branch executed'; end$$`);
        const pool=await scalar("select matching_search($1,array['Kubernetes'],null,false,'{}',null,'keyword')",[v]);
        assert.equal(pool.length,1); assert.equal(pool[0].semantic_rank,null);
      } finally { await db.exec('rollback'); }
      const pool=await scalar("select matching_search($1,array['__no_match__'],null,true,'{}',null,'semantic')",[v]);
      assert.equal(pool.length,1); assert.equal(pool[0].keyword_rank,null);
      assert.equal(await scalar("select current_setting('enable_indexscan')"),'on');
      assert.equal(await scalar("select current_setting('enable_seqscan')"),seqscan);
    });
    let run, jobId;
    await t.test('preparation is idempotent; automatic interpretation and assessment resume safely', async () => {
      jobId = await scalar("insert into client_jobs(job_code,job_title,job_description) values('JPC-TEST','Engineer','Kubernetes required') returning id");
      run = await scalar('select to_jsonb(matching_prepare($1,$2,$3,false))', [jobId, userId, 'test-model']);
      assert.equal((await scalar('select to_jsonb(matching_prepare($1,$2,$3,false))', [jobId, userId, 'test-model'])).id, run.id);
      const worker = await scalar('select to_jsonb(matching_claim_batch_run())');
      assert.equal(worker.id, run.id);
      const interpreted = await scalar('select to_jsonb(matching_save_auto_requirements($1,$2,$3))', [run.id, worker.claim_token, {...requirements,conflicts:['Using description over experience field']}]);
      assert.equal(interpreted.status,'running'); assert.equal(interpreted.phase,'retrieval');
      assert.equal(interpreted.confirmed_at,null); assert.equal(interpreted.confirmed_by,null);
      assert.equal(interpreted.claim_token,worker.claim_token);
      const retrieval = interpreted;
      assert.equal(await scalar('select matching_save_query_embedding($1,gen_random_uuid(),$2)', [run.id,v]), false);
      assert.equal(await scalar('select matching_save_query_embedding($1,$2,$3)', [run.id,retrieval.claim_token,v]), true);
      assert.equal(await scalar('select query_embedding::text from job_match_runs where id=$1', [run.id]), v.replaceAll(' ',''));
      const pool = await scalar('select matching_search($1,$2,null,true)', [v, ['Kubernetes']]);
      assert.equal(await scalar('select matching_save_pool($1,$2,$3,$4,$5)', [run.id, retrieval.claim_token, v, pool, { indexed: 1, total: 1 }]), true);
      // Retrieval remains visible before a single batch is finalized.
      assert.equal(await scalar('select count(*) from job_match_results where run_id=$1 and final_rank is null', [run.id]), 1);
      await db.query('select matching_release_batch_run($1,$2)', [run.id, retrieval.claim_token]);
      const assessment = await scalar('select to_jsonb(matching_claim_batch_run())');
      const batch = await scalar('select matching_batch_candidates($1)', [run.id]);
      assert.equal(batch.length, 1);
      assert.equal(await scalar('select matching_begin_batch($1,$2)', [run.id, assessment.claim_token]), 1);
      const hashes=batch.map(x=>({applicant_id:x.applicant_id,source_hash:x.source_hash}));
      const selected=[{applicant_id:applicantId,source_hash:batch[0].source_hash,score:100,assessment:{reason:'Direct skills',evidence:[{field:'skills',quote:'Kubernetes'}],gaps:[],unknowns:[]}}];
      assert.equal(await scalar('select matching_finish_batch($1,$2,$3,$4)',[run.id,assessment.claim_token,hashes,selected]),true);
      assert.equal(await scalar('select matching_finish_batch($1,$2,$3,$4)',[run.id,assessment.claim_token,hashes,selected]),false);
      assert.equal(await scalar('select final_ai_calls from job_match_runs where id=$1',[run.id]),1);
      assert.equal(await scalar('select status from job_match_runs where id=$1', [run.id]), 'completed');
      assert.equal(await scalar('select final_rank from job_match_results where run_id=$1', [run.id]), 1);
      assert.equal((await scalar('select to_jsonb(matching_prepare($1,$2,$3,false))', [jobId, userId, 'test-model'])).id, run.id);
    });
    await t.test('applicant edits mark saved evidence stale; job edits invalidate cached interpretation', async () => {
      await db.query("update applicants set skills='Docker' where id=$1", [applicantId]);
      assert.equal(await scalar('select stale from job_match_results where run_id=$1', [run.id]), true);
      assert.equal(await scalar('select is_stale from job_match_runs where id=$1', [run.id]), true);
      await db.query("update client_jobs set experience='12+' where id=$1", [jobId]);
      assert.equal(await scalar('select status from job_match_runs where id=$1', [run.id]), 'stale');
      const next = await scalar('select to_jsonb(matching_prepare($1,$2,$3,false))', [jobId, userId, 'test-model']);
      assert.equal(next.status, 'extracting'); assert.equal(next.confirmed_at, null);
    });
    await t.test('50-candidate batches finish atomically without assessing omitted candidates', async () => {
      for(let i=0;i<52;i++) await insertApplicant('Kubernetes AWS');
      let pending;
      while((pending=await claim()).length) for(const item of pending) await finish(item,'skills: Kubernetes AWS');
      const batchJob=await scalar("insert into client_jobs(job_title,job_description) values('Engineer','Kubernetes') returning id");
      const prepared=await scalar('select to_jsonb(matching_prepare($1,$2,$3,false))',[batchJob,userId,'test-model']);
      const extraction=await scalar('select to_jsonb(matching_claim_batch_run($1))',[prepared.id]);
      await db.query('select matching_save_auto_requirements($1,$2,$3)',[prepared.id,extraction.claim_token,requirements]);
      const worker=extraction;
      const pool=await scalar('select matching_search($1,$2,null,true)',[v,['Kubernetes']]);
      assert.equal(pool.length,50);
      await db.query('select matching_save_pool($1,$2,$3,$4,$5)',[prepared.id,worker.claim_token,v,pool,{}]);
      const hashes=pool.map(x=>({applicant_id:x.applicant_id,source_hash:x.source_hash}));
      const selected=pool.slice(0,20).map(x=>({...hashes.find(h=>h.applicant_id===x.applicant_id),score:80,assessment:{reason:'Kubernetes',evidence:[{field:'skills',quote:'Kubernetes'}],gaps:[],unknowns:[]}}));
      await assert.rejects(()=>scalar('select matching_finish_batch($1,$2,$3,$4)',[prepared.id,worker.claim_token,hashes,[selected[0],selected[0]]]));
      assert.equal(await scalar('select count(assessment) from job_match_results where run_id=$1',[prepared.id]),0);
      await db.query('select matching_begin_batch($1,$2)',[prepared.id,worker.claim_token]);
      assert.equal(await scalar('select matching_finish_batch($1,$2,$3,$4)',[prepared.id,worker.claim_token,hashes,selected]),true);
      assert.equal(await scalar('select count(final_rank) from job_match_results where run_id=$1',[prepared.id]),20);
      assert.equal(await scalar('select count(*) from job_match_results where run_id=$1 and assessment is null',[prepared.id]),30);
      assert.equal(await scalar('select status from job_match_runs where id=$1',[prepared.id]),'completed');
      assert.equal(await scalar('select to_jsonb(matching_claim_run())'),null);

      const next=await scalar('select to_jsonb(matching_prepare($1,$2,$3,true))',[batchJob,userId,'test-model']);
      const claim2=await scalar('select to_jsonb(matching_claim_batch_run($1))',[next.id]);
      await db.query('select matching_save_pool($1,$2,$3,$4,$5)',[next.id,claim2.claim_token,v,pool,{}]);
      await db.query("update applicants set skills='Changed Kubernetes' where id=$1",[pool[0].applicant_id]);
      assert.equal(await scalar('select matching_finish_batch($1,$2,$3,$4)',[next.id,claim2.claim_token,hashes,selected]),false);
      assert.equal(await scalar('select status from job_match_runs where id=$1',[next.id]),'stale');
    });
    await t.test('empty batches and bounded provider retries preserve completed searches', async () => {
      const batchJob=await scalar("insert into client_jobs(job_title,job_description) values('Engineer','Kubernetes') returning id");
      const prepared=await scalar('select to_jsonb(matching_prepare($1,$2,$3,false))',[batchJob,userId,'test-model']);
      const extraction=await scalar('select to_jsonb(matching_claim_batch_run($1))',[prepared.id]);
      await db.query('select matching_save_auto_requirements($1,$2,$3)',[prepared.id,extraction.claim_token,requirements]);
      const worker=extraction;
      await db.query('select matching_save_pool($1,$2,$3,$4,$5)',[prepared.id,worker.claim_token,v,[],{}]);
      assert.equal(await scalar('select matching_finish_batch($1,$2,$3,$4)',[prepared.id,worker.claim_token,[],[]]),true);
      assert.equal(await scalar('select final_ai_calls from job_match_runs where id=$1',[prepared.id]),0);
      const next=await scalar('select to_jsonb(matching_prepare($1,$2,$3,true))',[batchJob,userId,'test-model']);
      let claimed=await scalar('select to_jsonb(matching_claim_batch_run($1))',[next.id]);
      await db.query('select matching_save_pool($1,$2,$3,$4,$5)',[next.id,claimed.claim_token,v,[],{}]);
      for(let i=0;i<3;i++){
        assert.equal(await scalar('select matching_begin_batch($1,$2)',[next.id,claimed.claim_token]),i+1);
        await db.query('select matching_release_batch_run($1,$2,$3,$4,true)',[next.id,claimed.claim_token,'Rate limit',120]);
        assert.ok(await scalar("select next_retry_at>now()+interval '100 seconds' from job_match_runs where id=$1",[next.id]));
        await db.query('update job_match_runs set next_retry_at=now() where id=$1',[next.id]);
        if(i<2) claimed=await scalar('select to_jsonb(matching_claim_batch_run($1))',[next.id]);
      }
      assert.equal(await scalar('select status from job_match_runs where id=$1',[next.id]),'failed');
      assert.equal(await scalar('select to_jsonb(matching_claim_batch_run($1))',[next.id]),null);
      await db.query('select matching_retry_batch($1)',[next.id]);
      assert.equal(await scalar('select final_ai_calls from job_match_runs where id=$1',[next.id]),0);
    });
    await t.test('legacy drafts are superseded without reusing reviewed requirements or HR confirmation', async () => {
      const job=await scalar("insert into client_jobs(job_title,job_description,experience) values('Engineer','Kubernetes, ten years total','5') returning id");
      const old=await scalar("insert into job_match_runs(client_job_id,job_hash,groq_model,requested_by,status,phase,config_version,requirements) select id,matching_private.job_hash(j),'test-model',$2,'draft','requirements','matching-batch-v2',$3 from client_jobs j where id=$1 returning id",[job,userId,{...requirements,min_total_years:5}]);
      const next=await scalar('select to_jsonb(matching_prepare($1,$2,$3,false))',[job,userId,'test-model']);
      assert.notEqual(next.id,old);assert.equal(next.phase,'requirements');assert.equal(next.requirements,null);assert.equal(next.confirmed_at,null);
      assert.equal(await scalar('select status from job_match_runs where id=$1',[old]),'stale');
      assert.equal((await scalar('select to_jsonb(matching_prepare($1,$2,$3,false))',[job,userId,'test-model'])).id,next.id);
    });
    await t.test('retrieval timeout retries preserve vectors and stop after three claims', async () => {
      const j = await scalar("insert into client_jobs(job_title) values('Retry fixture') returning id");
      const r = await scalar('select to_jsonb(matching_prepare($1,$2,$3,false))', [j,userId,'test-model']);
      let c = await scalar('select to_jsonb(matching_claim_batch_run($1))', [r.id]);
      await scalar('select matching_save_auto_requirements($1,$2,$3)', [r.id,c.claim_token,requirements]);
      await scalar('select matching_save_query_embedding($1,$2,$3)', [r.id,c.claim_token,v]);
      assert.equal(await scalar('select attempts from job_match_runs where id=$1',[r.id]),1);
      for (let attempt=1;attempt<=3;attempt++) {
        assert.equal(c.query_embedding || await scalar('select query_embedding::text from job_match_runs where id=$1',[r.id]),v);
        await scalar('select matching_release_batch_run($1,$2,$3,null,true)', [r.id,c.claim_token,'Candidate retrieval timeout']);
        assert.equal(await scalar('select status from job_match_runs where id=$1',[r.id]),attempt===3?'failed':'running');
        assert.equal(await scalar('select next_retry_at>now() from job_match_runs where id=$1',[r.id]),true);
        await db.query('update job_match_runs set next_retry_at=now() where id=$1',[r.id]);
        c=await scalar('select to_jsonb(matching_claim_batch_run($1))',[r.id]);
      }
      assert.equal(c,null);
      assert.equal(await scalar('select final_ai_calls from job_match_runs where id=$1',[r.id]),0);
    });
    await t.test('projection invalidation is atomic and keyword ranks equal the original exact scoring', async () => {
      await db.exec('begin');
      try {
        const truth=await query("select applicant_id from applicant_search_index where is_current and embedding is not null and keywords@@plainto_tsquery('simple','Kubernetes') order by ts_rank_cd(keywords,plainto_tsquery('simple','Kubernetes')) desc,applicant_id limit 50");
        const pool=await scalar("select matching_search($1,array['Kubernetes'],null,false,'{}',null,'keyword')",[v]);
        assert.deepEqual(pool.map(x=>x.applicant_id),truth.map(x=>x.applicant_id));
        assert.deepEqual(pool.map(x=>x.keyword_rank),pool.map((_,i)=>i+1));
        assert.equal(await scalar('select count(*) from matching_private.applicant_lexical l join applicant_search_index i using(applicant_id) where l.keywords is distinct from i.keywords'),0);
        const id=truth[0].applicant_id;
        await db.query("update applicants set notice_period='45 days' where id=$1",[id]);
        assert.equal(await scalar('select count(*) from matching_private.applicant_lexical where applicant_id=$1',[id]),0);
        await db.query('delete from applicants where id=$1',[id]);
        assert.equal(await scalar('select count(*) from matching_private.applicant_lexical where applicant_id=$1',[id]),0);
      } finally { await db.exec('rollback'); }
    });
    await t.test('ordered switch rejects incomplete copies and removes rows invalidated during copying', async () => {
      await db.exec('begin');
      try {
        await db.exec(`alter table matching_private.applicant_lexical_unordered rename to lexical_test_empty_backup;
          alter index matching_private.applicant_lexical_ordered_pkey rename to lexical_test_existing_pkey;
          alter index matching_private.applicant_lexical_ordered_keywords rename to lexical_test_existing_keywords;
          alter index matching_private.applicant_lexical_ordered_location rename to lexical_test_existing_location`);
        await db.exec(await readFile(new URL('../../supabase/migrations/20261010194857_matching_ordered_lexical_stage.sql', import.meta.url),'utf8'));
        await db.exec(await readFile(new URL('../../supabase/operations/backfill_matching_ordered_lexical.sql',import.meta.url),'utf8'));
        const copied=await scalar('select pg_temp.backfill_ordered_lexical()');
        assert.ok(copied.scanned>0&&copied.scanned<4000);
        const id=await scalar('select applicant_id from matching_private.applicant_lexical order by applicant_id limit 1');
        await db.query('delete from matching_private.applicant_lexical_ordered where applicant_id=$1',[id]);
        await db.exec('savepoint before_switch');
        const switchSql=await readFile(new URL('../../supabase/migrations/20261010195755_matching_ordered_lexical_switch.sql',import.meta.url),'utf8');
        await assert.rejects(db.exec(switchSql),/backfill is incomplete/);
        await db.exec('rollback to savepoint before_switch');
        assert.ok((await scalar("select matching_search($1,array['Kubernetes'],null,false,'{}',null,'keyword')",[v])).length>0);
        await scalar('select pg_temp.backfill_ordered_lexical()');
        await db.query("update applicants set skills='Changed during copy' where id=$1",[id]);
        // A copied snapshot can arrive after invalidation; the final switch must
        // discard it instead of making an out-of-date applicant searchable.
        await db.query(`insert into matching_private.applicant_lexical_ordered(applicant_id,keywords,max_years,location,notice_days)
          select applicant_id,keywords,(attributes#>>'{experience,max}')::numeric,lower(attributes->>'location'),(attributes->>'notice_days')::integer
          from applicant_search_index where applicant_id=$1`,[id]);
        await db.exec(switchSql);
        assert.equal(await scalar('select count(*) from matching_private.applicant_lexical where applicant_id=$1',[id]),0);
        assert.ok((await scalar("select matching_search($1,array['Kubernetes'],null,false,'{}',null,'keyword')",[v])).every(x=>x.applicant_id!==id));
      } finally { await db.exec('rollback'); }
    });
    await t.test('metadata refresh never writes vector or keyword columns and preserves token accounting', async () => {
      await db.exec('begin');
      try {
        const id=await insertApplicant('Kubernetes');
        const pending=(await claim()).find(x=>x.applicant_id===id);
        assert.equal(await finish(pending),true);
        await db.exec(`create function pg_temp.reject_vector_write() returns trigger language plpgsql as $$begin raise exception 'Unexpected vector or keyword rewrite'; end$$;
          create trigger reject_vector_write before update of embedding,keywords on applicant_search_index for each row execute function pg_temp.reject_vector_write()`);
        await db.query("update applicants set notice_period='30 days' where id=$1",[id]);
        const refresh=(await claim()).find(x=>x.applicant_id===id);
        assert.equal(await scalar('select matching_finish_embedding($1,$2,$3,$4,$5,$6,$7,false,0.5,9,17)',
          [id,refresh.claim_token,refresh.source_hash,'skills: Kubernetes C++ .NET',v,refresh.embedding_hash,{experience:{min:6,max:10},location:'gurgaon',notice_days:30}]),true);
        assert.equal(await scalar('select embedding_input_tokens_total from applicant_search_index where applicant_id=$1',[id]),17);
        assert.deepEqual((await query('select location,notice_days from matching_private.applicant_lexical where applicant_id=$1',[id]))[0],{location:'gurgaon',notice_days:30});
      } finally { await db.exec('rollback'); }
    });
    await t.test('split location retrieval keeps unknowns and applies experience and notice to both groups', async () => {
      await db.exec('begin');
      try {
        const ids=(await query('select applicant_id from applicant_search_index where is_current and embedding is not null order by applicant_id limit 3')).map(x=>x.applicant_id);
        await db.query("update applicant_search_index set attributes=jsonb_build_object('location','gurgaon','experience',jsonb_build_object('max',10),'notice_days',0) where applicant_id=$1",[ids[0]]);
        await db.query("update applicant_search_index set attributes=jsonb_build_object('location','jeddah','experience',jsonb_build_object('max',10),'notice_days',0) where applicant_id=$1",[ids[1]]);
        await db.query("update applicant_search_index set attributes=jsonb_build_object('location','gurgaon','experience',jsonb_build_object('max',10),'notice_days',30) where applicant_id=$1",[ids[2]]);
        const pool=await query("select applicant_id from matching_semantic_pool($1,10,false,array['gurgaon'],0)",[v]);
        const truth=await query("select applicant_id from applicant_search_index where is_current and embedding is not null and (attributes->>'location' is null or lower(attributes->>'location')='gurgaon') and (attributes#>>'{experience,max}' is null or (attributes#>>'{experience,max}')::numeric>=10) and (attributes->>'notice_days' is null or (attributes->>'notice_days')::integer<=0)");
        assert.deepEqual(pool.map(x=>x.applicant_id).sort(),truth.map(x=>x.applicant_id).sort());
        assert.ok(pool.some(x=>x.applicant_id===ids[0]));
        assert.ok(!pool.some(x=>x.applicant_id===ids[1]||x.applicant_id===ids[2]));
        assert.equal(new Set(pool.map(x=>x.applicant_id)).size,pool.length);
      } finally { await db.exec('rollback'); }
    });
    await t.test('coverage snapshots retain the response shape and refresh after expiry', async () => {
      await db.exec('begin');
      try {
        await db.exec('delete from matching_private.coverage_cache');
        const before=await scalar('select matching_coverage()');
        assert.deepEqual(Object.keys(before).sort(),['total','indexed','insufficient','pending','failed','embedding_input_tokens'].sort());
        await insertApplicant('Coverage fixture');
        assert.deepEqual(await scalar('select matching_coverage()'),before);
        await db.exec("update matching_private.coverage_cache set refreshed_at=clock_timestamp()-interval '61 seconds'");
        assert.equal((await scalar('select matching_coverage()')).total,before.total+1);
      } finally { await db.exec('rollback'); }
    });
    await t.test('browser roles cannot write index data or call privileged RPCs; results require active admin', async () => {
      assert.equal(await scalar("select has_table_privilege('authenticated','matching_private.applicant_lexical','select')"),false);
      assert.equal(await scalar("select has_function_privilege('authenticated','matching_private.sync_lexical()','execute')"),false);
      assert.equal(await scalar("select has_function_privilege('anon','public.matching_claim_batch_run(uuid)','execute')"), false);
      assert.equal(await scalar("select has_function_privilege('authenticated','public.matching_save_query_embedding(uuid,uuid,extensions.vector)','execute')"), false);
      assert.equal(await scalar("select has_function_privilege('anon','public.matching_save_auto_requirements(uuid,uuid,jsonb)','execute')"), false);
      assert.equal(await scalar("select has_function_privilege('authenticated','public.matching_save_auto_requirements(uuid,uuid,jsonb)','execute')"), false);
      assert.equal(await scalar("select has_function_privilege('authenticated','public.matching_seed(uuid,integer,boolean)','execute')"), false);
      assert.equal(await scalar("select has_table_privilege('authenticated','public.applicant_search_index','insert')"), false);
      await db.exec('set role authenticated');
      assert.equal(await scalar('select count(*) from job_match_runs'), 0);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userId]);
      assert.ok(await scalar('select count(*) from job_match_runs') > 0);
      await db.exec('reset role');
      await db.query('update admin_users set is_active=false where auth_id=$1', [userId]);
      await db.exec('set role authenticated');
      assert.equal(await scalar('select count(*) from job_match_runs'), 0);
      await db.exec('reset role');
    });
  } finally { await db.close(); }
});


