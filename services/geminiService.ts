import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { 
    TextGenerationResponse, 
    VisionResponse, 
    ImageGenerationResponse, 
    ChatMessage,
    TextModel,
    ImageModel,
    AspectRatio,
    ImageStyle,
    JsonGenerationResponse,
    ImageFormat
} from '../types';

// ----------
// Retry helpers
// ----------
function sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
}

function shouldRetryFromMessage(message: string): boolean {
    const m = message.toLowerCase();
    return (
        m.includes('rate limit') ||
        m.includes('exceeded your current quota') ||
        m.includes('quota') ||
        m.includes('rpc failed due to xhr error') ||
        m.includes('[500]') ||
        m.includes('internal ai error') ||
        m.includes('network')
    );
}

async function withRetries<T>(fn: () => Promise<T>, attempts = 2, baseDelayMs = 500): Promise<T> {
    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (error) {
            lastErr = error;
            const friendly = parseError(error);
            if (i < attempts - 1 && shouldRetryFromMessage(friendly)) {
                const jitter = Math.floor(Math.random() * 250);
                await sleep(baseDelayMs * Math.pow(2, i) + jitter);
                continue;
            }
            break;
        }
    }
    throw lastErr;
}

// Use Vite env (client-safe). Lazy-initialize to avoid blocking app load when key is missing.
function getApiKey(): string | undefined {
    // Resolution order (earliest wins):
    // 1. import.meta.env.VITE_GEMINI_API_KEY (build-time injected by Vite)
    // 2. window.VITE_GEMINI_API_KEY (runtime injection by UI/scripts)
    // 3. localStorage['VITE_GEMINI_API_KEY'] (persisted by user action)
    // No process.env usage in client bundle to avoid accidental leakage.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const envAny = import.meta as any;
    const viteVal = envAny?.env?.VITE_GEMINI_API_KEY as string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const winVal = typeof window !== 'undefined' ? (window as any)?.VITE_GEMINI_API_KEY as (string | undefined) : undefined;
    const winAlt = typeof window !== 'undefined' ? (window as any)?.GEMINI_API_KEY as (string | undefined) : undefined;
    const lsVal = typeof window !== 'undefined' ? window.localStorage?.getItem('VITE_GEMINI_API_KEY') ?? undefined : undefined;
    const lsAlt = typeof window !== 'undefined' ? window.localStorage?.getItem('GEMINI_API_KEY') ?? undefined : undefined;
    return viteVal || winVal || lsVal || winAlt || lsAlt;
}

export function isGeminiKeyAvailable(): boolean {
    return !!getApiKey();
}

// ----------
// Local provider (Ollama / SD WebUI) helpers
// ----------
function getLocalFlag(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const envAny = import.meta as any;
    const viteVal = envAny?.env?.VITE_USE_LOCAL_AI as string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const winVal = typeof window !== 'undefined' ? (window as any)?.VITE_USE_LOCAL_AI as (string | undefined) : undefined;
    const lsVal = typeof window !== 'undefined' ? window.localStorage?.getItem('VITE_USE_LOCAL_AI') ?? undefined : undefined;
    const v = (viteVal || winVal || lsVal || '').toString().toLowerCase();
    return v === '1' || v === 'true';
}

function getLocalLLMBase(): string {
    // Base like http://localhost:11434
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const envAny = import.meta as any;
    const v = envAny?.env?.VITE_LOCAL_LLM as string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = typeof window !== 'undefined' ? (window as any)?.VITE_LOCAL_LLM as (string | undefined) : undefined;
    const l = typeof window !== 'undefined' ? window.localStorage?.getItem('VITE_LOCAL_LLM') ?? undefined : undefined;
    return (v || w || l || 'http://localhost:11434').replace(/\/$/, '');
}

function getLocalLLMModel(): string {
    // Default to llama2; allow override via env
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const envAny = import.meta as any;
    const v = envAny?.env?.VITE_LOCAL_LLM_MODEL as string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = typeof window !== 'undefined' ? (window as any)?.VITE_LOCAL_LLM_MODEL as (string | undefined) : undefined;
    const l = typeof window !== 'undefined' ? window.localStorage?.getItem('VITE_LOCAL_LLM_MODEL') ?? undefined : undefined;
    return v || w || l || 'llama2';
}

function getLocalSDEndpoint(): string {
    // Base like http://127.0.0.1:7860
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const envAny = import.meta as any;
    const v = envAny?.env?.VITE_LOCAL_SD as string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = typeof window !== 'undefined' ? (window as any)?.VITE_LOCAL_SD as (string | undefined) : undefined;
    const l = typeof window !== 'undefined' ? window.localStorage?.getItem('VITE_LOCAL_SD') ?? undefined : undefined;
    return (v || w || l || 'http://127.0.0.1:7860').replace(/\/$/, '');
}

let aiClient: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
    if (aiClient) return aiClient;
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("Gemini API key is missing. Set VITE_GEMINI_API_KEY in a .env file (e.g. .env.local) then restart the dev server, or inject window.VITE_GEMINI_API_KEY before first request.");
    }
    aiClient = new GoogleGenAI({ apiKey });
    return aiClient;
}

/**
 * Lightweight API key verification.
 * Attempts a trivial content generation call and returns a status object without throwing.
 */
export async function verifyApiKey(): Promise<{ valid: boolean; error?: string }> {
    try {
        const client = getClient();
        // Use the fastest flash model; extremely small prompt to minimize cost/latency.
        const resp = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'ping'
        });
        // If we get a response text or candidates, treat as valid.
        if (resp.text !== undefined || (resp.candidates && resp.candidates.length > 0)) {
            return { valid: true };
        }
        return { valid: false, error: 'Empty response received from model.' };
    } catch (e: unknown) {
        return { valid: false, error: parseError(e) };
    }
}

// ----------
// Global rate-limit cooldown (simple client-side guard)
// ----------
let rateLimitUntil = 0; // epoch ms when we can resume
let rateLimitHits = 0; // used for incremental cooldown

export function getRateLimitStatus() {
    const now = Date.now();
    return {
        coolingDown: now < rateLimitUntil,
        resumeInMs: Math.max(0, rateLimitUntil - now),
        hits: rateLimitHits,
    };
}

function setCooldownFromErrorMessage(msg: string) {
    if (!msg.includes('RATE_LIMIT:')) return;
    rateLimitHits = Math.min(5, rateLimitHits + 1);
    const base = 1500; // 1.5s
    const backoff = base * Math.pow(2, rateLimitHits - 1);
    const jitter = Math.floor(Math.random() * 500);
    rateLimitUntil = Date.now() + backoff + jitter;
}

// Optional: Hugging Face Inference API token for free image generation fallback
function getHuggingFaceToken(): string | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const envAny = import.meta as any;
    const viteKey = envAny?.env?.VITE_HF_API_TOKEN as string | undefined;
    // Also support Node/test context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeKey = (() => { try { const p = (globalThis as any)?.process; return p?.env?.VITE_HF_API_TOKEN || p?.env?.HF_API_TOKEN; } catch { return undefined; } })() as string | undefined;
    const winKey = (typeof window !== 'undefined' ? (window as any)?.VITE_HF_API_TOKEN : undefined) as string | undefined;
    const lsKey = (typeof window !== 'undefined' ? window.localStorage?.getItem('VITE_HF_API_TOKEN') ?? undefined : undefined);
    return viteKey || nodeKey || winKey || lsKey;
}

function getHuggingFaceModel(): string {
    // Allow override via env; default to a fast, widely-used model
    // Default now targets SDXL Base 1.0 for higher quality outputs.
    // You can set VITE_HF_IMAGE_MODEL to switch (e.g., "black-forest-labs/FLUX.1-schnell").
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const envAny = import.meta as any;
    const model = envAny?.env?.VITE_HF_IMAGE_MODEL as string | undefined;
    return model || "stabilityai/stable-diffusion-xl-base-1.0";
}

// (Stateless chat streaming is used; no active chat session cache required)

// ---------
// Image generation queue to avoid overlapping requests (which can spike rate limits)
// ---------
let imageTaskQueue: Promise<unknown> = Promise.resolve();
function enqueueImageTask<T>(task: () => Promise<T>): Promise<T> {
    const run = () => task();
    const p = imageTaskQueue.then(run, run);
    // Ensure queue continues regardless of task outcome
    imageTaskQueue = p.then(
        () => undefined,
        () => undefined
    );
    return p;
}

/**
 * Robust image generation with layered fallbacks and backoff.
 * - Serializes requests via a queue to reduce rate-limit spikes
 * - Respects global cooldown set by parseError
 * - Provider order:
 *    preferred=imagen: HF (if token) -> Google Imagen -> Nano (on billing or rate-limit)
 *    preferred=nano:   Nano -> HF (if token on rate-limit) -> Google Imagen
 */
export async function generateRobustImage(
    prompt: string,
    style: ImageStyle,
    aspectRatio: AspectRatio,
    preferred: ImageModel,
    format?: ImageFormat,
    advanced?: {
        width?: number;
        height?: number;
        steps?: number;
        guidance?: number;
        modelOverride?: string;
        negativePrompt?: string;
    }
): Promise<ImageGenerationResponse> {
    return enqueueImageTask(async () => {
        const isCoolingDown = Date.now() < rateLimitUntil;
        const hfToken = getHuggingFaceToken();

    // Helper to attempt a provider with minimal retries to reduce API load
    const attempt = async <T>(fn: () => Promise<T>) => withRetries(fn, 1, 600);

    // Providers as small lambdas
    const runHF = () => hfToken ? generateImageViaHuggingFace(prompt, aspectRatio, hfToken, style, format, advanced) : Promise.resolve({ success: false, error: 'Hugging Face token missing.' } as ImageGenerationResponse);
    const runImagenDirect = () => generateImagenOnly(prompt, aspectRatio, format); // Avoid implicit HF attempt
        const runNano = () => generateImageNano(prompt, style, aspectRatio);

        // Direct HF selection: if user explicitly picked 'huggingface', attempt HF first then fall back.
        // Explicit HF selection path
        if (preferred === 'huggingface') {
            const hfDirect = await attempt(runHF) as ImageGenerationResponse;
            if (hfDirect.success) return hfDirect;
            if (isCoolingDown) {
                const status = getRateLimitStatus();
                return { success: false, error: `Rate limiting in effect. Retry after ${(status.resumeInMs/1000).toFixed(1)}s.` };
            }
            // Fallbacks after HF failure
            const imAfterHF = await attempt(runImagenDirect).catch((e) => ({ success: false, error: parseError(e) } as ImageGenerationResponse)) as ImageGenerationResponse;
            if (imAfterHF.success) return { ...imAfterHF, note: 'Fallback to Imagen (HF unavailable).' };
            const nanoAfterHF = await attempt(runNano).catch((e) => ({ success: false, error: parseError(e) } as ImageGenerationResponse)) as ImageGenerationResponse;
            return nanoAfterHF.success ? { ...nanoAfterHF, note: 'Fallback to Nano (HF/Imagen unavailable).' } : nanoAfterHF;
        }

        // If cooling down and not HF (HF already excluded above), block early
        if (isCoolingDown) {
            const status = getRateLimitStatus();
            return { success: false, error: `Rate limiting in effect. Retry after ${(status.resumeInMs/1000).toFixed(1)}s.` };
        }

        if (preferred === 'imagen-4.0-generate-001') {
            const im = await attempt(runImagenDirect).catch((e) => ({ success: false, error: parseError(e) } as ImageGenerationResponse));
            if (im.success) return im;
            const errText = (im.error || '').toLowerCase();
            if (errText.includes('billed') || errText.includes('rate_limit') || errText.includes('rate limit') || errText.includes('quota')) {
                const nano = await attempt(runNano).catch((e) => ({ success: false, error: parseError(e) } as ImageGenerationResponse));
                if (nano.success) return { ...nano, note: 'Auto-switch to Nano due to provider limits.' } as ImageGenerationResponse;
                return nano;
            }
            return im;
        }

        // preferred nano
        const nano = await attempt(runNano).catch((e) => ({ success: false, error: parseError(e) } as ImageGenerationResponse));
        if (nano.success) return nano;
        // As last attempt, try Imagen (may require billing)
        const im = await attempt(runImagenDirect).catch((e) => ({ success: false, error: parseError(e) } as ImageGenerationResponse));
        return im;
    });
}

// Direct Imagen call without HF pre-attempt (used only in robust flow to honor explicit model choice)
async function generateImagenOnly(prompt: string, aspectRatio: AspectRatio, format?: ImageFormat): Promise<ImageGenerationResponse> {
    try {
        const response = await getClient().models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt,
            config: { numberOfImages: 1, aspectRatio }
        });
        const imageB64 = response.generatedImages?.[0]?.image?.imageBytes;
        if (!imageB64) return { success: false, error: 'The model did not return a valid image.' };
        let dataUrl = `data:image/png;base64,${imageB64}`;
        if (format && format !== 'png') {
            try {
                const img = new Image();
                const binary = atob(imageB64);
                const len = binary.length;
                const array = new Uint8Array(len);
                for (let i = 0; i < len; i++) array[i] = binary.charCodeAt(i);
                const blob = new Blob([array.buffer], { type: 'image/png' });
                const blobUrl = URL.createObjectURL(blob);
                await new Promise((res, rej) => { img.onload = () => res(undefined); img.onerror = rej; img.src = blobUrl; });
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/webp';
                    dataUrl = canvas.toDataURL(mime, format === 'jpeg' ? 0.92 : undefined);
                }
                URL.revokeObjectURL(blobUrl);
            } catch (e) {
                console.warn('Format conversion failed, falling back to PNG (direct imagen).', e);
            }
        }
        return { success: true, url: dataUrl, provider: 'imagen' };
    } catch (error) {
        return { success: false, error: parseError(error) };
    }
}

/**
 * Parses various error formats from the API and returns a user-friendly string.
 * @param error The error caught from a try/catch block.
 * @returns A user-friendly error message.
 */
export function parseError(error: unknown): string {
    console.error("Raw API Error:", error);

    if (error instanceof Error) {
        let message = error.message;

        // Try to find and parse a JSON object within the message string, which is common for complex errors.
        try {
            const jsonMatch = message.match(/(\{.*\})/);
            if (jsonMatch && jsonMatch[0]) {
                const parsedJson = JSON.parse(jsonMatch[0]);
                if (parsedJson.error && parsedJson.error.message) {
                    message = parsedJson.error.message;
                }
            }
        } catch (e) {
            // It wasn't a JSON string inside the message, so we'll proceed with the original message.
        }

        // Provide user-friendly messages for common, identifiable issues.
        if (message.includes('Rpc failed due to xhr error')) {
            return "A network or server error occurred. This might be a temporary issue. Please check your connection and try again later.";
        }
        if (message.toLowerCase().includes('api key not valid')) {
            return "The provided API key is not valid. Please check your configuration.";
        }
        if (message.toLowerCase().includes('rate limit') || message.toLowerCase().includes('exceeded your current quota') || message.toLowerCase().includes('quota')) {
            const m = "RATE_LIMIT: You exceeded your current quota or rate limits. The request was blocked. Consider switching to a lighter model (Flash), reducing rapid consecutive calls, or waiting before retrying.";
            setCooldownFromErrorMessage(m);
            return m;
        }
        if (message.includes('[400]')) {
             return "The request was invalid. Please check your input and try again.";
        }
         if (message.includes('[500]')) {
            return "An internal AI error occurred. This may be a temporary issue. Please try again later.";
        }
        // Imagen billing restriction
        if (message.toLowerCase().includes('only accessible to billed users')) {
            return "This image model requires a billed Google GenAI account. Add a free provider token (set VITE_HF_API_TOKEN for Hugging Face) or switch to the 'Nano' model in the UI.";
        }

        // For other errors, return a cleaner, truncated version of the message.
        const cleanMessage = `API Error: ${message.substring(0, 200)}${message.length > 200 ? '...' : ''}`;
        return cleanMessage;
    }

    return "An unknown error occurred. Please check the console for more details.";
}


export async function generateText(
    prompt: string, 
    model: TextModel, 
    systemInstruction: string,
    temperature: number,
    useWebSearch: boolean
): Promise<TextGenerationResponse> {
    // Cooldown gate
    if (Date.now() < rateLimitUntil) {
        const status = getRateLimitStatus();
        return { success: false, error: `Rate limiting in effect. Retry after ${(status.resumeInMs/1000).toFixed(1)}s.` };
    }
        // Local override path (Ollama) if flag set OR Gemini key missing.
        const useLocal = getLocalFlag() || !isGeminiKeyAvailable();
        if (useLocal) {
            try {
                const base = getLocalLLMBase();
                const model = getLocalLLMModel();
                const body = {
                    model,
                    prompt,
                    stream: false,
                    options: {
                        temperature
                    }
                };
                const resp = await fetch(`${base}/api/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                if (!resp.ok) {
                    const errText = await resp.text();
                    return { success: false, error: `Local LLM error (${resp.status}): ${errText}` };
                }
                const data = await resp.json();
                const text = data?.response || data?.content || '(empty response)';
                return { success: true, text, sources: [] };
            } catch (e) {
                return { success: false, error: `Local LLM fetch failed: ${(e as Error).message}` };
            }
        }
    try {
        const response: GenerateContentResponse = await withRetries(() => getClient().models.generateContent({
            model: model,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction || undefined,
                temperature: temperature,
                tools: useWebSearch ? [{googleSearch: {}}] : undefined,
            }
        }));
        return {
            success: true,
            text: response.text ?? "",
            sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
        };
    } catch (error: unknown) {
        return { success: false, error: parseError(error) };
    }
}

export async function generateJson(prompt: string): Promise<JsonGenerationResponse> {
    // Local LLM path via Ollama when enabled
    if (getLocalFlag()) {
        try {
            const base = getLocalLLMBase();
            const model = getLocalLLMModel();
            const jsonPrompt = `${prompt}\n\nReturn only valid JSON with no prose.`;
            const resp = await fetch(`${base}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, prompt: jsonPrompt, stream: false })
            });
            if (!resp.ok) {
                return { success: false, error: `Local LLM error (${resp.status})` };
            }
            const data = await resp.json();
            const text = data?.response || data?.content || '';
            try {
                const json = JSON.parse(text);
                return { success: true, json, rawResponse: text };
            } catch {
                return { success: false, error: 'Local LLM did not return valid JSON', raw: text } as unknown as JsonGenerationResponse;
            }
        } catch (e) {
            return { success: false, error: `Local LLM fetch failed: ${(e as Error).message}` } as unknown as JsonGenerationResponse;
        }
    }
    try {
        if (Date.now() < rateLimitUntil) {
            const status = getRateLimitStatus();
            return { success: false, error: `Rate limiting in effect. Retry after ${(status.resumeInMs/1000).toFixed(1)}s.` };
        }
        const response: GenerateContentResponse = await withRetries(() => getClient().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Based on the following prompt, generate a valid JSON object. Only return the JSON object, with no other text or explanations. Prompt: "${prompt}"`,
            config: {
                responseMimeType: "application/json",
            }
        })) as unknown as GenerateContentResponse;

        const rawResponse = response.text ?? "";
        if (!rawResponse) {
            return { success: false, error: "The model returned an empty response.", rawResponse };
        }
        const parsedJson = JSON.parse(rawResponse);

        return {
            success: true,
            json: parsedJson,
            rawResponse: rawResponse,
        };
    } catch (error: unknown) {
        const errorMessage = parseError(error);
        let rawResponse: string | undefined;
        // This is a naive extraction, but can be helpful for debugging invalid JSON.
        if (error instanceof Error && error.message.includes('JSON')) {
             // In case of JSON parsing error, the raw response might be what we need to show the user.
             // We don't have direct access to the raw text from the catch block, but we can hint at the issue.
        }
        return { success: false, error: errorMessage, rawResponse };
    }
}


export async function generateTextFromImage(prompt: string, base64Data: string, mimeType: string): Promise<VisionResponse> {
    try {
        if (Date.now() < rateLimitUntil) {
            const status = getRateLimitStatus();
            return { success: false, error: `Rate limiting in effect. Retry after ${(status.resumeInMs/1000).toFixed(1)}s.` };
        }
        const imagePart = {
            inlineData: {
                data: base64Data,
                mimeType: mimeType,
            },
        };
        const textPart = { text: prompt };

        const response: GenerateContentResponse = await withRetries(() => getClient().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
        }));

        return {
            success: true,
            text: response.text ?? "",
        };
    } catch (error: unknown) {
        return { success: false, error: parseError(error) };
    }
}

export async function enhancePrompt(prompt: string, style: ImageStyle): Promise<string> {
    if (style === 'none') return prompt;
    try {
        const response = await getClient().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Enhance the following image prompt for an AI image generator with rich, descriptive details. The desired style is "${style}". Only return the enhanced prompt. Prompt: "${prompt}"`
        });
        return response.text?.trim() ?? prompt;
    } catch (err) {
        console.error("Failed to enhance prompt:", err);
        return prompt; // Fallback to original prompt if enhancement fails
    }
}

export async function generateImage(prompt: string, aspectRatio: AspectRatio, format?: ImageFormat): Promise<ImageGenerationResponse> {
    // If a Hugging Face token is available, prefer the free provider first.
    const hfToken = getHuggingFaceToken();
    if (hfToken) {
        const hfResult = await generateImageViaHuggingFace(prompt, aspectRatio, hfToken, undefined, format);
        if (hfResult.success) return hfResult;
        // If HF fails, fall back to Imagen to give the user another chance (may require billing)
    }

    try {
        const response = await getClient().models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                aspectRatio: aspectRatio
            }
        });
        
        const imageB64 = response.generatedImages?.[0]?.image?.imageBytes;
        if (!imageB64) {
            return { success: false, error: "The model did not return a valid image." };
        }

        // Convert format if requested and supported (currently relies on browser canvas)
        let dataUrl = `data:image/png;base64,${imageB64}`;
        if (format && format !== 'png') {
            try {
                const img = new Image();
                const binary = atob(imageB64);
                const len = binary.length;
                const array = new Uint8Array(len);
                for (let i = 0; i < len; i++) array[i] = binary.charCodeAt(i);
                const blob = new Blob([array.buffer], { type: 'image/png' });
                const blobUrl = URL.createObjectURL(blob);
                await new Promise((res, rej) => { img.onload = () => res(undefined); img.onerror = rej; img.src = blobUrl; });
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/webp';
                    dataUrl = canvas.toDataURL(mime, format === 'jpeg' ? 0.92 : undefined);
                }
                URL.revokeObjectURL(blobUrl);
            } catch (e) {
                console.warn('Format conversion failed, falling back to PNG:', e);
            }
        }

        return {
            success: true,
            url: dataUrl,
            provider: 'imagen',
        };
    } catch (error: unknown) {
        return { success: false, error: parseError(error) };
    }
}

export async function generateImageNano(prompt: string, style: ImageStyle, aspectRatio: AspectRatio): Promise<ImageGenerationResponse> {
     try {
        let finalPrompt = prompt;
        if (style !== 'none') {
            finalPrompt += `, in a ${style.replace(/-/g, ' ')} style`;
        }
        finalPrompt += `, aspect ratio ${aspectRatio}`;

        const response = await getClient().models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: finalPrompt }] },
            config: {
                // Use string literal to avoid relying on enum value at type-level
                responseModalities: ['IMAGE' as any],
            },
        });

        const part = response.candidates?.[0]?.content?.parts?.[0];

        if (part?.inlineData?.data) {
            const imageB64 = part.inlineData.data;
             return {
                success: true,
                url: `data:image/png;base64,${imageB64}`,
                provider: 'nano',
            };
        }
        
        const finishReason = response.candidates?.[0]?.finishReason;
        const safetyRatings = response.candidates?.[0]?.safetyRatings;
        let errorMsg = "The model did not return an image.";
        if (finishReason === "SAFETY") {
            const blockedRating = safetyRatings?.find(r => r.blocked);
            errorMsg = `Your prompt was blocked for safety reasons: ${blockedRating?.category || 'Unknown'}. Please try again with a different prompt.`;
        }

        return {
            success: false,
            error: errorMsg
        };

    } catch (error: unknown) {
        return { success: false, error: parseError(error) };
    }
}

// -------------
// Provider: Hugging Face Inference API (optional client-side fallback)
// -------------
async function generateImageViaHuggingFace(
    prompt: string,
    aspectRatio: AspectRatio,
    token: string,
    style?: ImageStyle,
    format?: ImageFormat,
    advanced?: { width?: number; height?: number; steps?: number; guidance?: number; modelOverride?: string; negativePrompt?: string }
): Promise<ImageGenerationResponse> {
    try {
        const modelId = advanced?.modelOverride?.trim() || getHuggingFaceModel();

        // If style provided, gently bias the prompt
        let promptWithStyle = prompt;
        if (style && style !== 'none') {
            promptWithStyle += `, in a ${style.replace(/-/g, ' ')} style`;
        }

        // Dimensions: from advanced overrides, else map from aspect ratio
        let width = advanced?.width ?? 1024;
        let height = advanced?.height ?? 1024;
        if (!advanced?.width || !advanced?.height) {
            switch (aspectRatio) {
                case '16:9': width = 1344; height = 768; break;
                case '9:16': width = 768; height = 1344; break;
                case '4:3': width = 1152; height = 864; break;
                case '3:2': width = 1152; height = 768; break;
                case '2:3': width = 768; height = 1152; break;
                case '21:9': width = 1536; height = 672; break;
                case '9:21': width = 672; height = 1536; break;
                case '5:4': width = 1280; height = 1024; break;
                default: width = 1024; height = 1024;
            }
        }
        // Round to nearest multiple of 64 to satisfy diffusion models
        const round64 = (n: number) => Math.max(64, Math.round(n / 64) * 64);
        width = round64(width); height = round64(height);

        const body = {
            inputs: promptWithStyle,
            parameters: {
                width,
                height,
                num_inference_steps: Math.max(1, Math.min(advanced?.steps ?? 4, 75)),
                guidance_scale: Math.max(0, Math.min(advanced?.guidance ?? 0, 20)),
                negative_prompt: advanced?.negativePrompt ?? '',
            }
        } as Record<string, unknown>;

        // Endpoint migration: try new router first, fallback to legacy if not supported.
        const endpoints: Array<{name: 'router' | 'legacy'; build: (m: string) => string}> = [
            { name: 'router', build: (m: string) => `https://router.huggingface.co/hf-inference/models/${encodeURIComponent(m)}` },
            { name: 'legacy', build: (m: string) => `https://api-inference.huggingface.co/models/${encodeURIComponent(m)}` },
        ];

        let lastErr: string | null = null;
        for (const ep of endpoints) {
            let res = await fetch(ep.build(modelId), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'image/png'
                },
                body: JSON.stringify(body)
            });

            // Poll if model still loading (503 or loading message)
            let attempts = 0;
            while (!res.ok && attempts < 2) {
                let msg = '';
                try { const errJson = await res.clone().json(); msg = String(errJson?.error || '').toLowerCase(); } catch {}
                if (res.status === 503 || msg.includes('loading') || msg.includes('currently loading')) {
                    await sleep(1500 * (attempts + 1));
                    attempts++;
                    res = await fetch(ep.build(modelId), {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            'Accept': 'image/png'
                        },
                        body: JSON.stringify(body)
                    });
                    continue;
                }
                break;
            }

            if (!res.ok) {
                // Capture error and move to next endpoint
                let detail = `${res.status} ${res.statusText}`;
                try { const j = await res.json(); if (j?.error) detail = j.error; } catch {}
                lastErr = `HF endpoint (${ep.name}) error: ${detail}`;
                // If 404 on new router, fallback to legacy; if legacy fails, break.
                continue;
            }

            const blob = await res.blob();
            let dataUrl = await blobToDataUrl(blob);

            // Convert to requested format if needed
            if (format && format !== 'png') {
                try {
                    const img = new Image();
                    img.src = dataUrl;
                    await new Promise((resolve, reject) => { img.onload = () => resolve(undefined); img.onerror = reject; });
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width; canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0);
                        const mime = format === 'jpeg' ? 'image/jpeg' : 'image/webp';
                        dataUrl = canvas.toDataURL(mime, format === 'jpeg' ? 0.92 : undefined);
                    }
                } catch (e) {
                    console.warn('Hugging Face format conversion failed; using PNG.', e);
                }
            }

            return { success: true, url: dataUrl, provider: 'huggingface', note: `HF endpoint: ${ep.name}` };
        }

        return { success: false, error: lastErr || 'Hugging Face error: unknown failure' };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, error: `Hugging Face request failed: ${msg}` };
    }
}

function blobToDataUrl(blob: Blob): Promise<string> {
    // Browser path: use FileReader
    if (typeof FileReader !== 'undefined') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(blob);
        });
    }
    // Node path: convert via Buffer
    return (blob as any).arrayBuffer().then((ab: ArrayBuffer) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Buf = (globalThis as any)?.Buffer;
        if (Buf && typeof Buf.from === 'function') {
            const b64 = Buf.from(ab as any).toString('base64');
            return `data:image/png;base64,${b64}`;
        }
        // Fallback: manually build base64 (less efficient, but avoids Node Buffer)
        let binary = '';
        const bytes = new Uint8Array(ab);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        return `data:image/png;base64,${b64}`;
    });
}


// CHAT SERVICES (Now stateless, relies on passed history)

export async function* getChatStream(
    history: ChatMessage[], 
    message: string, 
    model: TextModel,
    useWebSearch: boolean
): AsyncGenerator<TextGenerationResponse> {
    const geminiHistory = history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
    }));
    
    // Add a custom system instruction for the AI's persona
    const systemInstruction = `You are FANTOM AI, a helpful and creative assistant powered by Google Gemini.

Style and response rules:
- Write clear, thorough answers with proper context and structure.
- Use Markdown formatting: headings (##), bullet lists, numbered steps, and code blocks when helpful. Prefer concise sections over long walls of text.
- Include a short summary or key takeaways when the answer is long.
- If web search is enabled, cite sources by listing titles/links. If not enabled, avoid fabricating sources.
        // Local Stable Diffusion branch if enabled or Gemini key missing
        if (getLocalFlag()) {
            try {
                const sdBase = getLocalSDEndpoint();
                // Map aspect ratio to width/height (basic heuristics)
                const aspect = aspectRatio || '1:1';
                const [aw, ah] = aspect.split(':').map(n => parseInt(n, 10));
                const baseSize = 768; // default square
                let width = baseSize;
                let height = baseSize;
                if (aw && ah && aw !== ah) {
                    if (aw > ah) {
                        width = baseSize;
                        height = Math.round(baseSize * (ah / aw));
                    } else {
                        height = baseSize;
                        width = Math.round(baseSize * (aw / ah));
                    }
                }
                const body = {
                    prompt,
                    width,
                    height,
                    steps: 30,
                    sampler_name: 'Euler a',
                    cfg_scale: 7,
                };
                const resp = await fetch(sdBase + '/sdapi/v1/txt2img', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                if (!resp.ok) return { success: false, error: 'Local SD request failed ' + resp.status };
                const data: any = await resp.json();
                const b64: string | undefined = data && Array.isArray(data.images) ? data.images[0] : undefined;
                return b64 ? { success: true, imageDataUrl: 'data:image/png;base64,' + b64, provider: 'local-sd' } : { success: false, error: 'Local SD returned no image data' };
            } catch (e) { return { success: false, error: 'Local SD fetch failed: ' + (e as Error).message }; }
        }
- Show examples and edge cases; call out assumptions.
- Keep tone professional, friendly, and precise.

Identity rule:
When asked who created you or who made you, you must reply exactly with: "I was created by a developer called Sai Rohit using Google AI Studio services, and I was powered by Google Gemini."`;

    const maxAttempts = 2;
    const baseDelay = 600;
    for (let i = 0; i < maxAttempts; i++) {
        try {
            if (Date.now() < rateLimitUntil) {
                const status = getRateLimitStatus();
                yield { success: false, error: `Rate limiting in effect. Retry after ${(status.resumeInMs/1000).toFixed(1)}s.` };
                return;
            }
            const chat = getClient().chats.create({
                model: model,
                history: geminiHistory,
                config: {
                    systemInstruction,
                    tools: useWebSearch ? [{googleSearch: {}}] : undefined,
                }
            });

            // Local streaming via Ollama JSONL when local flag set or Gemini key missing
            if (getLocalFlag() || !isGeminiKeyAvailable()) {
                try {
                    const base = getLocalLLMBase();
                    const ollamaModel = getLocalLLMModel();
                    const transcript = history
                        .map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
                        .concat(`User: ${message}`)
                        .join('\n');
                    const resp = await fetch(base + '/api/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ model: ollamaModel, prompt: transcript, stream: true })
                    });
                    if (!resp.ok || !resp.body) { yield { success: false, error: 'Local LLM stream failed (' + resp.status + ')' }; return; }
                    const reader = resp.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split(/\r?\n/);
                        buffer = lines.pop() || '';
                        for (const line of lines) {
                            if (!line.trim()) continue;
                            try { const obj = JSON.parse(line); if (obj && obj.response) { yield { success: true, text: obj.response as string, sources: [] }; } } catch { /* ignore */ }
                        }
                    }
                    if (buffer.trim()) { try { const obj = JSON.parse(buffer); if (obj && obj.response) { yield { success: true, text: obj.response as string, sources: [] }; } } catch { /* ignore */ } }
                    return;
                } catch (e) { yield { success: false, error: 'Local LLM streaming error: ' + (e as Error).message }; return; }
            }
            const resultStream = await chat.sendMessageStream({ message });
            for await (const chunk of resultStream) {
                yield { 
                    success: true, 
                    text: chunk.text ?? "",
                    sources: chunk.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
                };
            }
            return; // streamed successfully
        } catch (error: unknown) {
            const friendly = parseError(error);
            if (i < maxAttempts - 1 && shouldRetryFromMessage(friendly)) {
                const jitter = Math.floor(Math.random() * 250);
                await sleep(baseDelay * Math.pow(2, i) + jitter);
                continue;
            }
            yield { success: false, error: friendly };
            return;
        }
    }
}

// -------------
// Composite health check for all APIs used by the app
// -------------
export async function checkAllApis(): Promise<{
    ok: boolean;
    message: string;
    details: {
        geminiKeyDetected: boolean;
        geminiReachable: boolean;
        huggingFaceTokenDetected: boolean;
        huggingFaceReachable: boolean;
        huggingFaceEndpoint?: 'router' | 'legacy';
    };
}> {
    const details = {
        geminiKeyDetected: isGeminiKeyAvailable(),
        geminiReachable: false,
        huggingFaceTokenDetected: !!getHuggingFaceToken(),
        huggingFaceReachable: false,
        huggingFaceEndpoint: undefined as undefined | 'router' | 'legacy',
    };

    // Verify Gemini with a minimal text call when a key is available
    if (details.geminiKeyDetected) {
        const v = await verifyApiKey();
        details.geminiReachable = v.valid;
    }

    // If an HF token exists, attempt a tiny generation to confirm reachability.
    // We keep params extremely small to minimize cost/latency.
    const hfToken = getHuggingFaceToken();
    if (hfToken) {
        try {
            const modelId = getHuggingFaceModel();
            const body = {
                inputs: 'ping',
                parameters: {
                    width: 64,
                    height: 64,
                    num_inference_steps: 1,
                    guidance_scale: 0,
                }
            } as Record<string, unknown>;

            const endpoints: Array<{name: 'router' | 'legacy'; build: (m: string) => string}> = [
                { name: 'router', build: (m: string) => `https://router.huggingface.co/hf-inference/models/${encodeURIComponent(m)}` },
                { name: 'legacy', build: (m: string) => `https://api-inference.huggingface.co/models/${encodeURIComponent(m)}` },
            ];

            for (const ep of endpoints) {
                const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
                const to = ctrl ? setTimeout(() => ctrl.abort(), 8000) : undefined;
                try {
                    const res = await fetch(ep.build(modelId), {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${hfToken}`,
                            'Content-Type': 'application/json',
                            'Accept': 'image/png'
                        },
                        body: JSON.stringify(body),
                        signal: ctrl?.signal
                    });
                    if (to) clearTimeout(to);
                    if (res.ok) {
                        details.huggingFaceReachable = true;
                        details.huggingFaceEndpoint = ep.name;
                        break;
                    }
                } catch {
                    if (to) clearTimeout(to);
                    // try next endpoint
                }
            }
        } catch {
            // ignore, remains false
        }
    }

    const ok = details.geminiReachable && (!details.huggingFaceTokenDetected || details.huggingFaceReachable);
    const message = ok
        ? 'All APIs are reachable.'
        : 'Some APIs are not reachable. Check details and configuration.';

    return { ok, message, details };
}

// Cached health check to avoid repeated pings under navigation or re-mounts
let _apisCache: { time: number; data: Awaited<ReturnType<typeof checkAllApis>> } | null = null;
export async function checkAllApisCached(ttlMs = 120000) {
    const now = Date.now();
    if (_apisCache && now - _apisCache.time < ttlMs) return _apisCache.data;
    const data = await checkAllApis();
    _apisCache = { time: now, data };
    return data;
}