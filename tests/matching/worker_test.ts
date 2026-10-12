import { MATCHING_VERSION, BATCH_OUTPUT_TOKENS } from '../../supabase/functions/_shared/matching/batch.js';
function assert(value: unknown, message = 'Assertion failed'): asserts value { if (!value) throw new Error(message); }

Deno.test('retrieval commits before one final provider request for all 50 candidates', async () => {
  const originalFetch = globalThis.fetch;
  const originalServe = Deno.serve;
  let handler: (request: Request) => Promise<Response>;
  const events: string[] = [];
  let calls = 0;
  const vector = JSON.stringify(Array.from({ length: 3072 }, (_, i) => i ? 0.01 : 1));
  const candidates = Array.from({ length: 50 }, (_, i) => ({ applicant_id: `id-${i}`, source_hash: `hash-${i}`,
    source: { current_position: 'Engineer', skills: 'Kubernetes AWS', total_experience: '5' } }));
  const requirements = { mandatory: ['Kubernetes'], preferred: [], keywords: ['Kubernetes'], conflicts: [] };
  const run = { id: '11111111-1111-4111-8111-111111111111', claim_token: 'claim', config_version: MATCHING_VERSION,
    groq_model: 'qwen/qwen3.8-27b', job_hash: 'job-hash', phase: 'retrieval', requirements, query_embedding: vector };
  Deno.env.set('SUPABASE_URL', 'https://fixture.supabase.co'); Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'fixture');
  Deno.env.set('MATCH_WORKER_SECRET', 'a'.repeat(64)); Deno.env.set('GROQ_API_KEY', 'fixture'); Deno.env.set('GROQ_MODEL', run.groq_model);
  try {
    Deno.serve = ((fn: typeof handler) => { handler = fn; return {} as Deno.HttpServer; }) as typeof Deno.serve;
    globalThis.fetch = async (input, init) => {
      const url = String(input); const operation = new URL(url).pathname.split('/').at(-1)!;
      if (url.includes('api.groq.com')) {
        calls++; events.push('provider');
        const sent = JSON.parse(String(init?.body));
        const payload = JSON.parse(sent.messages[1].content);
        assert(payload.candidates.length === 50); assert(sent.max_completion_tokens === BATCH_OUTPUT_TOKENS);
        return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ recommendations: [
          { candidate: 1, score: 80, reason: 'Direct Kubernetes evidence', evidence: [{ field: 1, quote: 'Kubernetes' }], gaps: [], unknowns: [], analysis: 'The supplied skills support the Kubernetes requirement. The profile records five years of experience.' },
        ] }) } }] });
      }
      events.push(operation);
      if (operation === 'matching_claim_batch_run') return Response.json(run);
      if (operation === 'matching_run_context') return Response.json({ current_job_hash: run.job_hash });
      if (operation === 'matching_search') return Response.json(candidates.map(c => ({ applicant_id: c.applicant_id, source_hash: c.source_hash })));
      if (operation === 'matching_coverage') return Response.json({ indexed: 491 });
      if (operation === 'matching_batch_candidates') return Response.json(candidates);
      if (operation === 'matching_finish_batch') {
        const sent = JSON.parse(String(init?.body)); assert(sent.p_results.length === 1); assert(sent.p_pool.length === 50);
        assert(sent.p_results[0].assessment.analysis.includes('Kubernetes'));
      }
      return Response.json(true);
    };
    await import('../../supabase/functions/candidate-match-worker/index.ts');
    const response = await handler!(new Request('http://localhost', { method: 'POST', headers: { 'x-match-worker-secret': 'a'.repeat(64) }, body: '{}' }));
    assert(response.status === 200); assert(calls === 1);
    assert(events.indexOf('matching_save_pool') < events.indexOf('provider'));
    assert(events.includes('matching_finish_batch'));
  } finally { globalThis.fetch = originalFetch; Deno.serve = originalServe; }
});

Deno.test('automatic interpretation continues through retrieval and one batch with nonblocking warnings', async () => {
  const originalFetch=globalThis.fetch, originalServe=Deno.serve;
  let handler: (request: Request)=>Promise<Response>;
  let extractionCalls=0, finalCalls=0, saved=false;
  const requirements={mandatory:['Kubernetes','At least 10 years total experience'],preferred:[],keywords:['Kubernetes'],conflicts:['Using description experience over structured field'],min_total_years:10,eligible_locations:[],max_notice_days:null};
  const run={id:'22222222-2222-4222-8222-222222222222',claim_token:'claim',config_version:MATCHING_VERSION,
    groq_model:'qwen/qwen3.8-27b',job_hash:'hash',phase:'requirements',requirements:null};
  const candidates=[{applicant_id:'a1',source_hash:'source',source:{skills:'Kubernetes',total_experience:'10+'}}];
  Deno.env.set('SUPABASE_URL','https://fixture.supabase.co'); Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','fixture');
  Deno.env.set('MATCH_WORKER_SECRET','a'.repeat(64)); Deno.env.set('GROQ_API_KEY','fixture'); Deno.env.set('GROQ_MODEL',run.groq_model); Deno.env.set('OPENAI_API_KEY','fixture');
  try {
    Deno.serve=((fn:typeof handler)=>{handler=fn;return {} as Deno.HttpServer;}) as typeof Deno.serve;
    globalThis.fetch=async(input,init)=>{
      const url=String(input),operation=new URL(url).pathname.split('/').at(-1)!;
      if(url.includes('api.groq.com')){
        const sent=JSON.parse(String(init?.body)),payload=JSON.parse(sent.messages[1].content);
        if(!payload.candidates){
          extractionCalls++; assert(sent.messages[0].content.includes('authoritative'));
          assert(sent.messages[0].content.includes('WITHIN the description'));
          assert(payload.job_description.includes('10 years')); assert(payload.experience==='5 years');
          return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(requirements)}}]});
        }
        finalCalls++;assert(saved);assert(payload.requirements.conflicts===undefined);
        return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({recommendations:[[1,80,'Kubernetes experience',1,'Kubernetes','','']]})}}]});
      }
      if(url.includes('api.openai.com'))return Response.json({data:[{embedding:Array.from({length:3072},(_,i)=>i?0.01:1)}]});
      if(operation==='matching_claim_batch_run')return Response.json(run);
      if(operation==='matching_run_context')return Response.json({current_job_hash:'hash',job:{job_description:'Kubernetes engineer, 10 years total experience',experience:'5 years'}});
      if(operation==='matching_save_auto_requirements'){
        saved=true;return Response.json({...run,phase:'retrieval',requirements});
      }
      if(operation==='matching_search'){const args=JSON.parse(String(init?.body));assert(args.p_min_years===10);return Response.json(candidates);}
      if(operation==='matching_coverage')return Response.json({indexed:491});
      if(operation==='matching_batch_candidates')return Response.json(candidates);
      if(operation==='matching_confirm'||operation==='matching_save_requirements')throw new Error('Manual review must not be used');
      return Response.json(true);
    };
    await import('../../supabase/functions/candidate-match-worker/index.ts?automatic');
    const response=await handler!(new Request('http://localhost',{method:'POST',headers:{'x-match-worker-secret':'a'.repeat(64)},body:'{}'}));
    assert(response.status===200);assert(extractionCalls===1&&finalCalls===1);
  }finally{globalThis.fetch=originalFetch;Deno.serve=originalServe;}
});
