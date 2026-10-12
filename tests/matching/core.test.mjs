import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getEncoding } from 'js-tiktoken';
import { buildProfile, CONFIG, experienceRange, normalizeAttributes, validateAssessment, validateRequirements, validateVector } from '../../supabase/functions/_shared/matching/core.js';

const tokenizer = getEncoding('cl100k_base');
test('experience ranges preserve missing values and open upper bounds', () => {
  assert.deepEqual(experienceRange(''), { min: null, max: null });
  assert.deepEqual(experienceRange('0'), { min: 0, max: 0 });
  assert.deepEqual(experienceRange('6-10 years'), { min: 6, max: 10 });
  assert.deepEqual(experienceRange('10+'), { min: 10, max: null });
  assert.deepEqual(experienceRange('five years'), { min: null, max: null });
});
test('unknown salary and notice survive normalization', () => {
  assert.equal(normalizeAttributes({ expected_pay: 'N/A', notice_period: 'unknown' }).expected_pay, null);
  assert.equal(normalizeAttributes({ notice_period: '1 month' }).notice_days, null);
  assert.equal(normalizeAttributes({ notice_period: 'Immediate' }).notice_days, 0);
  assert.equal(normalizeAttributes({ notice_period: '30 days' }).notice_days, 30);
});
test('profile is deterministic, excludes identity and respects actual token limit', () => {
  const row = { skills: 'C++ .NET Kubernetes '.repeat(10000), cv_summary: '日本語 professional experience '.repeat(10000),
    current_position: 'Developer', total_experience: '6-10', full_name: 'Private Name', aadhar_number: '1234', email: 'private@example.com', resume_link: 'https://never-fetch.test' };
  const profile = buildProfile(row, tokenizer);
  assert.ok(profile.shortened);
  assert.ok(tokenizer.encode(profile.text).length <= CONFIG.budget);
  assert.match(profile.text, /current_position: Developer/);
  assert.match(profile.text, /total_experience: 6-10/);
  assert.doesNotMatch(profile.text, /Private Name|private@example.com|never-fetch/);
  assert.deepEqual(buildProfile(row, tokenizer), profile);
});
test('empty profiles are accounted for and invalid vectors fail', () => {
  assert.equal(buildProfile({ skills: 'N/A', cv_summary: '' }, tokenizer).text, '');
  assert.throws(() => validateVector(Array(3072).fill(0)));
  assert.throws(() => validateVector([1, 2]));
  assert.throws(() => validateVector(Array(3072).fill(Infinity)));
  assert.equal(validateVector(Array(3072).fill(0.1)).length, 3072);
});
const requirements = validateRequirements({ mandatory: ['Kubernetes'], preferred: ['C++'], keywords: ['Kubernetes', 'C++'], conflicts: [], min_total_years: null });
test('evidence must quote the source; unknowns are not contradictions', () => {
  const value = { requirements: [
    { index: 0, status: 'demonstrated', evidence: [{ field: 'skills', quote: 'Kubernetes' }] },
    { index: 1, status: 'unknown', evidence: [] },
  ] };
  const result = validateAssessment(value, requirements, { skills: 'Kubernetes' });
  assert.equal(result.suitable, true); assert.equal(result.score, 67);
  assert.throws(() => validateAssessment(value, requirements, { skills: 'Docker' }), /Unsupported evidence/);
  assert.throws(() => validateAssessment({ requirements: [value.requirements[0], value.requirements[0]] }, requirements, { skills: 'Kubernetes' }));
});
test('unstructured and incomplete provider outputs are rejected', () => {
  assert.throws(() => validateRequirements({ mandatory: [], preferred: [], keywords: [], conflicts: [] }));
  assert.throws(() => validateRequirements({ ...requirements, min_total_years: '5' }));
  assert.throws(() => validateAssessment({ score: 99 }, requirements, {}));
});
