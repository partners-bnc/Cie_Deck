import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allLines = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items.filter((item) => item.str.trim().length > 0);

    if (items.length === 0) continue;

    const lineMap = new Map();
    const yThreshold = 3;

    for (const item of items) {
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];

      let foundKey = null;
      for (const key of lineMap.keys()) {
        if (Math.abs(key - y) <= yThreshold) {
          foundKey = key;
          break;
        }
      }

      if (foundKey !== null) {
        lineMap.get(foundKey).push({ x, text: item.str });
      } else {
        lineMap.set(y, [{ x, text: item.str }]);
      }
    }

    const sortedYs = [...lineMap.keys()].sort((a, b) => b - a);

    for (const y of sortedYs) {
      const lineItems = lineMap.get(y).sort((a, b) => a.x - b.x);
      let lineText = '';

      for (let j = 0; j < lineItems.length; j++) {
        const item = lineItems[j];
        if (j > 0) {
          const prevItem = lineItems[j - 1];
          const gap = item.x - (prevItem.x + prevItem.text.length * 3.5);
          if (gap > 2 || lineText.length === 0 || !lineText.endsWith(' ')) {
            lineText += ' ';
          }
        }
        lineText += item.text;
      }

      const cleaned = lineText.replace(/\s+/g, ' ').trim();
      if (cleaned.length > 0) {
        allLines.push(cleaned);
      }
    }

    if (i < pdf.numPages) {
      allLines.push('');
    }
  }

  return allLines.join('\n');
}

async function extractTextFromDOCX(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractText(file) {
  if (file.type === 'application/pdf') {
    return extractTextFromPDF(file);
  }

  if (
    file.type === 'application/msword' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return extractTextFromDOCX(file);
  }

  throw new Error('Unsupported file type');
}

async function fileToBase64(file) {
  const arrayBuffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

const GEMINI_API_KEY =
  (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) ||
  import.meta.env.VITE_GEMINI_API_KEY;
const GROQ_MODEL = 'qwen/qwen3.8-27b';
const GROQ_API_KEYS = [
  import.meta.env.VITE_GROQ_API_KEY,
  import.meta.env.VITE_GROQ_API_KEY_1,
  import.meta.env.VITE_GROQ_API_KEY_2,
  import.meta.env.VITE_GROQ_API_KEY_3,
].map((key) => key?.trim()).filter((key, idx, arr) => Boolean(key) && arr.indexOf(key) === idx);
const NORMALIZED_GEMINI_API_KEY = GEMINI_API_KEY?.trim();
const NORMALIZED_GROQ_API_KEY = (GROQ_API_KEYS[0] || import.meta.env.VITE_GROQ_API_KEY)?.trim();
const VALID_EXPERIENCE_VALUES = ['0', '1', '2', '3', '4', '5', '6-10', '10+'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getGroqKeyCount() {
  return Math.max(GROQ_API_KEYS.length, 1);
}

function getResumePrompt(resumeText, extended = false) {
  const extraFields = extended ? `,
  "skills": "Comma-separated list of all technical skills, tools, technologies, soft skills, and domain keywords found in the resume (string or null)",
  "certifications": "Comma-separated list of all certifications, courses, and licenses found in the resume (string or null)",
  "summary": "A concise 2-3 sentence professional summary of the candidate based on their experience, skills, and background (string or null)"` : '';

  return `You are a resume parser. Analyze the following resume text and extract the requested information.

RESUME TEXT:
"""
${resumeText.substring(0, 6000)}
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

async function fetchWithRetry(url, options, maxRetries = 1) {
  let attempts = 0;
  while (attempts <= maxRetries) {
    const response = await fetch(url, options);
    if (response.status === 429 && attempts < maxRetries) {
      console.warn(`Rate limited (429). Retrying in 5s... (Attempt ${attempts + 1})`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
      continue;
    }
    return response;
  }
}

async function extractFieldsWithGemini(resumeText, extended = false, file = null) {
  if (!NORMALIZED_GEMINI_API_KEY || NORMALIZED_GEMINI_API_KEY.length <= 10) {
    throw new Error('Gemini API key is not configured.');
  }

  const prompt = getResumePrompt(resumeText, extended);
  const parts = [];

  if (
    file &&
    (file.type === 'application/pdf' || file.type.startsWith('image/'))
  ) {
    parts.push({
      inline_data: {
        mime_type: file.type,
        data: await fileToBase64(file),
      },
    });
  }

  parts.push({ text: prompt });

  const response = await fetchWithRetry(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': NORMALIZED_GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  const data = await response.json();

  if (response.ok) {
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error('Empty response from Gemini');
    return JSON.parse(content);
  }

  const apiMessage =
    data?.error?.message ||
    data?.promptFeedback?.blockReason ||
    `Gemini API error: ${response.status}`;
  throw new Error(apiMessage);
}

async function extractFieldsWithAdminGroq(resumeText, extended = true, rotationIndex = 0) {
  const response = await fetch('/api/admin/parse-resume', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      resumeText,
      extended,
      rotationIndex,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || `Admin parse API error: ${response.status}`);
  }

  return {
    parsed: payload?.parsed || {},
    keyIndex: payload?.keyIndex ?? null,
  };
}

async function extractFieldsWithClientGroqRotation(resumeText, extended = true, rotationIndex = 0) {
  if (!GROQ_API_KEYS.length) {
    throw new Error('No local Groq rotation keys configured. Add VITE_GROQ_API_KEY, VITE_GROQ_API_KEY_1, or VITE_GROQ_API_KEY_2 to .env.');
  }

  const prompt = getResumePrompt(resumeText, extended);
  const maxAttempts = Math.max(GROQ_API_KEYS.length * 2, 6);
  const normalizedStart = ((rotationIndex % GROQ_API_KEYS.length) + GROQ_API_KEYS.length) % GROQ_API_KEYS.length;
  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const keyIndex = (normalizedStart + attempt) % GROQ_API_KEYS.length;
    const currentKey = GROQ_API_KEYS[keyIndex];

    const response = await fetch('/api/groq/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentKey}`,
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

    if (response.ok) {
      const payload = JSON.parse(rawText);
      const content = payload?.choices?.[0]?.message?.content;
      if (!content) {
        lastError = new Error('Empty response from Groq');
      } else {
        return {
          parsed: JSON.parse(content),
          keyIndex,
        };
      }
    } else {
      lastError = new Error(`Groq API error: ${response.status} ${rawText.substring(0, 120)}`);
    }

    const retryable = response.status === 429 || response.status >= 500 || String(lastError.message).toLowerCase().includes('rate limit');
    if (!retryable || attempt === maxAttempts - 1) {
      break;
    }

    await sleep(1500);
  }

  throw lastError || new Error('Groq parsing failed');
}

async function extractFieldsWithAdminFallback(resumeText, extended = true, rotationIndex = 0) {
  try {
    return await extractFieldsWithAdminGroq(resumeText, extended, rotationIndex);
  } catch (error) {
    if (GROQ_API_KEYS.length > 0) {
      return extractFieldsWithClientGroqRotation(resumeText, extended, rotationIndex);
    }
    throw error;
  }
}

async function parseFieldsWithPrimaryGroq(resumeText, extended = false, rotationIndex = 0, file = null) {
  let groqFailure = null;
  const hasText = Boolean(resumeText && resumeText.trim().length >= 20);

  // 1. Primary: If readable text was extracted, attempt Groq with rotation first
  if (hasText) {
    try {
      const groqRes = await extractFieldsWithAdminFallback(resumeText, extended, rotationIndex);
      if (groqRes?.parsed && Object.keys(groqRes.parsed).length > 0) {
        return groqRes.parsed;
      }
    } catch (err) {
      console.warn('Primary Groq parsing failed, attempting Gemini fallback...', err);
      groqFailure = err;
    }
  }

  // 2. Fallback to Gemini (supports scanned/image PDFs or Groq failover)
  const canUseGemini = Boolean(NORMALIZED_GEMINI_API_KEY && NORMALIZED_GEMINI_API_KEY.length > 10);
  if (canUseGemini && (file || hasText)) {
    try {
      return await extractFieldsWithGemini(resumeText || '', extended, file);
    } catch (geminiErr) {
      console.error('Gemini fallback failed:', geminiErr);
      if (groqFailure) throw groqFailure;
      throw geminiErr;
    }
  }

  if (groqFailure) {
    throw groqFailure;
  }

  if (!hasText) {
    throw new Error('Could not extract readable text from this resume. The PDF may be image-based or corrupted.');
  }

  throw new Error('No AI API keys configured for resume parsing.');
}

function normalizeParsedFields(extracted, extended = false) {
  const result = {
    data: {},
    autoFilledFields: new Set(),
  };

  const fieldMap = {
    candidateName: extracted.candidateName,
    email: extracted.email,
    contactNumber: extracted.contactNumber,
    currentLocation: extracted.currentLocation,
    education: extracted.recentEducation,
    totalExperience: extracted.totalExperience,
    currentCompany: extracted.currentCompany,
    currentPosition: extracted.currentPosition,
    ...(extended
      ? {
          skills: extracted.skills,
          certifications: extracted.certifications,
          summary: extracted.summary,
        }
      : {}),
  };

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value === null || value === undefined || value === '') continue;

    if (key === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) continue;
    }

    if (key === 'totalExperience' && !VALID_EXPERIENCE_VALUES.includes(value)) {
      continue;
    }

    result.data[key] = value;
    result.autoFilledFields.add(key);
  }

  return result;
}

function canUseGeminiDocumentInput(file) {
  return Boolean(NORMALIZED_GEMINI_API_KEY && NORMALIZED_GEMINI_API_KEY.length > 10) &&
    file &&
    file.type === 'application/pdf';
}

function ensureIdentifyingFields(result) {
  const hasMinimum = result.data.candidateName || result.data.email || result.data.contactNumber;
  if (!hasMinimum) {
    throw new Error('AI could not extract any identifying information (name, email, or phone) from this resume. Please check the file quality.');
  }
}

export async function parseResume(file, onProgress) {
  const result = {
    data: {},
    autoFilledFields: new Set(),
  };

  try {
    if (onProgress) onProgress('extracting');
    const text = await extractText(file);

    if (onProgress) onProgress('contact');

    const extracted = await parseFieldsWithPrimaryGroq(text, false, 0, file);

    if (onProgress) onProgress('education');

    const fieldMap = {
      candidateName: extracted.candidateName,
      email: extracted.email,
      contactNumber: extracted.contactNumber,
      currentLocation: extracted.currentLocation,
      recentEducation: extracted.recentEducation,
      totalExperience: extracted.totalExperience,
      currentCompany: extracted.currentCompany,
      currentPosition: extracted.currentPosition,
    };

    if (onProgress) onProgress('experience');

    for (const [key, value] of Object.entries(fieldMap)) {
      if (value !== null && value !== undefined && value !== '') {
        if (key === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) continue;
        }

        if (key === 'totalExperience') {
          if (!VALID_EXPERIENCE_VALUES.includes(value)) continue;
        }

        result.data[key] = value;
        result.autoFilledFields.add(key);
      }
    }

    if (onProgress) onProgress('done');
  } catch (error) {
    console.error('Resume parsing error:', error);
    if (onProgress) onProgress('error');
  }

  return result;
}

export async function parseResumeForDatabase(file, onProgress) {
  if (onProgress) onProgress('extracting');
  const text = await extractText(file);

  if (onProgress) onProgress('contact');

  const extracted = await parseFieldsWithPrimaryGroq(text, true, 0, file);

  if (onProgress) onProgress('education');
  const result = normalizeParsedFields(extracted, true);
  if (onProgress) onProgress('experience');

  ensureIdentifyingFields(result);

  if (onProgress) onProgress('done');
  return result;
}

export async function parseResumeForDatabaseWithRotation(file, rotationIndex = 0, onProgress) {
  if (onProgress) onProgress('extracting');
  const text = await extractText(file);

  if (onProgress) onProgress('contact');

  const extracted = await parseFieldsWithPrimaryGroq(text, true, rotationIndex, file);

  if (onProgress) onProgress('education');
  const result = normalizeParsedFields(extracted, true);
  if (onProgress) onProgress('experience');

  ensureIdentifyingFields(result);

  if (onProgress) onProgress('done');
  return result;
}
