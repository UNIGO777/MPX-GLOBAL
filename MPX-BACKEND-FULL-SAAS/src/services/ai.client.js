import OpenAI from 'openai';

import { env } from '../config/env.js';

// Thin wrapper so the rest of the code never imports the SDK directly — one
// place to mock in tests, one place to change a model or a timeout.
//
// SECURITY: the key lives ONLY in env and never leaves the server. It must not
// appear in a response, a log line, or an error message (auth-sessions /
// secrets-and-hygiene). Callers surface a generic failure and fall back.

const MODEL = 'gpt-4o-mini';
const TIMEOUT_MS = 8000;
// 400 since 2026-08-16: the extraction JSON now also carries the buyer-facing
// "message" sentence(s) — 300 left it at risk of truncating mid-JSON.
const MAX_TOKENS = 400;

let client;

export function isAiConfigured() {
  return Boolean(env.OPENAI_API_KEY);
}

function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: TIMEOUT_MS, maxRetries: 0 });
  }
  return client;
}

/**
 * ONE chat completion, deterministic, small. Returns the raw assistant string;
 * parsing and validation are the caller's job (a model can always answer with
 * something unexpected, so nothing here trusts the shape).
 */
export async function completeJson({ system, user }) {
  const res = await getClient().chat.completions.create({
    model: MODEL,
    temperature: 0,
    max_tokens: MAX_TOKENS,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  return res.choices?.[0]?.message?.content ?? '';
}
