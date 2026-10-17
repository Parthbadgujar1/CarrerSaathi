/**
 * Thin REST clients for each LLM provider. We call the HTTP APIs directly
 * with fetch (no vendor SDKs) to keep the dependency surface small and the
 * request/response shapes fully under our control.
 */
export class ProviderError extends Error {
  constructor(message, { status, kind, retryAfterMs } = {}) {
    super(message);
    this.status = status;
    this.kind = kind; // 'auth' | 'rate' | 'server' | 'timeout' | 'bad_output' | 'network'
    this.retryAfterMs = retryAfterMs;
  }
}

function classify(status, bodyText, headers) {
  const retryAfter = Number(headers?.get?.('retry-after'));
  const retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined;
  if (status === 401 || status === 403) return new ProviderError('Invalid or unauthorised API key', { status, kind: 'auth' });
  if (status === 429) return new ProviderError('Rate limited / quota exceeded', { status, kind: 'rate', retryAfterMs });
  if (status === 404 || status === 400) {
    return new ProviderError(`Request rejected (${status}): ${bodyText.slice(0, 160)}`, { status, kind: 'bad_request' });
  }
  return new ProviderError(`Provider error ${status}`, { status, kind: 'server' });
}

async function postJSON(url, headers, body, timeoutMs) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const timeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    throw new ProviderError(timeout ? 'Request timed out' : `Network error: ${err.message}`, { kind: timeout ? 'timeout' : 'network' });
  }
  const text = await res.text();
  if (!res.ok) throw classify(res.status, text, res.headers);
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError('Provider returned non-JSON response', { kind: 'bad_output' });
  }
}

/** OpenAI-compatible chat completions (used by both OpenAI and Groq). */
async function openAICompatible(baseUrl, { key, model, system, messages, json, maxTokens, temperature, timeoutMs }) {
  const isReasoningModel = /^(o\d|gpt-5)/i.test(model);
  const body = {
    model,
    messages: [{ role: 'system', content: system }, ...messages],
    ...(isReasoningModel ? {} : { temperature }),
    max_completion_tokens: maxTokens,
    ...(json ? { response_format: { type: 'json_object' } } : {}),
  };
  const data = await postJSON(`${baseUrl}/chat/completions`, { authorization: `Bearer ${key}` }, body, timeoutMs);
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new ProviderError('Empty completion', { kind: 'bad_output' });
  return text;
}

export const providers = {
  groq: {
    label: 'Groq',
    call: (opts) => openAICompatible('https://api.groq.com/openai/v1', opts),
  },
  openai: {
    label: 'OpenAI',
    call: (opts) => openAICompatible('https://api.openai.com/v1', opts),
  },
  gemini: {
    label: 'Google Gemini',
    async call({ key, model, system, messages, json, maxTokens, temperature, timeoutMs }) {
      const generationConfig = {
        temperature,
        maxOutputTokens: maxTokens,
        ...(json ? { responseMimeType: 'application/json' } : {}),
        // 2.5 Flash "thinking" tokens cost money and eat the output budget; disable for these simple tasks.
        ...(/2\.5-flash/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      };
      const body = {
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig,
      };
      // Key goes in a header, never in the URL (URLs end up in logs).
      const data = await postJSON(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        { 'x-goog-api-key': key },
        body,
        timeoutMs,
      );
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('');
      if (!text) throw new ProviderError('Empty completion', { kind: 'bad_output' });
      return text;
    },
  },
};
