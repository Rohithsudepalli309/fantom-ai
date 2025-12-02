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

console.log(`Using Model: ${model}`);
console.log(`Using Base URL: ${base}`);

async function testText() {
    console.log('\n--- Testing Text Generation ---');
    const url = `${base}/v1/chat/completions`;
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: 'Say "Text test passed" if you can read this.' }],
                max_tokens: 50,
                stream: false
            })
        });

        if (!resp.ok) throw new Error(`Status ${resp.status}: ${await resp.text()}`);
        const data = await resp.json();
        console.log('SUCCESS:', data.choices?.[0]?.message?.content?.trim());
        return true;
    } catch (e) {
        console.error('FAILED:', e.message);
        return false;
    }
}

async function testChat() {
    console.log('\n--- Testing Chat (Context) ---');
    const url = `${base}/v1/chat/completions`;
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: 'Hi, my name is Fantom.' },
                    { role: 'assistant', content: 'Hello Fantom! How can I help you?' },
                    { role: 'user', content: 'What is my name?' }
                ],
                max_tokens: 50,
                stream: false
            })
        });

        if (!resp.ok) throw new Error(`Status ${resp.status}: ${await resp.text()}`);
        const data = await resp.json();
        console.log('SUCCESS:', data.choices?.[0]?.message?.content?.trim());
        return true;
    } catch (e) {
        console.error('FAILED:', e.message);
        return false;
    }
}

async function testVision() {
    console.log('\n--- Testing Vision ---');
    const url = `${base}/v1/chat/completions`;
    // 1x1 transparent pixel png
    const imageUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Big_%26_Small_Pumkins.JPG/800px-Big_%26_Small_Pumkins.JPG";

    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify({
                model,
                messages: [
                    {
                        role: 'user', content: [
                            { type: 'text', text: 'What is in this image? Describe it briefly.' },
                            { type: 'image_url', image_url: { url: imageUrl } }
                        ]
                    }
                ],
                max_tokens: 100,
                stream: false
            })
        });

        if (!resp.ok) throw new Error(`Status ${resp.status}: ${await resp.text()}`);
        const data = await resp.json();
        console.log('SUCCESS:', data.choices?.[0]?.message?.content?.trim());
        return true;
    } catch (e) {
        console.error('FAILED:', e.message);
        return false;
    }
}

async function testImageGeneration() {
    console.log('\n--- Testing Image Generation ---');
    // Note: Nemotron Nano 12B might NOT support image generation directly via this endpoint.
    // This test checks if the configured endpoint responds.
    // If using a specific image model, the URL might differ.
    // Based on nemotronService.ts, it uses /v1/images/generations

    const url = `${base}/v1/images/generations`;
    // Usually image gen requires a different model like 'stabilityai/stable-diffusion-xl-base-1.0'
    // But let's try with the current model or a standard one if the user has access.
    // The user's key is for Nemotron Nano, which is a VLM (Vision Language Model).
    // It might not support image generation. We will try anyway to see the error or success.

    // We'll try a known image model if the default doesn't work, but for now let's stick to the env model
    // or a hardcoded one if we suspect the env model is text-only.
    // Let's try the env model first.

    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify({
                model: model, // Trying the VLM model
                prompt: "A simple red circle",
                size: "256x256",
                n: 1
            })
        });

        if (!resp.ok) {
            // If the VLM model fails, it might be because it's not an image gen model.
            // We can try a standard one if available, but for now we report the result.
            throw new Error(`Status ${resp.status}: ${await resp.text()}`);
        }
        const data = await resp.json();
        console.log('SUCCESS: Image URL generated');
        return true;
    } catch (e) {
        console.error('FAILED:', e.message);
        console.log('NOTE: Image generation might fail if the model is text/vision only.');
        return false;
    }
}

async function runAll() {
    await testText();
    await testChat();
    await testVision();
    // await testImageGeneration(); // Commenting out for now as Nemotron Nano is likely VLM only
}

runAll();
