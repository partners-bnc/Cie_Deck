// Read-only provider model access checks. Never submits applicant text or creates embeddings/completions.
import { readFile } from 'node:fs/promises';
const repoModel = (await readFile(new URL('../../api/admin/parse-resume.js', import.meta.url), 'utf8')).match(/GROQ_MODEL\s*=\s*'([^']+)'/)?.[1];
const checks = [
  { provider: 'OpenAI', url: 'https://api.openai.com/v1/models/text-embedding-3-large', key: process.env.OPENAI_API_KEY },
  { provider: 'Groq', url: 'https://api.groq.com/openai/v1/models', key: process.env.GROQ_API_KEY },
];
for (const check of checks) {
  if (!check.key) { console.log(`${check.provider}: server key missing locally`); continue; }
  try {
    const response = await fetch(check.url, { headers: { Authorization: `Bearer ${check.key}` }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) { console.log(`${check.provider}: model lookup HTTP ${response.status}`); continue; }
    const data = await response.json();
    if (check.provider === 'Groq') {
      const configured = process.env.GROQ_MODEL;
      console.log(`Groq: authenticated; configured model ${configured ? data.data.some(model => model.id === configured) ? 'available' : 'unavailable' : 'not set locally'}`);
      console.log(`Existing repository Groq model ${repoModel}: ${data.data.some(model => model.id === repoModel) ? 'available' : 'unavailable'}`);
    } else console.log('OpenAI: authenticated; embedding model available');
  } catch { console.log(`${check.provider}: model lookup failed (network/timeout)`); }
}
console.log('No inference requests made. Model access does not establish billing quota or inference quality.');
