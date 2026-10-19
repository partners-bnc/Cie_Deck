function assert(value: unknown, message = 'Assertion failed'): asserts value { if (!value) throw new Error(message); }

Deno.test('status polling reuses fetched result counts and only checks new indexing after completion', async () => {
  const originalFetch=globalThis.fetch, originalServe=Deno.serve;
  let handler: (request: Request)=>Promise<Response>;
  const jobId='11111111-1111-4111-8111-111111111111',runId='22222222-2222-4222-8222-222222222222';
  let full=false,corrupt=false;
  let status='running', indexingCounts=0, resultReads=0;
  Deno.env.set('SUPABASE_URL','https://fixture.supabase.co');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','fixture');
  try {
    Deno.serve=((fn:typeof handler)=>{handler=fn;return {} as Deno.HttpServer;}) as typeof Deno.serve;
    globalThis.fetch=async(input,init)=>{
      const url=new URL(String(input)),operation=url.pathname.split('/').at(-1);
      if(operation==='user') return Response.json({id:jobId,aud:'authenticated',role:'authenticated'});
      if(operation==='admin_users') return Response.json({auth_id:jobId,hr_name:'Fixture'});
      if(operation==='client_jobs') return Response.json({id:jobId,job_code:'FIXTURE'});
      if(operation==='job_match_runs') return Response.json({id:runId,status,config_version:full?'matching-all-scored-v5':undefined,phase:status==='failed'?'retrieval':'assessment',created_at:'2026-10-10T00:00:00Z'});
      if(operation==='job_match_results') {
        assert(init?.method!=='HEAD','Redundant result count'); resultReads++;
        if(full) return Response.json(Array.from({length:50},(_,i)=>({applicant_id:`id-${i}`,retrieval:{rrf:1},assessment:corrupt&&i===49?null:{analysis:'A summary for this candidate.'},score:i,final_rank:50-i,stale:false,applicants:{}})));
        return Response.json([
          {applicant_id:'one',retrieval:{rrf:1},assessment:null,final_rank:null,stale:false,applicants:{}},
          {applicant_id:'two',retrieval:{rrf:2},assessment:{},final_rank:1,stale:false,applicants:{}},
          {applicant_id:'three',retrieval:{rrf:3},assessment:{},final_rank:2,stale:true,applicants:{}},
        ]);
      }
      if(operation==='tagged_candidates') return Response.json([]);
      if(operation==='applicant_search_index') {
        assert(status==='completed','Index count during active or failed retrieval'); indexingCounts++;
        return new Response(null,{status:200,headers:{'content-range':'0-6/7'}});
      }
      if(operation==='matching_coverage') return Response.json({total:9,indexed:9,pending:0,failed:0,insufficient:0});
      throw new Error(`Unexpected operation: ${operation}`);
    };
    await import('../../supabase/functions/candidate-matching/index.ts?status-performance');
    for(status of ['running','failed','completed']) {
      const response=await handler!(new Request('http://localhost',{method:'POST',headers:{authorization:'Bearer fixture'},body:JSON.stringify({action:'status',jobId,runId})}));
      assert(response.status===200);
      const body=await response.json();
      assert(body.retrieved===3&&body.assessed===2);
      assert(body.run.status===status&&body.searchMatches.length===2&&body.results.length===1);
      assert(body.newlyIndexed===(status==='completed'?7:0));
    }
    assert(indexingCounts===1&&resultReads===3);
    full=true;status='completed';
    for(corrupt of [false,true]) {
      const response=await handler!(new Request('http://localhost',{method:'POST',headers:{authorization:'Bearer fixture'},body:JSON.stringify({action:'status',jobId,runId})}));
      const body=await response.json();
      assert(body.retrieved===50&&body.results.length===50);
      assert(body.assessmentStatus===(corrupt?'failed':'completed'));
      assert(body.results.some((r:{score:number})=>r.score===0));
    }
  } finally { globalThis.fetch=originalFetch;Deno.serve=originalServe; }
});
