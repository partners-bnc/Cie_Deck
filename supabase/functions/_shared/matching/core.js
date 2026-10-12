export const CONFIG = Object.freeze({ model: 'text-embedding-3-large', dimensions: 3072, version: 'applicant-v1', budget: 7600, pool: 50 });
export const SEMANTIC_FIELDS = ['current_position', 'skills', 'total_experience', 'relevant_experience', 'education', 'certification', 'process_knowledge', 'cv_summary'];
export const ATTRIBUTE_FIELDS = ['current_location', 'expected_pay', 'notice_period', 'work_authorization'];
const clean = value => String(value ?? '').trim();
const unknown = value => !clean(value) || /^(n\/?a|unknown|not specified|null|-)$/i.test(clean(value));

export function experienceRange(value) {
  const text = clean(value).toLowerCase().replace(/\s*(years?|yrs?)\s*/g, '').trim();
  if (unknown(text)) return { min: null, max: null };
  if (/^(fresher|fresh graduate)$/.test(text)) return { min: 0, max: 0 };
  let match = text.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
  if (match && +match[1] <= +match[2]) return { min: +match[1], max: +match[2] };
  match = text.match(/^(\d+(?:\.\d+)?)\s*\+$/);
  if (match) return { min: +match[1], max: null };
  if (/^\d+(?:\.\d+)?$/.test(text)) return { min: +text, max: +text };
  return { min: null, max: null };
}

// Only facts with explicit units are normalized. Currency and salary period are never guessed.
export function normalizeAttributes(row) {
  const notice = clean(row.notice_period).match(/^(\d+)\s*days?$/i);
  return {
    experience: experienceRange(row.total_experience),
    relevant_experience: experienceRange(row.relevant_experience),
    location: unknown(row.current_location) ? null : clean(row.current_location).toLowerCase(),
    expected_pay: unknown(row.expected_pay) ? null : clean(row.expected_pay),
    notice_days: /^immediate(?:ly)?$/i.test(clean(row.notice_period)) ? 0 : notice ? +notice[1] : null,
    work_authorization: unknown(row.work_authorization) ? null : clean(row.work_authorization),
  };
}

// Scrub obvious identifiers embedded in professional free text as well as excluding identity columns.
export function professionalText(value) {
  return clean(value).replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email omitted]')
    .replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, '[identifier omitted]')
    .replace(/(?:\+\d{1,3}[ -]?)?(?:\d[ ()-]?){10,13}\b/g, '[phone omitted]');
}

export function buildProfile(row, tokenizer) {
  const populated = SEMANTIC_FIELDS.filter(field => !unknown(row[field]));
  if (!populated.length) return { text: '', shortened: false, tokens: 0, attributes: normalizeAttributes(row), completeness: 0 };
  // Allocate a fair share to each section before distributing spare space. Summary cannot crowd out skills.
  const sections = populated.map(field => ({ field, tokens: tokenizer.encode(professionalText(row[field])) }));
  const allowance = Math.floor((CONFIG.budget - 180) / sections.length);
  const lengths = sections.map(section => Math.min(section.tokens.length, allowance));
  let remaining = CONFIG.budget - 180 - lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < sections.length; i++) {
    const extra = Math.min(remaining, sections[i].tokens.length - lengths[i]);
    lengths[i] += extra; remaining -= extra;
  }
  let text = sections.map((section, i) => `${section.field}: ${tokenizer.decode(section.tokens.slice(0, lengths[i]))}`).join('\n');
  let tokens = tokenizer.encode(text);
  let shortened = sections.some((section, i) => section.tokens.length > lengths[i]);
  if (tokens.length > CONFIG.budget) { text = tokenizer.decode(tokens.slice(0, CONFIG.budget)); shortened = true; tokens = tokenizer.encode(text); }
  return { text, shortened, tokens: tokens.length, attributes: normalizeAttributes(row), completeness: populated.length / SEMANTIC_FIELDS.length };
}

export function validateVector(vector) {
  if (!Array.isArray(vector) || vector.length !== CONFIG.dimensions || vector.some(x => typeof x !== 'number' || !Number.isFinite(x)) || !vector.some(x => x !== 0)) throw new Error('Invalid embedding vector');
  return vector;
}

function strings(value, max = 20) {
  if (!Array.isArray(value) || value.length > max || value.some(x => typeof x !== 'string' || !x.trim() || x.length > 500)) throw new Error('Invalid requirement list');
  return value.map(x => x.trim());
}

export function validateRequirements(value, allowEmpty = false) {
  if (!value || typeof value !== 'object') throw new Error('Invalid requirements');
  const result = {
    mandatory: strings(value.mandatory), preferred: strings(value.preferred),
    keywords: strings(value.keywords, 30), conflicts: strings(value.conflicts),
    min_total_years: value.min_total_years ?? null,
    eligible_locations: strings(value.eligible_locations ?? [], 20),
    max_notice_days: value.max_notice_days ?? null,
  };
  if (result.min_total_years !== null && (typeof result.min_total_years !== 'number' || !Number.isFinite(result.min_total_years) || result.min_total_years < 0 || result.min_total_years > 70)) throw new Error('Invalid minimum total experience');
  if (result.max_notice_days !== null && (!Number.isInteger(result.max_notice_days) || result.max_notice_days < 0 || result.max_notice_days > 365)) throw new Error('Invalid maximum notice period');
  if (!allowEmpty && !result.mandatory.length && !result.preferred.length) throw new Error('Add meaningful professional requirements before matching');
  if (!allowEmpty && !result.keywords.length) throw new Error('Add at least one role or skill keyword');
  return result;
}

export function validateAssessment(value, requirements, evidenceFields) {
  const all = [...requirements.mandatory, ...requirements.preferred];
  if (!Array.isArray(value?.requirements) || value.requirements.length !== all.length) throw new Error('Incomplete assessment');
  const seen = new Set();
  const items = value.requirements.map(item => {
    if (!Number.isInteger(item.index) || item.index < 0 || item.index >= all.length || seen.has(item.index)) throw new Error('Invalid requirement reference');
    seen.add(item.index);
    if (!['demonstrated', 'related', 'unknown', 'contradicted'].includes(item.status)) throw new Error('Invalid evidence status');
    const evidence = Array.isArray(item.evidence) ? item.evidence : [];
    if (evidence.length > 3) throw new Error('Too many evidence references');
    for (const ref of evidence) {
      if (![...SEMANTIC_FIELDS, ...ATTRIBUTE_FIELDS].includes(ref.field) || typeof ref.quote !== 'string' || !ref.quote.trim() || ref.quote.length > 500 || !String(evidenceFields[ref.field] ?? '').includes(ref.quote)) throw new Error('Unsupported evidence');
    }
    if (item.status !== 'unknown' && !evidence.length) throw new Error('Evidence required');
    return { index: item.index, status: item.status, evidence };
  }).sort((a, b) => a.index - b.index);
  const weights = items.map(item => item.index < requirements.mandatory.length ? 2 : 1);
  const points = { demonstrated: 1, related: 0.5, unknown: 0, contradicted: 0 };
  const score = Math.round(100 * items.reduce((sum, item, i) => sum + weights[i] * points[item.status], 0) / weights.reduce((a, b) => a + b, 0));
  const coverage = items.filter(item => item.status !== 'unknown').length / items.length;
  const suitable = score >= 40 && !items.some(item => item.index < requirements.mandatory.length && item.status === 'contradicted') && items.some(item => item.status === 'demonstrated');
  return { requirements: items, score, coverage, suitable };
}

export function safeError(error) {
  if (error?.code === '57014') return 'Candidate retrieval exceeded the database time limit; retry scheduled unless the three-attempt limit is exhausted';
  if (error?.message === 'Job requirements could not be interpreted; correct the job description using Edit job and retry') return error.message;
  if (error?.message === 'Requirements exceed batch budget; shorten requirements before retrying') return error.message;
  if (error?.message === 'Assessment provider HTTP 429') return 'Assessment provider rate limit';
  // These validation messages contain no provider output or applicant content.
  if (['Incomplete assessment', 'Invalid requirement reference', 'Invalid evidence status',
    'Too many evidence references', 'Unsupported evidence', 'Evidence required',
    'Incomplete provider response'].includes(error?.message)) return error.message;
  return error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'Provider timeout' : 'Matching operation failed; retry or inspect server diagnostics';
}
