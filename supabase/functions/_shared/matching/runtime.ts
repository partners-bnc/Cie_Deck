import { createClient } from 'npm:@supabase/supabase-js@2.100.1';
import { getEncoding } from 'npm:js-tiktoken@1.0.21';
import { CONFIG, professionalText, validateVector } from './core.js';
import { GROQ_SYSTEM_PREFIX } from './batch.js';

const encoding = getEncoding('cl100k_base');
export const tokenizer = { encode: (text: string) => encoding.encode(text, [], []), decode: (tokens: number[]) => encoding.decode(tokens) };
export function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing configuration: ${name}`);
  return value;
}
export function db() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
}
export type Database = ReturnType<typeof db>;
export class DatabaseError extends Error {
  constructor(public operation: string, public code: string) {
    super(`Database operation failed: ${operation} (${code})`);
  }
  get transient() { return this.code === '57014' || this.code.startsWith('08') || ['40001', '40P01', '53300', '57P03'].includes(this.code); }
}
export async function rpc(client: Database, name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new DatabaseError(name, error.code || 'unknown');
  return data;
}
export const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-match-worker-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
export function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
export async function authenticate(request: Request, client: Database) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw new HttpError(401, 'Sign in to use matching');
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Session expired');
  const admin = await client.from('admin_users').select('auth_id,hr_name').eq('auth_id', data.user.id).eq('is_active', true).maybeSingle();
  if (admin.error || !admin.data) throw new HttpError(403, 'Active recruiter access required');
  return { id: data.user.id, name: admin.data.hr_name };
}
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function workerAuthorized(request: Request) {
  const supplied = request.headers.get('x-match-worker-secret') || '';
  const expected = env('MATCH_WORKER_SECRET');
  if (expected.length < 32) throw new Error('Worker secret is too short');
  const digest = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [a, b] = await Promise.all([digest(supplied), digest(expected)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
export async function embedding(text: string, onUsage?: (tokens: number) => void) {
  if (!text.trim() || tokenizer.encode(text).length > CONFIG.budget) throw new Error('Invalid embedding input size');
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST', signal: AbortSignal.timeout(25000),
    headers: { Authorization: `Bearer ${env('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: CONFIG.model, dimensions: CONFIG.dimensions, encoding_format: 'float', input: text }),
  });
  if (!response.ok) throw new Error(`Embedding provider HTTP ${response.status}`);
  const body = await response.json();
  if (onUsage && Number.isInteger(body.usage?.prompt_tokens)) onUsage(body.usage.prompt_tokens);
  return validateVector(body.data?.[0]?.embedding);
}
export class ProviderError extends Error {
  constructor(public status: number, public retrySeconds: number | null = null) {
    super(`Assessment provider HTTP ${status}`);
  }
  get transient() { return this.status === 429 || this.status >= 500; }
}
export async function groq(instruction: string, data: unknown, maxCompletionTokens = 6000) {
  const model = env('GROQ_MODEL');
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', signal: AbortSignal.timeout(25000),
    headers: { Authorization: `Bearer ${env('GROQ_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0, max_completion_tokens: maxCompletionTokens,
      ...(model === 'qwen/qwen3.8-27b' ? { reasoning_effort: 'none' } : {}),
      response_format: { type: 'json_object' }, messages: [
        { role: 'system', content: GROQ_SYSTEM_PREFIX + instruction },
        { role: 'user', content: JSON.stringify(data) },
      ] }),
  });
  if (!response.ok) {
    const retry = response.headers.get('retry-after');
    const seconds = retry ? (/^\d+(\.\d+)?$/.test(retry) ? Number(retry) : (Date.parse(retry) - Date.now()) / 1000) : NaN;
    throw new ProviderError(response.status, Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds)) : null);
  }
  const body = await response.json();
  if (body.choices?.[0]?.finish_reason !== 'stop') throw new Error('Incomplete provider response');
  return JSON.parse(body.choices[0].message.content);
}
export function boundedFields(source: Record<string, unknown>, fields: string[], total = 6000) {
  const limit = Math.floor(total / fields.length);
  return Object.fromEntries(fields.map(field => [field, tokenizer.decode(tokenizer.encode(professionalText(source[field])).slice(0, limit))]));
}
export function stageDiagnostic(runId: unknown, stage: string, elapsedMs: number, attempt: unknown, error?: unknown) {
  console.info(JSON.stringify({ event: 'matching_stage', run_id: runId ?? null, stage,
    elapsed_ms: Math.round(elapsedMs), attempt: attempt ?? null,
    error_code: error instanceof DatabaseError ? error.code : error instanceof ProviderError ? String(error.status) : error ? 'processing_error' : null }));
}
export function diagnostics(error: unknown) {
  // Do not log provider bodies, candidate text, authorization headers or credentials.
  console.error(error instanceof HttpError ? `Matching HTTP ${error.status}` : error instanceof Error && /^(Database operation failed:|Embedding provider HTTP|Assessment provider HTTP|Missing configuration:)/.test(error.message) ? error.message : 'Matching processing error');
}
