// Run with node --env-file=.env.local tools/matching/manage.mjs <command> [--enqueue] [--all]
import { readFile, writeFile } from 'node:fs/promises';
const [command = 'coverage', ...flags] = process.argv.slice(2);
const valid = ['coverage', 'pilot', 'seed', 'tick', 'retry-embeddings', 'retry-runs'];
if (!valid.includes(command) || flags.some(flag => !['--enqueue', '--all', '--reset', '--pilot-only'].includes(flag))) throw new Error(`Usage: manage.mjs ${valid.join('|')} [--enqueue] [--all] [--reset] [--pilot-only]`);
const endpoint = process.env.SUPABASE_URL;
const secret = process.env.MATCH_WORKER_SECRET;
if (!endpoint || !secret) throw new Error('Set SUPABASE_URL and MATCH_WORKER_SECRET in the ignored local environment file');
const checkpoint = new URL('../../.matching-backfill.json', import.meta.url);
const enqueue = flags.includes('--enqueue');
let after = null;
if (command === 'seed' && enqueue && !flags.includes('--reset')) {
  try {
    const saved = JSON.parse(await readFile(checkpoint, 'utf8'));
    if (saved.endpoint !== endpoint) throw new Error('Checkpoint belongs to another project');
    if (saved.complete) { console.log('Backfill seed already completed. Use --reset for reconciliation.'); process.exit(0); }
    after = saved.after;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
do {
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/functions/v1/applicant-embedding-worker`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-match-worker-secret': secret },
    signal: AbortSignal.timeout(45000), body: JSON.stringify({
      action: command.startsWith('retry-') ? 'retry' : command,
      kind: command.replace('retry-', ''), enqueue, after, pilotOnly: flags.includes('--pilot-only'),
    }),
  });
  if (!response.ok) throw new Error(`Worker HTTP ${response.status}. Check deployment and worker secret.`);
  const result = await response.json();
  console.log(JSON.stringify(result));
  if (command !== 'seed') break;
  after = result.next_cursor;
  if (enqueue) await writeFile(checkpoint, JSON.stringify({ endpoint, after, complete: result.scanned < 500 }, null, 2));
  if (result.scanned < 500 || !flags.includes('--all')) break;
} while (after);
