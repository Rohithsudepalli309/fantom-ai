// xAI Grok service for image generation
// API Documentation: https://docs.x.ai/api/endpoints#image-generation

export interface GrokImageOptions {
    prompt: string;
    n?: number; // Number of images to generate (1-10, default 1)
    responseFormat?: 'url' | 'b64_json'; // 'url' or 'b64_json'
    model?: string; // e.g., 'grok-2-image-1212'
}

export interface GrokImageResponse {
    success: boolean;
    url?: string;
    b64_json?: string;
    error?: string;
    revisedPrompt?: string; // Grok may revise the prompt for optimization
}

// Get xAI API key from environment
export function getGrokApiKey(): string | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const envAny = import.meta as any;
    const viteVal = envAny?.env?.VITE_XAI_API_KEY as string | undefined;
    // runtime overrides
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const winVal = typeof window !== 'undefined' ? (window as any)?.VITE_XAI_API_KEY as (string | undefined) : undefined;
    const lsVal = typeof window !== 'undefined' ? window.localStorage?.getItem('VITE_XAI_API_KEY') ?? undefined : undefined;
    return viteVal || winVal || lsVal;
}

// Get xAI base URL from environment
export function getGrokBaseUrl(): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const envAny = import.meta as any;
    const viteVal = envAny?.env?.VITE_XAI_BASE_URL as string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const winVal = typeof window !== 'undefined' ? (window as any)?.VITE_XAI_BASE_URL as (string | undefined) : undefined;
    const lsVal = typeof window !== 'undefined' ? window.localStorage?.getItem('VITE_XAI_BASE_URL') ?? undefined : undefined;
    return viteVal || winVal || lsVal || 'https://api.x.ai';
}

// Get default image model
export function getGrokImageModel(): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const envAny = import.meta as any;
    const viteVal = envAny?.env?.VITE_XAI_IMAGE_MODEL as string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const winVal = typeof window !== 'undefined' ? (window as any)?.VITE_XAI_IMAGE_MODEL as (string | undefined) : undefined;
    const lsVal = typeof window !== 'undefined' ? window.localStorage?.getItem('VITE_XAI_IMAGE_MODEL') ?? undefined : undefined;
    return viteVal || winVal || lsVal || 'grok-2-image-1212';
}

// Check if Grok is properly configured
export function isGrokConfigured(): boolean {
    return !!getGrokApiKey();
}

// Generate image using xAI Grok
export async function generateGrokImage(options: GrokImageOptions): Promise<GrokImageResponse> {
    const apiKey = getGrokApiKey();
    if (!apiKey) {
        return { success: false, error: 'xAI API key not configured' };
    }

    const baseUrl = getGrokBaseUrl().replace(/\/v1\/?$/, ''); // Strip trailing /v1 if present
    const model = options.model || getGrokImageModel();
    const url = `${baseUrl}/v1/images/generations`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                prompt: options.prompt,
                n: options.n || 1,
                response_format: options.responseFormat || 'url',
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `xAI API error (${response.status}): ${errorText}` };
        }

        const data = await response.json();

        // Grok returns an array of image objects
        if (data.data && data.data.length > 0) {
            const firstImage = data.data[0];
            return {
                success: true,
                url: firstImage.url,
                b64_json: firstImage.b64_json,
                revisedPrompt: firstImage.revised_prompt,
            };
        }

        return { success: false, error: 'No image data returned from Grok' };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

// Health check for Grok API
export async function checkGrokHealth(): Promise<{ ok: boolean; message: string }> {
    if (!isGrokConfigured()) {
        return { ok: false, message: 'xAI API key not configured' };
    }

    try {
        const response = await generateGrokImage({
            prompt: 'a simple red circle',
            n: 1
        });

        if (response.success) {
            return { ok: true, message: 'xAI Grok reachable' };
        }
        return { ok: false, message: response.error || 'Grok API check failed' };
    } catch (error) {
        return { ok: false, message: (error as Error).message };
    }
}
