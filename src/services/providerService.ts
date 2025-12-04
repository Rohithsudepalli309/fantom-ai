// Unified provider selection for text/json/vision.
import { generateNvidiaText, generateNvidiaVision, generateNvidiaVisionByUrl, generateNvidiaVideoByUrl, isNvidiaConfigured, generateNvidiaImage, generateNvidiaVideo, streamNvidiaChat } from './nvidiaService';
import { generateGrokImage, isGrokConfigured } from './grokService';
import { TextGenerationResponse, JsonGenerationResponse, VisionResponse, TextModel, ChatMessage, AspectRatio, ImageFormat, ImageModel, ImageStyle, ImageGenerationResponse } from '../types';

// Video analysis using a remote video URL; prefers NVIDIA's native video_url support
export async function unifiedVideoByUrl(prompt: string, videoUrl: string, opts?: { fps?: number, maxTokens?: number }): Promise<{ success: boolean, text?: string, error?: string }> {
  return generateNvidiaVideoByUrl(prompt, videoUrl, opts);
}

function getProvider(): 'nvidia' {
  return 'nvidia';
}

export async function unifiedGenerateText(prompt: string, model: TextModel, systemInstruction: string, temperature: number, useWebSearch: boolean): Promise<TextGenerationResponse> {
  if (useWebSearch) {
    return { success: false, error: 'Web search not implemented for NVIDIA.' };
  }
  return generateNvidiaText(prompt, systemInstruction, temperature);
}

export async function unifiedGenerateJson(prompt: string): Promise<JsonGenerationResponse> {
  // Attempt JSON via text then parse
  const resp = await generateNvidiaText(prompt + '\nReturn ONLY valid JSON.', undefined, 0.2);
  if (!resp.success) return { success: false, error: resp.error, rawResponse: undefined } as JsonGenerationResponse;
  try {
    const json = JSON.parse(resp.text || '');
    return { success: true, json, rawResponse: resp.text || '' };
  } catch {
    return { success: false, error: 'NVIDIA did not return valid JSON', rawResponse: resp.text } as JsonGenerationResponse;
  }
}

export async function unifiedVision(prompt: string, base64Data: string, mimeType: string): Promise<VisionResponse> {
  return generateNvidiaVision(prompt, base64Data, mimeType);
}

// Vision using a remote image URL; prefers NVIDIA's native image_url support
export async function unifiedVisionByUrl(prompt: string, imageUrl: string): Promise<VisionResponse> {
  return generateNvidiaVisionByUrl(prompt, imageUrl);
}

export function getActiveProvider(): string {
  if (!isNvidiaConfigured()) return 'nvidia (unconfigured)';
  return 'nvidia';
}

// Unified chat streaming (history + new message). Returns an async generator.
export async function* unifiedChatStream(history: ChatMessage[], message: string, model: TextModel, useWebSearch: boolean): AsyncGenerator<TextGenerationResponse> {
  if (useWebSearch) {
    yield { success: false, error: 'Web search not implemented for NVIDIA.' };
    return;
  }
  // Stream from NVIDIA using SSE/NDJSON tolerant reader
  for await (const chunk of streamNvidiaChat(history, message, 0.7)) {
    yield chunk;
  }
}

// Variant allowing a per-call provider override without mutating global/localStorage
export async function* unifiedChatStreamWithProvider(
  history: ChatMessage[],
  message: string,
  model: TextModel,
  useWebSearch: boolean,
  providerOverride: 'nvidia' | 'local'
): AsyncGenerator<TextGenerationResponse> {
  // Ignore override, force NVIDIA
  if (useWebSearch) {
    yield { success: false, error: 'Web search not implemented for NVIDIA.' };
    return;
  }
  for await (const chunk of streamNvidiaChat(history, message, 0.7)) {
    yield chunk;
  }
}

// Unified image generation: prefer NVIDIA endpoints when provider=nvidia and URL configured, else fallback to Stability/local SD via geminiService
export async function unifiedGenerateImage(
  prompt: string,
  style: ImageStyle,
  aspectRatio: AspectRatio,
  preferred: ImageModel,
  format?: ImageFormat,
  advanced?: { width?: number; height?: number; steps?: number; guidance?: number; modelOverride?: string; negativePrompt?: string }
): Promise<ImageGenerationResponse> {
  // Priority: Grok (if configured) > NVIDIA (fallback)

  // Try Grok first if configured
  if (isGrokConfigured()) {
    try {
      const grokRes = await generateGrokImage({
        prompt,
        n: 1,
        responseFormat: 'url'
      });

      if (grokRes.success && grokRes.url) {
        return {
          success: true,
          url: grokRes.url,
          provider: 'grok',
          note: grokRes.revisedPrompt ? `Prompt optimized: ${grokRes.revisedPrompt}` : undefined
        };
      }
    } catch (error) {
      console.warn('Grok image generation failed, falling back to NVIDIA:', error);
    }
  }

  // Fallback to NVIDIA
  const map = (ar: AspectRatio, w?: number, h?: number): { width: number; height: number } => {
    if (w && h) return { width: w, height: h };
    switch (ar) {
      case '16:9': return { width: 1344, height: 768 };
      case '9:16': return { width: 768, height: 1344 };
      case '4:3': return { width: 1152, height: 864 };
      case '3:2': return { width: 1152, height: 768 };
      case '2:3': return { width: 768, height: 1152 };
      case '21:9': return { width: 1536, height: 672 };
      case '9:21': return { width: 672, height: 1536 };
      case '5:4': return { width: 1280, height: 1024 };
      default: return { width: 1024, height: 1024 };
    }
  };
  const wh = map(aspectRatio, advanced?.width, advanced?.height);
  const res = await generateNvidiaImage({
    prompt,
    width: wh.width,
    height: wh.height,
    steps: Math.max(1, Math.min(150, advanced?.steps ?? 30)),
    cfgScale: Math.max(0, Math.min(30, advanced?.guidance ?? 7)),
    negativePrompt: advanced?.negativePrompt,
    format: format || 'png'
  });
  if (res.success && res.url) {
    return { success: true, url: res.url, provider: 'nvidia' };
  }
  return { success: false, error: res.error || 'Image generation failed' };
}

export async function unifiedGenerateVideo(prompt: string, opts?: { durationSec?: number; width?: number; height?: number }): Promise<{ success: boolean; url?: string; error?: string }> {
  const res = await generateNvidiaVideo({ prompt, durationSec: opts?.durationSec, width: opts?.width, height: opts?.height });
  if (res.success) return res;
  return { success: false, error: res.error || 'NVIDIA video not configured' };
}
