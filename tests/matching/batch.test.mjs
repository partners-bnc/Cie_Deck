import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getEncoding } from 'js-tiktoken';
import { BATCH_INPUT_TOKENS, BATCH_OUTPUT_TOKENS, batchResponseFormat, buildBatchPayload, validateBatch } from '../../supabase/functions/_shared/matching/batch.js';
const encoding=getEncoding('cl100k_base');
const tokenizer={encode:text=>encoding.encode(text,[],[]),decode:tokens=>encoding.decode(tokens)};
const requirements={mandatory:['Kubernetes'],preferred:['AWS'],keywords:['Kubernetes','AWS']};
const candidates=Array.from({length:50},(_,i)=>({applicant_id:`uuid-${i}`,source_hash:`hash-${i}`,source:{current_position:'Engineer',skills:'Kubernetes AWS Terraform',total_experience:'6-10',cv_summary:'Operates Kubernetes clusters. '.repeat(1000),full_name:'Do not send this name',email:'private@example.com'}}));
const rows=()=>candidates.map((_,i)=>({candidate:i+1,score:i*2,summary:'The profile includes engineering and Kubernetes experience. AWS depth and project ownership are unknown.'}));

test('all 50 candidates receive richer professional context in one bounded payload',()=>{
 const {payload,inputTokens}=buildBatchPayload(candidates,requirements,tokenizer);
 assert.equal(payload.candidates.length,50);assert.ok(inputTokens<=BATCH_INPUT_TOKENS);assert.ok(inputTokens>4500);
 assert.doesNotMatch(JSON.stringify(payload),/Do not send this name|private@example.com|uuid-/);
 assert.deepEqual(payload.requirements,requirements);
 assert.ok(payload.candidates.every(c=>c.facts.length>=3));
 const schema=batchResponseFormat(50).json_schema.schema;
 assert.equal(schema.properties.recommendations.minItems,50);assert.equal(schema.properties.recommendations.maxItems,50);
 assert.equal(schema.properties.recommendations.items.properties.score.minimum,0);
 assert.equal(schema.properties.recommendations.items.properties.candidate.enum.length,50);
});

test('every candidate is mapped, scored 0..100, summarized and sorted with stable ties',()=>{
 const output=validateBatch({recommendations:rows()},candidates);
 assert.equal(output.length,50);assert.equal(output[0].score,98);assert.equal(output.at(-1).score,0);
 assert.ok(output.every(c=>c.assessment.analysis && c.source_hash));
 const tied=rows().map(c=>({...c,score:0})).reverse();
 assert.deepEqual(validateBatch({recommendations:tied},candidates).map(c=>c.applicant_id),candidates.map(c=>c.applicant_id));
 const weak=rows().map(c=>({...c,score:0,summary:'The available profile does not establish the required skills. Relevant experience is unknown.'}));
 assert.equal(validateBatch({recommendations:weak},candidates).length,50);
 assert.equal(validateBatch({recommendations:rows().map(c=>({...c,score:100}))},candidates).length,50);
});

test('missing, duplicate, foreign IDs and invalid scores cannot complete a batch',()=>{
 for(const invalid of [[],rows().slice(0,1),rows().slice(0,49),[...rows(),rows()[0]]]) assert.throws(()=>validateBatch({recommendations:invalid},candidates),/Incomplete batch/);
 for(const candidate of [0,51,'1',null,2]) {const bad=rows();bad[0]={...bad[0],candidate};assert.throws(()=>validateBatch({recommendations:bad},candidates),/Invalid batch candidate/);}
 for(const score of [-1,101,0.5,'80',null]) {const bad=rows();bad[0]={...bad[0],score};assert.throws(()=>validateBatch({recommendations:bad},candidates),/Invalid batch score/);}
});

test('empty and oversized summaries reject without inventing replacement scores',()=>{
 for(const summary of ['', '  ', null,7,'x'.repeat(601)]) {const bad=rows();bad[0]={...bad[0],summary};assert.throws(()=>validateBatch({recommendations:bad},candidates),/Invalid batch analysis/);}
 assert.ok(tokenizer.encode(JSON.stringify({recommendations:rows()})).length<BATCH_OUTPUT_TOKENS);
});

test('smaller pools, sparse profiles, empty search and oversized context are explicit',()=>{
 const small=candidates.slice(0,3);
 assert.equal(buildBatchPayload(small,requirements,tokenizer).payload.candidates.length,3);
 assert.equal(validateBatch({recommendations:rows().slice(0,3)},small).length,3);
 assert.deepEqual(validateBatch({recommendations:[]},[]),[]);
 assert.deepEqual(buildBatchPayload([{...candidates[0],source:{}}],requirements,tokenizer).payload.candidates[0].facts,[]);
 assert.throws(()=>buildBatchPayload(candidates,{...requirements,mandatory:Array(20).fill('Kubernetes '.repeat(2000))},tokenizer),/context limit/);
});
