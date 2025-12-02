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
    if (typeof window !== 'undefined') {
        return window.localStorage?.getItem('VITE_XAI_API_KEY') ?? undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const envAny = import.meta as any;
    return envAny?.env?.VITE_XAI_API_KEY as string | undefined;
}

// Get xAI base URL from environment
export function getGrokBaseUrl(): string {
    if (typeof window !== 'undefined') {
        const stored = window.localStorage?.getItem('VITE_XAI_BASE_URL');
        if (stored) return stored;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const envAny = import.meta as any;
    return (envAny?.env?.VITE_XAI_BASE_URL as string) || 'https://api.x.ai';
}

// Get default image model
export function getGrokImageModel(): string {
    if (typeof window !== 'undefined') {
        const stored = window.localStorage?.getItem('VITE_XAI_IMAGE_MODEL');
        if (stored) return stored;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const envAny = import.meta as any;
    return (envAny?.env?.VITE_XAI_IMAGE_MODEL as string) || 'grok-2-image-1212';
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

    const baseUrl = getGrokBaseUrl();
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
