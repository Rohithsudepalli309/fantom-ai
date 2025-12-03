// import fetch from 'node-fetch'; // Using native fetch
import dotenv from 'dotenv';
dotenv.config();

const NVIDIA_KEY = process.env.VITE_NVIDIA_API_KEY;
const NVIDIA_BASE = process.env.VITE_NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com';
const XAI_KEY = process.env.VITE_XAI_API_KEY;
const XAI_BASE = process.env.VITE_XAI_BASE_URL || 'https://openrouter.ai/api/v1';

async function testNvidia() {
    console.log('Testing NVIDIA API...');
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
            console.log('✅ NVIDIA API is working. Response:', JSON.stringify(data));
        } else {
            console.error(`❌ NVIDIA API failed: ${response.status} ${response.statusText}`);
            console.error(await response.text());
        }
    } catch (error) {
        console.error('❌ NVIDIA API error:', error.message);
    }
}

async function testXAI() {
    console.log('Testing xAI API...');
    if (!XAI_KEY) {
        console.error('❌ VITE_XAI_API_KEY is missing');
        return;
    }
    try {
        const response = await fetch(`${XAI_BASE}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${XAI_KEY}`
            },
            body: JSON.stringify({
                model: 'xai/grok-beta',
                messages: [{ role: 'user', content: 'Ping' }],
                max_tokens: 10
            })
        });
        if (response.ok) {
            const data = await response.json();
            console.log('✅ xAI API is working. Response:', JSON.stringify(data));
        } else {
            console.error(`❌ xAI API failed: ${response.status} ${response.statusText}`);
            console.error(await response.text());
        }
    } catch (error) {
        console.error('❌ xAI API error:', error.message);
    }
}

async function run() {
    await testNvidia();
    console.log('---');
    await testXAI();
}

run();
