// import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const XAI_KEY = process.env.VITE_XAI_API_KEY;
const XAI_BASE = process.env.VITE_XAI_BASE_URL || 'https://openrouter.ai/api/v1';

async function testXAI() {
    console.error('Testing xAI API...');
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
                model: 'xai/grok-2',
                messages: [{ role: 'user', content: 'Ping' }],
                max_tokens: 10
            })
        });
        if (response.ok) {
            const data = await response.json();
            console.error('✅ xAI API is working. Response:', JSON.stringify(data));
        } else {
            console.error(`❌ xAI API failed: ${response.status} ${response.statusText}`);
            console.error(await response.text());
        }
    } catch (error) {
        console.error('❌ xAI API error:', error.message);
    }
}

testXAI();
