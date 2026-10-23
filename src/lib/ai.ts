import { AI_API_KEY, AI_BASE_URL, AI_MODEL } from 'astro:env/server';

// Hanya dipanggil dari server. Key tidak pernah dikirim ke browser atau ditulis ke log.
export class AiError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export const aiFail = (e: unknown) => {
  const err = e instanceof AiError ? e : new AiError('AI request failed');
  if (!(e instanceof AiError)) console.error('ai', (e as Error)?.message);
  return new Response(JSON.stringify({ error: err.message }), { status: err.status, headers: { 'Content-Type': 'application/json' } });
};

// Schema (format lama, huruf besar) dijadikan petunjuk teks: router OpenAI-compatible hanya menjamin JSON valid, bukan bentuknya.
const shape = (schema: any) =>
  Object.entries(schema.properties as Record<string, { type: string; desc?: string }>)
    .map(([k, v]) => `"${k}": ${v.desc ?? (v.type === 'ARRAY' ? 'array of strings' : 'string')}`)
    .join(', ');

/** Gabungkan stream SSE (`data: {chunk}` per baris) jadi satu objek berbentuk non-stream. null bila bukan SSE. */
function fromSse(raw: string): any {
  let content = '';
  let finish: string | undefined;
  let error: unknown;
  let usage: unknown;
  let seen = false;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const d = line.slice(5).trim();
    if (!d || d === '[DONE]') continue;
    let j: any;
    try { j = JSON.parse(d); } catch { continue; }
    seen = true;
    if (j.error) error = j.error;
    const c = j.choices?.[0];
    content += c?.delta?.content ?? c?.message?.content ?? '';
    if (c?.finish_reason) finish = c.finish_reason;
    if (j.usage) usage = j.usage;
  }
  if (!seen) return null;
  return error ? { error } : { choices: [{ message: { content }, finish_reason: finish }], usage };
}

/** Satu panggilan chat/completions (OpenAI-compatible). Output tetap harus divalidasi pemanggil. */
async function chat(system: string, prompt: string, maxTokens: number, json: boolean): Promise<{ text: string; finish?: string }> {
  if (!AI_API_KEY) throw new AiError('AI is not configured (AI_API_KEY is empty).', 503);
  let res: Response;
  try {
    res = await fetch(`${AI_BASE_URL.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        stream: false, // router ini tetap membalas SSE; fromSse() menangani keduanya
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (e) {
    throw new AiError((e as Error).name === 'TimeoutError' ? 'AI timed out. Try again.' : 'AI is unreachable. Try again.', 504);
  }
  if (!res.ok) {
    console.error('ai status', res.status); // body sengaja tidak dilog
    throw new AiError(res.status === 429 ? 'AI quota exceeded. Try again later.' : [400, 401, 403, 404].includes(res.status) ? `AI rejected the request (${res.status}). Check AI_API_KEY / AI_BASE_URL / AI_MODEL.` : `AI error (${res.status}).`);
  }
  const raw = await res.text();
  let data: any = null;
  try { data = JSON.parse(raw); } catch { data = fromSse(raw); }

  // Router kadang membalas 200 dengan {error:{message}}: tampilkan, jangan disamarkan jadi "invalid output".
  const apiErr = data?.error?.message ?? (typeof data?.error === 'string' ? data.error : '');
  if (apiErr) {
    console.error('ai api error', String(apiErr).slice(0, 300));
    throw new AiError(`AI error: ${String(apiErr).slice(0, 160)}`);
  }

  const choice = data?.choices?.[0];
  if (data?.usage) console.log('ai usage', data.usage); // prompt_tokens / completion_tokens / total_tokens per panggilan
  if (choice?.finish_reason === 'length') throw new AiError('AI output was cut off. Shorten the outline or retry.');
  // Bentuk isi yang umum: message.content (string / array part), choices[].text, output_text.
  const content = choice?.message?.content ?? choice?.text ?? data?.output_text ?? data?.content;
  const text = Array.isArray(content) ? content.map((p: { text?: string }) => p?.text ?? '').join('') : String(content ?? '');
  const clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (!clean) {
    // Respons AI tidak memuat key; potongan awal cukup untuk melihat bentuknya.
    console.error('ai unexpected response', { http: res.status, ctype: res.headers.get('content-type'), body: raw.slice(0, 500) });
  }
  return { text: clean, finish: choice?.finish_reason };
}

/** Output JSON (untuk keluaran pendek, mis. kerangka). */
export async function aiJson<T>(system: string, prompt: string, schema: object, maxTokens = 8192): Promise<T> {
  const { text, finish } = await chat(`${system}\nRespond with ONE JSON object only, no prose, no code fences. Keys: ${shape(schema)}.`, prompt, maxTokens, true);
  const parsed = extractJson<T>(text);
  if (parsed === null) {
    // Diagnosis tanpa membocorkan key; potongan awal/akhir cukup untuk melihat pola (prose, pagar, terpotong).
    console.error('ai invalid output', { finish, len: text.length, head: text.slice(0, 160), tail: text.slice(-160) });
    throw new AiError(`AI returned invalid output (finish=${finish ?? '?'}, length=${text.length}). Retry.`);
  }
  return parsed;
}

/** Teks bebas (untuk keluaran panjang: artikel). Pemanggil mem-parse penandanya. */
export async function aiText(system: string, prompt: string, maxTokens = 8192): Promise<string> {
  const { text, finish } = await chat(system, prompt, maxTokens, false);
  if (!text) {
    console.error('ai empty output', { finish });
    throw new AiError(`AI returned an empty response (finish=${finish ?? '?'}). Check AI_MODEL / AI_BASE_URL.`);
  }
  return text;
}

/** JSON.parse yang toleran: buang pagar ```, teks pembuka/penutup, dan <think>…</think>. null bila tetap gagal. */
export function extractJson<T>(s: string): T | null {
  const t = s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const cands = [t, t.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim()];
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a !== -1 && b > a) cands.push(t.slice(a, b + 1));
  for (const c of cands) {
    try {
      const v = JSON.parse(c);
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as T;
    } catch { /* coba kandidat berikutnya */ }
  }
  return null;
}
