import dotenv from 'dotenv';
// import fetch from 'node-fetch'; // Native fetch used in Node 18+

dotenv.config({ path: '.env.local' });
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const BASE_URL = 'http://127.0.0.1:4000';
const OPENROUTER_KEY = process.env.VITE_XAI_API_KEY; // Using the shared key
const OPENROUTER_BASE = process.env.VITE_XAI_BASE_URL || 'https://openrouter.ai/api/v1';
const CHAT_MODEL = process.env.VITE_NVIDIA_MODEL || 'nvidia/nemotron-nano-12b-v2-vl:free';
const IMAGE_MODEL = process.env.VITE_XAI_IMAGE_MODEL || 'black-forest-labs/flux-1-schnell';

if (!global.fetch) global.fetch = fetch;

async function runTest() {
    console.log('🚀 Starting Comprehensive System Verification...\n');

    // 1. Server Health
    console.log('1️⃣  Checking Server Health...');
    try {
        const healthRes = await fetch(`${BASE_URL}/api/health`);
        if (!healthRes.ok) throw new Error(`Health check failed: ${healthRes.status}`);
        const healthData = await healthRes.json();
        console.log('   ✅ Server is UP');
        console.log(`   ✅ Database Latency: ${healthData.db_latency_ms}ms`);
    } catch (e) {
        console.error('   ❌ Server/DB Check Failed:', e.message);
        process.exit(1);
    }

    // 2. Authentication
    console.log('\n2️⃣  Testing Authentication...');
    let token = '';
    const testUser = `test_user_${Date.now()}@example.com`;
    const testPass = 'password123';

    try {
        // Register
        const regRes = await fetch(`${BASE_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testUser, password: testPass })
        });
        if (!regRes.ok) throw new Error(`Register failed: ${regRes.status}`);
        console.log('   ✅ Registration Successful');

        // Login
        const loginRes = await fetch(`${BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testUser, password: testPass })
        });
        if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
        const loginData = await loginRes.json();
        token = loginData.token;
        console.log('   ✅ Login Successful (Token received)');

        // Profile
        const profileRes = await fetch(`${BASE_URL}/api/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!profileRes.ok) throw new Error(`Profile access failed: ${profileRes.status}`);
        console.log('   ✅ Protected Route Access Successful');

    } catch (e) {
        console.error('   ❌ Auth Test Failed:', e.message);
        process.exit(1);
    }

    // 3. AI Chat (via Backend Proxy -> OpenRouter)
    console.log('\n3️⃣  Testing AI Chat (NVIDIA via OpenRouter)...');
    try {
        // We test the backend proxy route /api/chat
        const chatRes = await fetch(`${BASE_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                model: CHAT_MODEL,
                messages: [{ role: 'user', content: 'Reply with "System Operational"' }],
                stream: false
            })
        });

        if (!chatRes.ok) {
            const err = await chatRes.text();
            throw new Error(`Chat API failed: ${chatRes.status} - ${err}`);
        }

        const chatData = await chatRes.json();
        const reply = chatData.choices?.[0]?.message?.content || '';
        console.log(`   ✅ Chat Response Received: "${reply.trim()}"`);

    } catch (e) {
        console.error('   ❌ Chat Test Failed:', e.message);
        // Don't exit, try image gen
    }

    // 4. Image Generation (via Backend Proxy -> OpenRouter)
    console.log('\n4️⃣  Testing Image Generation (Flux via OpenRouter)...');
    try {
        // We test the backend proxy route /api/image
        const imgRes = await fetch(`${BASE_URL}/api/image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                model: IMAGE_MODEL,
                prompt: 'A simple red circle',
                n: 1,
                size: '1024x1024'
            })
        });

        if (!imgRes.ok) {
            const err = await imgRes.text();
            throw new Error(`Image API failed: ${imgRes.status} - ${err}`);
        }

        const imgData = await imgRes.json();
        console.log('   ✅ Image Response Data:', JSON.stringify(imgData).substring(0, 100) + '...');

        const url = imgData.data?.[0]?.url;
        if (url) {
            console.log(`   ✅ Image URL Received: ${url}`);
        } else {
            console.log('   ⚠️  No URL in response (check format)');
        }

    } catch (e) {
        console.error('   ❌ Image Gen Test Failed:', e.message);
    }

    console.log('\n🏁 Verification Complete.');
}

runTest();
