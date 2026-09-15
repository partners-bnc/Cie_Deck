const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'qwen/qwen3.8-27b';
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const MAX_KEY_ATTEMPTS = 6;

function getResumePrompt(resumeText, extended = false) {
  const extraFields = extended ? `,
  "skills": "Comma-separated list of all technical skills, tools, technologies, soft skills, and domain keywords found in the resume (string or null)",
  "certifications": "Comma-separated list of all certifications, courses, and licenses found in the resume (string or null)",
  "summary": "A concise 2-3 sentence professional summary of the candidate based on their experience, skills, and background (string or null)"` : '';

  return `You are a resume parser. Analyze the following resume text and extract the requested information.

RESUME TEXT:
"""
${String(resumeText || '').substring(0, 6000)}
"""

Extract the following fields from the resume. Return ONLY a valid JSON object with these exact keys. If a field cannot be confidently determined from the resume, set its value to null. Do NOT guess or make up information.

{
  "candidateName": "Full name of the candidate (string or null)",
  "email": "Email address (string or null)",
  "contactNumber": "Phone/mobile number with country code if present (string or null)",
  "currentLocation": "Current city or location (string or null)",
  "recentEducation": "Most recent education details including degree, institution, specialization, and year if available. Include all education entries found, separated by newlines (string or null)",
  "totalExperience": "Total years of professional experience as a number. Use one of these exact values: '0' for fresher, '1', '2', '3', '4', '5' for exact years, '6-10' for 6 to 10 years, '10+' for more than 10 years. (string or null)",
  "currentCompany": "Most recent or current company/organization name (string or null)",
  "currentPosition": "Most recent or current job title/designation (string or null)"${extraFields}
}

IMPORTANT RULES:
- Return ONLY valid JSON, no markdown, no explanation, no code blocks
- For candidateName: This is usually the very first prominent text in the resume
- For totalExperience: Must be one of the exact allowed values listed above
- If you are not confident about a field, return null for that field`;
}

function getConfiguredKeys() {
  const candidates = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.VITE_GROQ_API_KEY,
    process.env.VITE_GROQ_API_KEY_1,
    process.env.VITE_GROQ_API_KEY_2,
    process.env.VITE_GROQ_API_KEY_3,
  ];
  return candidates
    .map((key) => key?.trim())
    .filter((key, idx, arr) => Boolean(key) && arr.indexOf(key) === idx);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractErrorMessage(payload, fallback) {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload;
  return payload.error?.message || payload.message || fallback;
}

function isRetryableError(status, message) {
  if (RETRYABLE_STATUS_CODES.has(status)) return true;

  const text = String(message || '').toLowerCase();
  return (
    text.includes('rate limit') ||
    text.includes('too many requests') ||
    text.includes('timeout') ||
    text.includes('temporar') ||
    text.includes('overloaded')
  );
}

async function callGroq(prompt, apiKey) {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: 'You are a precise resume parser. Return only JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  const rawText = await response.text();
  let payload = null;

  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = rawText;
  }

  if (!response.ok) {
    throw {
      status: response.status,
      message: extractErrorMessage(payload, `Groq API error: ${response.status}`),
    };
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw {
      status: 502,
      message: 'Empty response from Groq',
    };
  }

  return JSON.parse(content);
}

async function parseWithRotation(prompt, keys, rotationIndex = 0) {
  const normalizedStart = Number.isFinite(rotationIndex)
    ? ((rotationIndex % keys.length) + keys.length) % keys.length
    : 0;

  let lastError = null;

  for (let attempt = 0; attempt < MAX_KEY_ATTEMPTS; attempt++) {
    const keyIndex = (normalizedStart + attempt) % keys.length;

    try {
      const parsed = await callGroq(prompt, keys[keyIndex]);
      return { parsed, keyIndex };
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error?.status, error?.message) || attempt === MAX_KEY_ATTEMPTS - 1) {
        break;
      }

      await sleep(1000);
    }
  }

  throw lastError || new Error('Resume parsing failed');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const keys = getConfiguredKeys();
  if (!keys.length) {
    return res.status(500).json({ error: 'Groq API keys are not configured on the server.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const resumeText = String(body.resumeText || '').trim();
    const extended = body.extended !== false;
    const rotationIndex = Number(body.rotationIndex || 0);

    if (resumeText.length < 20) {
      return res.status(400).json({ error: 'Resume text is too short to parse.' });
    }

    const prompt = getResumePrompt(resumeText, extended);
    const { parsed, keyIndex } = await parseWithRotation(prompt, keys, rotationIndex);

    return res.status(200).json({
      success: true,
      parsed,
      keyIndex,
    });
  } catch (error) {
    return res.status(error?.status || 500).json({
      error: error?.message || 'Resume parsing failed.',
    });
  }
}
