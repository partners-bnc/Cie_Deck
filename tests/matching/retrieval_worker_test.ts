import { MATCHING_VERSION } from '../../supabase/functions/_shared/matching/batch.js';
function assert(v: unknown): asserts v { if (!v) throw new Error('Assertion failed'); }

Deno.test('timeout deliveries reuse the persisted vector and never call final AI', async () => {
  const originalFetch=globalThis.fetch, originalServe=Deno.serve;
  let handler: (r: Request)=>Promise<Response>;
  let cached: string|null=null, searches=0, embeddings=0, finalCalls=0, attempts=0, failed=false;
  const run={id:'33333333-3333-4333-8333-333333333333',claim_token:'claim',job_hash:'hash',
    config_version:MATCHING_VERSION,groq_model:'fixture',phase:'retrieval',
    requirements:{mandatory:['Kubernetes'],preferred:[],keywords:['Kubernetes'],conflicts:[]}};
  Deno.env.set('SUPABASE_URL','https://fixture.supabase.co'); Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','fixture');
  Deno.env.set('MATCH_WORKER_SECRET','a'.repeat(64)); Deno.env.set('GROQ_MODEL','fixture'); Deno.env.set('OPENAI_API_KEY','fixture');
  try {
    Deno.serve=((fn:typeof handler)=>{handler=fn;return {} as Deno.HttpServer;}) as typeof Deno.serve;
    globalThis.fetch=async(input,init)=>{
      const url=String(input),op=new URL(url).pathname.split('/').at(-1);
      const args=JSON.parse(String(init?.body||'{}'));
      if(url.includes('openai.com')) { embeddings++; return Response.json({data:[{embedding:Array.from({length:3072},(_,i)=>i?0.01:1)}]}); }
      if(url.includes('groq.com')) { finalCalls++; throw new Error('Unexpected final AI'); }
      if(op==='matching_claim_batch_run') return Response.json(failed?null:{...run,attempts:++attempts,query_embedding:cached});
      if(op==='matching_run_context') return Response.json({current_job_hash:'hash'});
      if(op==='matching_save_query_embedding') {cached=args.p_vector;return Response.json(true);}
      if(op==='matching_search') { searches++;assert(cached===args.p_vector);return Response.json({code:'57014',message:'private database text'},{status:500}); }
      if(op==='matching_release_batch_run') {assert(args.p_transient);assert(!args.p_error.includes('private'));failed=attempts>=3;return Response.json(null);}
      throw new Error('Unexpected operation');
    };
    await import('../../supabase/functions/candidate-match-worker/index.ts?retrieval-timeouts');
    for(let i=0;i<4;i++) {
      const response=await handler!(new Request('http://localhost',{method:'POST',headers:{'x-match-worker-secret':'a'.repeat(64)},body:'{}'}));
      assert(response.status===(i<3?500:200));
    }
    assert(embeddings===1&&searches===3&&finalCalls===0);
  } finally {globalThis.fetch=originalFetch;Deno.serve=originalServe;}
});
