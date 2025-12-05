// Using native fetch

const BASE_URL = 'http://127.0.0.1:4000/api';
const TEST_USER = {
    email: `test_img_${Date.now()}@example.com`,
    password: 'password123'
};

async function testImageGen() {
    console.log('🚀 Starting Image Gen Test...');
    let token = '';

    // 1. Register/Login to get token
    try {
        // Register
        await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TEST_USER)
        });

        // Login
        const res = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TEST_USER)
        });
        const data = await res.json();
        if (res.ok && data.token) {
            token = data.token;
            console.log('✅ Login Passed');
        } else {
            console.error('❌ Login Failed', data);
            process.exit(1);
        }
    } catch (e) {
        console.error('❌ Auth Error', e.message);
        process.exit(1);
    }

    // 2. Test Image Gen
    try {
        console.log('🎨 Testing /api/image endpoint...');
        const res = await fetch(`${BASE_URL}/image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                prompt: 'a futuristic city skyline',
                model: 'grok-2' // Optional, but let's pass it
            })
        });

        if (!res.ok) {
            console.error(`❌ Image Gen Failed: ${res.status} ${res.statusText}`);
            console.error(await res.text());
            process.exit(1);
        }

        const data = await res.json();
        console.log('📸 Response:', JSON.stringify(data, null, 2));

        if (data.data && data.data[0] && data.data[0].url) {
            console.log('✅ Image URL Received:', data.data[0].url);
        } else {
            console.error('❌ Data format mismatch/No URL');
            process.exit(1);
        }

    } catch (e) {
        console.error('❌ Image Gen Error', e.message);
        process.exit(1);
    }

    console.log('🏁 Verification Completed');
}

testImageGen();
