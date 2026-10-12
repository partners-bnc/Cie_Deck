import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getEncoding } from 'js-tiktoken';
import { BATCH_FIELDS, BATCH_OUTPUT_TOKENS, buildBatchPayload, validateBatch } from '../../supabase/functions/_shared/matching/batch.js';
const encoding = getEncoding('cl100k_base');
const tokenizer = { encode: text => encoding.encode(text, [], []), decode: tokens => encoding.decode(tokens) };
const requirements = { mandatory: ['Kubernetes'], preferred: ['AWS'], keywords: ['Kubernetes', 'AWS'], conflicts: [] };
const candidates = Array.from({ length: 50 }, (_, i) => ({ applicant_id: `uuid-${i}`, source_hash: `hash-${i}`,
  source: { current_position: 'Engineer', skills: 'Kubernetes AWS Terraform', total_experience: '6-10', cv_summary: 'Operates Kubernetes clusters. '.repeat(1000), full_name: 'Do not send this name', email: 'private@example.com' } }));
const recommendation = { candidate: 1, score: 80, reason: 'Direct Kubernetes evidence', evidence: [{ field: BATCH_FIELDS.indexOf('skills'), quote: 'Kubernetes' }], gaps: [], unknowns: ['Notice period'] };

test('all 50 candidates fit one bounded payload without identity fields', () => {
  const { payload, inputTokens } = buildBatchPayload(candidates, requirements, tokenizer);
  assert.equal(payload.candidates.length, 50); assert.ok(inputTokens <= 4500);
  assert.doesNotMatch(JSON.stringify(payload), /Do not send this name|private@example.com|uuid-/);
  assert.deepEqual(payload.requirements, requirements);
});
test('batch validation maps identifiers and accepts only original, supplied evidence', () => {
  const { payload } = buildBatchPayload(candidates, requirements, tokenizer);
  const results = validateBatch({ recommendations: [recommendation] }, candidates, payload);
  assert.equal(results[0].applicant_id, 'uuid-0'); assert.equal(results[0].assessment.evidence[0].field, 'skills');
  assert.throws(() => validateBatch({ recommendations: [recommendation, recommendation] }, candidates, payload));
  assert.throws(() => validateBatch({ recommendations: [{ ...recommendation, candidate: 51 }] }, candidates, payload));
  assert.throws(() => validateBatch({ recommendations: [{ ...recommendation, evidence: [{ field: 1, quote: 'Fabricated skill' }] }] }, candidates, payload));
  assert.throws(() => validateBatch({ recommendations: [{ ...recommendation, score: 101 }] }, candidates, payload));
  assert.throws(() => validateBatch({ recommendations: Array.from({ length: 21 }, (_, i) => ({ ...recommendation, candidate: i + 1 })) }, candidates, payload));
  assert.deepEqual(validateBatch({ recommendations: [] }, candidates, payload), []);
  assert.equal(validateBatch({ recommendations: [[1, 80, 'Direct evidence', 1, 'Kubernetes', '', 'Notice unknown']] }, candidates, payload)[0].assessment.unknowns[0], 'Notice unknown');
  assert.throws(() => validateBatch({ recommendations: [null] }, candidates, payload));
});
test('small pools stay small and excessive requirements fail before provider work', () => {
  assert.equal(buildBatchPayload(candidates.slice(0, 3), requirements, tokenizer).payload.candidates.length, 3);
  assert.throws(() => buildBatchPayload(candidates, { ...requirements, mandatory: Array(20).fill('Kubernetes '.repeat(200)) }, tokenizer), /shorten requirements/);
});

test('concise analysis survives validation and twenty explanations fit the output budget', () => {
  const { payload } = buildBatchPayload(candidates, requirements, tokenizer);
  const analysis = 'The supplied skills include Kubernetes, directly supporting the mandatory requirement, and AWS supports the preferred requirement. The profile records engineering experience, while the exact depth of AWS knowledge is not supplied and should be verified.';
  const rows = Array.from({length:20},(_,i)=>[i+1,80,'Direct Kubernetes evidence',BATCH_FIELDS.indexOf('skills'),'Kubernetes','','AWS depth unknown',analysis]);
  const output = {recommendations:rows};
  assert.ok(tokenizer.encode(JSON.stringify(output)).length < BATCH_OUTPUT_TOKENS);
  assert.equal(validateBatch(output,candidates,payload)[0].assessment.analysis,analysis);
  for (const invalid of ['',null,7,'x'.repeat(601),Array(91).fill('word').join(' ')]) {
    assert.throws(()=>validateBatch({recommendations:[[1,80,'Supported',1,'Kubernetes','','',invalid]]},candidates,payload),/analysis/);
  }
  assert.throws(()=>validateBatch({recommendations:[{...recommendation,analysis,evidence:[{field:1,quote:'Invented'}]}]},candidates,payload),/Unsupported evidence/);
});
