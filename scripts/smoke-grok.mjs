import dotenv from 'dotenv';
// import { generateGrokImage } from '../src/services/grokService'; // Cannot import TS in JS directly without loader

dotenv.config({ path: '.env.local' });
dotenv.config();

// Bypass SSL certificate issues for local testing
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Mock window and localStorage for the service if needed, 
// but the service handles node env via import.meta check fallback? 
// Actually the service uses import.meta which might fail in node script without setup.
// Let's just mock the env vars directly since we are running in node.

// We need to polyfill fetch for Node environment if not present (Node 18+ has it)
if (!global.fetch) {
    console.error('This script requires Node.js 18+ with native fetch.');
    process.exit(1);
}

const key = process.env.VITE_XAI_API_KEY;

if (!key) {
    console.error('Grok key missing. Set VITE_XAI_API_KEY in .env.local');
    process.exit(1);
}

async function testGrok() {
    console.log('Testing Grok Image Generation...');
    // Force correct xAI URL if env var is pointing to OpenRouter (common misconfiguration)
    let baseUrl = (process.env.VITE_XAI_BASE_URL || 'https://api.x.ai').replace(/\/v1\/?$/, '');
    if (baseUrl.includes('openrouter')) {
        console.warn('Warning: VITE_XAI_BASE_URL points to OpenRouter. Overriding to https://api.x.ai for this smoke test.');
        baseUrl = 'https://api.x.ai';
    }
    const url = `${baseUrl}/v1/images/generations`;
    const model = process.env.VITE_XAI_IMAGE_MODEL || 'grok-2-image-1212';
    console.log('Fetching:', url);
    console.log('Model:', model);

    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify({
                model: 'grok-2-image-1212',
                prompt: 'a futuristic city with flying cars',
                n: 1,
                response_format: 'url'
            })
        });

        if (!resp.ok) {
            const t = await resp.text();
            console.error(`[grok] failed with status ${resp.status}`);
            console.error(`[grok] response body: ${t}`);
            throw new Error(`Status ${resp.status}: ${t}`);
        }

        const data = await resp.json();
        console.log('[grok] raw response:', JSON.stringify(data, null, 2));

        if (data.data && data.data.length > 0) {
            console.log('[grok] success, image url:', data.data[0].url);
        } else {
            console.error('[grok] no image data returned');
        }

    } catch (e) {
        console.error('[grok] fail:', e.message);
        if (e.cause) console.error('[grok] cause:', e.cause);
    }
}

testGrok();
