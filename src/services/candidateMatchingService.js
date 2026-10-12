import { supabase } from './supabaseClient.js';

export const matchingEnabled = import.meta.env.VITE_CANDIDATE_MATCHING_ENABLED === 'true';

async function call(action, jobId, values = {}) {
  const { data, error } = await supabase.functions.invoke('candidate-matching', { body: { action, jobId, ...values } });
  if (error) {
    let message = 'Matching is unavailable. Please retry.';
    if (error.context instanceof Response) {
      try { message = (await error.context.json()).error || message; } catch { /* retain safe message */ }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export const candidateMatchingService = {
  latest: jobId => call('latest', jobId),
  prepare: (jobId, refresh = false) => call('prepare', jobId, { refresh }),
  status: (jobId, runId) => call('status', jobId, { runId }),
  retryAssessment: (jobId, runId) => call('retry-assessment', jobId, { runId }),
  verifyTag: (jobId, runId, applicantId) => call('verify-tag', jobId, { runId, applicantId }),
};
