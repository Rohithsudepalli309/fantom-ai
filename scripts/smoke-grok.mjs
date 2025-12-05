import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

if (!global.fetch) {
    console.error('This script requires Node.js 18+ with native fetch.');
    process.exit(1);
}

const key = process.env.VITE_XAI_API_KEY; // Using the same key
const baseUrl = process.env.VITE_XAI_BASE_URL || 'https://openrouter.ai/api/v1';
const model = 'nvidia/nemotron-nano-12b-v2-vl:free'; // Known good model

if (!key) {
    console.error('API key missing.');
    process.exit(1);
}

async function testTextGen() {
    console.log('Testing OpenRouter Connectivity...');
    console.log('URL:', `${baseUrl}/chat/completions`);
    console.log('Model:', model);

    try {
        const resp = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'Fantom AI Smoke Test'
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'user', content: 'Say hello' }
                ]
            })
        });

        if (!resp.ok) {
            const t = await resp.text();
            console.error(`[API] failed with status ${resp.status}`);
            console.error(`[API] response body: ${t}`);
            throw new Error(`Status ${resp.status}: ${t}`);
        }

        const data = await resp.json();
        console.log('[API] raw response:', JSON.stringify(data, null, 2));

        if (data.choices && data.choices.length > 0) {
            console.log('[API] success, content:', data.choices[0].message.content);
        } else {
            console.error('[API] no choices returned');
        }

    } catch (e) {
        console.error('[API] fail:', e.message);
    }
}

testTextGen();
