// import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const NVIDIA_KEY = process.env.VITE_NVIDIA_API_KEY;
const NVIDIA_BASE = process.env.VITE_NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com';

async function testNvidia() {
    console.error('Testing NVIDIA API...');
    if (!NVIDIA_KEY) {
        console.error('❌ VITE_NVIDIA_API_KEY is missing');
        return;
    }
    try {
        const response = await fetch(`${NVIDIA_BASE}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${NVIDIA_KEY}`
            },
            body: JSON.stringify({
                model: 'nvidia/nemotron-nano-12b-v2-vl',
                messages: [{ role: 'user', content: 'Ping' }],
                max_tokens: 10
            })
        });
        if (response.ok) {
            const data = await response.json();
            console.error('✅ NVIDIA API is working. Response:', JSON.stringify(data));
        } else {
            console.error(`❌ NVIDIA API failed: ${response.status} ${response.statusText}`);
            console.error(await response.text());
        }
    } catch (error) {
        console.error('❌ NVIDIA API error:', error.message);
    }
}

testNvidia();
