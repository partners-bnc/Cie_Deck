import { readFile } from 'node:fs/promises';
const args = process.argv.slice(2);
const runId = args[args.indexOf('--run') + 1];
const positivesFile = args.includes('--positives') ? args[args.indexOf('--positives') + 1] : null;
if (!args.includes('--run') || !runId) throw new Error('Usage: evaluate.mjs --run <run-uuid> [--positives <json-file-containing-uuid-array>]');
const endpoint = process.env.SUPABASE_URL, secret = process.env.MATCH_WORKER_SECRET;
if (!endpoint || !secret) throw new Error('Set SUPABASE_URL and MATCH_WORKER_SECRET in your ignored local environment file');
const positives = positivesFile ? JSON.parse(await readFile(positivesFile, 'utf8')) : [];
if (!Array.isArray(positives) || positives.some(id => typeof id !== 'string')) throw new Error('Known positives must be an array of applicant UUIDs');
const response = await fetch(`${endpoint.replace(/\/$/, '')}/functions/v1/applicant-embedding-worker`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'x-match-worker-secret': secret }, signal: AbortSignal.timeout(60000),
  body: JSON.stringify({ action: 'evaluate', runId, positives }),
});
if (!response.ok) throw new Error(`Evaluation HTTP ${response.status}; ensure the run has a cached embedding`);
console.log(JSON.stringify(await response.json(), null, 2));
