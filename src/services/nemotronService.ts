// Video analysis via remote video URL (Nemotron schema)
export async function generateNemotronVideoByUrl(prompt: string, videoUrl: string, opts?: { fps?: number, maxTokens?: number }): Promise<{ success: boolean, text?: string, error?: string }> {
  const key = getNemotronApiKey();
  if (!key) return { success: false, error: 'Nemotron API key missing (set VITE_NVIDIA_API_KEY).' };
  try {
    const base = getNemotronBase();
    const model = getNemotronModel();
    const body = {
      model,
      type: 'video_url',
      video_url: { url: videoUrl },
      media_io_kwargs: opts?.fps ? { video: { fps: opts.fps } } : undefined,
      messages: [
        { role: 'user', content: prompt }
      ],
      max_tokens: opts?.maxTokens ?? getNumberOverride('VITE_NEMOTRON_MAX_TOKENS', 1024)
    };
    const resp = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const t = await resp.text();
      return { success: false, error: `Nemotron video error (${resp.status}): ${t.slice(0, 180)}` };
    }
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content || data?.result || data?.description || data?.text || '(empty response)';
    return { success: true, text };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}
// NVIDIA Nemotron Nano 12B 2 VL integration stubs
// Provides text + vision (image understanding) only. Image generation/video are unsupported and will fallback.
import { TextGenerationResponse, VisionResponse, ChatMessage } from '../types';
import { authenticatedFetch } from '../lib/api';

function getNemotronApiKey(): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const envAny = import.meta as any;
  const viteVal = envAny?.env?.VITE_NVIDIA_API_KEY as string | undefined;
  // runtime overrides
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const winVal = typeof window !== 'undefined' ? (window as any)?.VITE_NVIDIA_API_KEY as (string | undefined) : undefined;
  const lsVal = typeof window !== 'undefined' ? window.localStorage?.getItem('VITE_NVIDIA_API_KEY') ?? undefined : undefined;
  return viteVal || winVal || lsVal;
}

function getNemotronBase(): string {
  // Allow override, default placeholder
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const envAny = import.meta as any;
  const base = envAny?.env?.VITE_NVIDIA_BASE_URL || (typeof window !== 'undefined' ? (window as any)?.VITE_NVIDIA_BASE_URL : undefined) || 'https://api.nvidia.com';
  return base.replace(/\/$/, '');
}

function getNemotronModel(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const envAny = import.meta as any;
  const m = envAny?.env?.VITE_NVIDIA_MODEL || (typeof window !== 'undefined' ? (window as any)?.VITE_NVIDIA_MODEL : undefined) || 'nvidia/nemotron-nano-12b-v2-vl';
  return m;
}

function getNumberOverride(name: string, fallback: number): number {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const envAny = import.meta as any;
    const envVal = envAny?.env?.[name];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const winVal = typeof window !== 'undefined' ? (window as any)?.[name] : undefined;
    const lsVal = typeof window !== 'undefined' ? window.localStorage?.getItem(name) ?? undefined : undefined;
    const raw = (lsVal ?? winVal ?? envVal);
    const n = raw != null ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
  } catch { return fallback; }
}

function missingKeyResponse(): TextGenerationResponse {
  return { success: false, error: 'Nemotron API key missing (set VITE_NVIDIA_API_KEY).' };
}

export async function generateNemotronText(prompt: string, systemInstruction: string | undefined, temperature: number): Promise<TextGenerationResponse> {
  const key = getNemotronApiKey();
  if (!key) return missingKeyResponse();
  try {
    const base = getNemotronBase();
    const model = getNemotronModel();
    // Align with Nemotron chat completion schema
    const body = {
      model,
      messages: [
        ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
        { role: 'user', content: prompt }
      ],
      temperature,
      max_tokens: getNumberOverride('VITE_NEMOTRON_MAX_TOKENS', 1024),
      stream: false
    } as any;
    // Use backend proxy
    const response = await authenticatedFetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const t = await response.text();
      return { success: false, error: `Backend error (${response.status}): ${t}` };
    }
    const data = await response.json();
    // Attempt common response field extraction
    const text = data?.choices?.[0]?.message?.content || data?.text || JSON.stringify(data).slice(0, 320);
    return { success: true, text, sources: [] };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function generateNemotronVision(prompt: string, imageBase64: string, mimeType: string): Promise<VisionResponse> {
  const key = getNemotronApiKey();
  if (!key) return { success: false, error: 'Nemotron API key missing (set VITE_NVIDIA_API_KEY).' };
  try {
    const base = getNemotronBase();
    const model = getNemotronModel();
    // Use chat completions with multi-part content (text + image via data URL)
    const dataUrl = `data:${mimeType};base64,${imageBase64}`;
    const body = {
      model,
      messages: [
        {
          role: 'user', content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ],
      max_tokens: getNumberOverride('VITE_NEMOTRON_VISION_MAX_TOKENS', 800),
      stream: false
    } as any;
    // Use backend proxy
    const response = await authenticatedFetch('/api/vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const t = await response.text();
      return { success: false, error: `Backend error (${response.status}): ${t}` };
    }
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || data?.result || data?.description || data?.text || '(empty response)';
    return { success: true, text };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// Vision via remote image URL (no base64 conversion required)
export async function generateNemotronVisionByUrl(prompt: string, imageUrl: string): Promise<VisionResponse> {
  const key = getNemotronApiKey();
  if (!key) return { success: false, error: 'Nemotron API key missing (set VITE_NVIDIA_API_KEY).' };
  try {
    const base = getNemotronBase();
    const model = getNemotronModel();
    const body = {
      model,
      messages: [
        {
          role: 'user', content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ],
      max_tokens: getNumberOverride('VITE_NEMOTRON_VISION_MAX_TOKENS', 800),
      stream: false
    } as any;
    const resp = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const t = await resp.text();
      return { success: false, error: `Nemotron vision error (${resp.status}): ${t.slice(0, 180)}` };
    }
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content || data?.result || data?.description || data?.text || '(empty response)';
    return { success: true, text };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export function isNemotronConfigured(): boolean {
  return !!getNemotronApiKey();
}

export function unsupportedImageGeneration(): TextGenerationResponse {
  return { success: false, error: 'Nemotron model does not support image generation. Using Stability / local SD instead.' };
}

// Lightweight health check for Nemotron: verifies key presence and attempts a tiny request.
export async function checkNemotronHealth(): Promise<{ ok: boolean; message: string }> {
  if (!isNemotronConfigured()) {
    return { ok: false, message: 'Nemotron key not configured' };
  }
  try {
    const resp = await generateNemotronText('ping', 'Health check: reply with "pong" only.', 0);
    if (resp.success) {
      return { ok: true, message: 'Nemotron reachable' };
    }
    return { ok: false, message: resp.error || 'Nemotron responded with error' };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

// ---------- Optional NVIDIA image/video endpoints ----------
function getNvidiaImageUrl(): string | undefined {
  // Allow full override; fallback to base + common path only if explicitly opted in via flag
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const envAny = import.meta as any;
  const explicit = envAny?.env?.VITE_NVIDIA_IMAGE_URL as string | undefined;
  const winVal = typeof window !== 'undefined' ? (window as any)?.VITE_NVIDIA_IMAGE_URL as (string | undefined) : undefined;
  const lsVal = typeof window !== 'undefined' ? window.localStorage?.getItem('VITE_NVIDIA_IMAGE_URL') ?? undefined : undefined;
  if (explicit || winVal || lsVal) return explicit || winVal || lsVal;
  // default to base images endpoint
  const base = getNemotronBase();
  return `${base}/v1/images/generations`;
}

function getNvidiaVideoUrl(): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const envAny = import.meta as any;
  const explicit = envAny?.env?.VITE_NVIDIA_VIDEO_URL as string | undefined;
  const winVal = typeof window !== 'undefined' ? (window as any)?.VITE_NVIDIA_VIDEO_URL as (string | undefined) : undefined;
  const lsVal = typeof window !== 'undefined' ? window.localStorage?.getItem('VITE_NVIDIA_VIDEO_URL') ?? undefined : undefined;
  if (explicit || winVal || lsVal) return explicit || winVal || lsVal;
  // default to base video endpoint
  const base = getNemotronBase();
  return `${base}/v1/video/generations`;
}

export async function generateNemotronImage(opts: {
  prompt: string;
  width: number; height: number; steps: number; cfgScale: number;
  negativePrompt?: string; format: string;
}): Promise<{ success: boolean; url?: string; error?: string }> {
  const key = getNemotronApiKey();
  if (!key) return { success: false, error: 'Nemotron API key missing (set VITE_NVIDIA_API_KEY).' };
  const url = getNvidiaImageUrl();
  try {
    const body: any = {
      model: getNemotronModel(),
      prompt: opts.prompt,
      size: `${opts.width}x${opts.height}`,
      steps: opts.steps,
      guidance: opts.cfgScale,
      negative_prompt: opts.negativePrompt || '',
      response_format: 'b64_json',
    };
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` }, body: JSON.stringify(body) });
    if (!resp.ok) { const t = await resp.text(); return { success: false, error: `NVIDIA image error (${resp.status}): ${t.slice(0, 180)}` }; }
    const data = await resp.json();
    // Try common fields
    const imageUrl: string | undefined = data?.data?.[0]?.url || data?.url || data?.image_url;
    const b64: string | undefined = data?.data?.[0]?.b64_json || data?.b64;
    if (imageUrl) return { success: true, url: imageUrl };
    if (b64) return { success: true, url: 'data:image/png;base64,' + b64 };
    return { success: false, error: 'NVIDIA image response missing URL/data' };
  } catch (e) { return { success: false, error: (e as Error).message }; }
}

export async function generateNemotronVideo(opts: { prompt: string; durationSec?: number; width?: number; height?: number }): Promise<{ success: boolean; url?: string; error?: string }> {
  const key = getNemotronApiKey();
  if (!key) return { success: false, error: 'Nemotron API key missing (set VITE_NVIDIA_API_KEY).' };
  const url = getNvidiaVideoUrl();
  try {
    const body: any = { model: getNemotronModel(), prompt: opts.prompt, duration: opts.durationSec, width: opts.width, height: opts.height, fps: 24, num_frames: undefined };
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` }, body: JSON.stringify(body) });
    if (!resp.ok) { const t = await resp.text(); return { success: false, error: `NVIDIA video error (${resp.status}): ${t.slice(0, 180)}` }; }
    const data = await resp.json();
    const videoUrl: string | undefined = data?.data?.[0]?.url || data?.url || data?.video_url;
    if (videoUrl) return { success: true, url: videoUrl };
    return { success: false, error: 'NVIDIA video response missing URL' };
  } catch (e) { return { success: false, error: (e as Error).message }; }
}

// ---- Health checks for NVIDIA image/video endpoints ----
export async function checkNvidiaImageHealth(): Promise<{ ok: boolean; message: string }> {
  return { ok: false, message: 'Image health check disabled (proxy not implemented)' };
}

export async function checkNvidiaVideoHealth(): Promise<{ ok: boolean; message: string }> {
  return { ok: false, message: 'Video health check disabled (proxy not implemented)' };
}

// ---- Streaming chat for Nemotron (SSE/NDJSON tolerant) ----
export async function* streamNemotronChat(history: ChatMessage[], message: string, temperature: number): AsyncGenerator<TextGenerationResponse> {
  // Fallback to non-streaming proxy for now
  const response = await generateNemotronText(message, undefined, temperature);
  yield response;
}
