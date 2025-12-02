import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

// Bypass SSL certificate issues for local testing
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const key = process.env.VITE_NVIDIA_API_KEY;
const base = process.env.VITE_NVIDIA_BASE_URL || 'https://api.nvidia.com';
const model = process.env.VITE_NVIDIA_MODEL || 'nvidia/nemotron-nano-12b-v2-vl';

if (!key) {
    console.error('NVIDIA key missing. Set VITE_NVIDIA_API_KEY in .env.local');
    process.exit(1);
}

async function testText() {
    console.log('Testing Text Generation...');
    const url = `${base}/v1/chat/completions`;
    console.log('Fetching:', url);
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: 'ping' }],
                max_tokens: 10,
                stream: false
            })
        });

        if (!resp.ok) {
            const t = await resp.text();
            console.error(`[text] failed with status ${resp.status}`);
            console.error(`[text] response body: ${t}`);
            throw new Error(`Status ${resp.status}: ${t}`);
        }

        const data = await resp.json();
        console.log('[text] raw response:', JSON.stringify(data, null, 2));
        const text = data.choices?.[0]?.message?.content;
        console.log('[text] ok:', text);
    } catch (e) {
        console.error('[text] fail:', e.message);
        if (e.cause) console.error('[text] cause:', e.cause);
        console.error('[text] stack:', e.stack);
        process.exitCode = 1;
    }
}

await testText();
