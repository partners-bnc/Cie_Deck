// Model metadata only; does not send applicant data or create embeddings/completions.
const key = process.env.OPENAI_API_KEY;
for (const model of ['text-embedding-3-large', 'gpt-5-nano']) {
  if (!key) { console.log(`OpenAI ${model}: server key missing locally`); continue; }
  try {
    const response = await fetch(`https://api.openai.com/v1/models/${model}`, {
      headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000),
    });
    console.log(`OpenAI ${model}: model lookup HTTP ${response.status}`);
  } catch { console.log(`OpenAI ${model}: model lookup failed (network/timeout)`); }
}
console.log('No inference requests made. Model access does not establish billing quota or inference quality.');
