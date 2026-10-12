// Set PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD (or PGDATABASE to a connection URI).
// node tools/matching/benchmark.mjs [--full] [--recall]
// Default: stop a scenario after three timeouts; --full runs all 30 warm samples.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
const exec = promisify(execFile);
const flags = process.argv.slice(2);
if (flags.some(x=>!['--full','--recall'].includes(x))) throw new Error('Unknown flag');
const prefix = await readFile(new URL('./benchmark-session.sql',import.meta.url),'utf8');
async function sql(query) {
  try {
    const {stdout}=await exec('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',query],{maxBuffer:4*1024*1024,timeout:75000});
    return JSON.parse(stdout.trim());
  } catch { throw new Error('Benchmark database command failed; check the connection and database diagnostics'); }
}
const quote = x => x===null?'null':`'${String(x).replaceAll("'","''")}'`;
const array = xs => `array[${xs.map(quote).join(',')}]::text[]`;
const runs=await sql(`select coalesce(jsonb_agg(x),'[]') from (
  select distinct on(md5(query_embedding::text)) id,client_job_id,
    (requirements->>'min_total_years')::numeric years,
    coalesce(requirements->'eligible_locations','[]') locations,
    (requirements->>'max_notice_days')::integer notice
  from job_match_runs where query_embedding is not null order by md5(query_embedding::text),created_at desc) x;`);
if (!runs.length) throw new Error('No saved query embeddings');
const scenarios=runs.map(r=>({...r,name:`saved_${r.id}`,mode:'hybrid',keywords:null}));
const base={...scenarios[0],years:null,locations:[],notice:null};
scenarios.push({...base,name:'unrestricted'}, {...base,name:'ten_years',years:10},
  {...base,name:'location_notice',locations:['gurgaon'],notice:0},
  {...base,name:'unknowns',years:100,locations:['__benchmark_no_known_location__'],notice:0},
  {...base,name:'empty',mode:'keyword',keywords:['__no_matching_lexeme_10oct2026__']},
  {...base,name:'punctuation',mode:'keyword',keywords:['C++','.NET']});
function call(s) {return `select pg_temp.bench_one(${quote(s.id)}::uuid,${s.years??'null'},${array(s.locations)},${s.notice??'null'},${quote(s.mode)},${s.keywords?array(s.keywords):'null'});`;}
const quantile=(xs,p)=>xs.length?xs[Math.max(0,Math.ceil(xs.length*p)-1)]:null;
function summary(samples) {
  const ok=samples.filter(x=>!x.code).map(x=>Number(x.ms)).sort((a,b)=>a-b);
  const timeouts=samples.filter(x=>x.code==='57014').length;
  return {requests:samples.length,timeouts,successful_median_ms:quantile(ok,.5),successful_p95_ms:quantile(ok,.95),successful_max_ms:ok.at(-1)??null,
    complete_distribution:timeouts===0,all_unique:samples.filter(x=>!x.code).every(x=>x.count===x.unique_count)};
}
const report={created_at:new Date().toISOString(),timeout_ms:20000,cache_flushed:false,scenarios:[],concurrency:[]};
for(const s of scenarios) {
  const first=await sql(prefix+call(s)),samples=[];
  for(let n=0;n<30;n++) {
    samples.push(await sql(prefix+call(s)));
    if(!flags.includes('--full')&&samples.filter(x=>x.code==='57014').length>=3) break;
  }
  const entry={name:s.name,run_id:s.id,first,samples,...summary(samples)};
  report.scenarios.push(entry);
  console.log(JSON.stringify({name:s.name,...summary(samples)}));
  await writeFile('matching-benchmark.json',JSON.stringify(report,null,2));
}
report.concurrency=await Promise.all(Array.from({length:5},()=>sql(prefix+call(scenarios[0]))));
if(flags.includes('--recall')) {
  report.recall=[];
  for(const s of scenarios.filter(s=>s.mode!=='keyword')) {
    // Diagnostic-only 60s bound for exhaustive truth. Retrieval RPC timeout is 20s.
    const result=await sql(`set statement_timeout='60s'; set search_path=public,extensions;
      with q as materialized(select query_embedding v from job_match_runs where id=${quote(s.id)}::uuid),
      approx as materialized(select (x.value->>'applicant_id')::uuid applicant_id
        from job_match_runs r cross join lateral jsonb_array_elements(matching_search((select v from q),
          array(select jsonb_array_elements_text(r.requirements->'keywords')),${s.years??'null'},false,
          ${array(s.locations)},${s.notice??'null'},'semantic')) with ordinality x(value,position)
        where r.id=${quote(s.id)}::uuid and x.position<=20),
      exact as materialized(select i.applicant_id from applicant_search_index i where is_current and embedding is not null
        and (${s.years??'null'}::numeric is null or attributes#>>'{experience,max}' is null or (attributes#>>'{experience,max}')::numeric>=${s.years??'null'})
        and (cardinality(${array(s.locations)})=0 or attributes->>'location' is null or lower(attributes->>'location')=any(${array(s.locations)}))
        and (${s.notice??'null'}::integer is null or attributes->>'notice_days' is null or (attributes->>'notice_days')::integer<=${s.notice??'null'})
        order by embedding<=>(select v from q),applicant_id limit 20)
      select jsonb_build_object('recall',(select count(*) from approx join exact using(applicant_id))*1.0/nullif((select count(*) from exact),0),'exact_count',(select count(*) from exact));`);
    report.recall.push({name:s.name,...result});
  }
}
await writeFile('matching-benchmark.json',JSON.stringify(report,null,2));
