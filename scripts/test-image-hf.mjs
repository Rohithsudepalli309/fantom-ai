import 'dotenv/config';

const token = process.env.VITE_HF_API_TOKEN || process.env.HF_API_TOKEN;
if (!token) {
  console.error('HF token missing. Add VITE_HF_API_TOKEN to your .env');
  process.exit(1);
}

const model = process.env.VITE_HF_IMAGE_MODEL || 'stabilityai/sdxl-turbo';
const prompt = 'minimal line icon, circle, black on white';
const aspect = '1:1';
let width = 1024, height = 1024;
if (aspect === '16:9') { width = 1344; height = 768; }
if (aspect === '9:16') { width = 768; height = 1344; }

const body = {
  inputs: prompt,
  parameters: {
    width,
    height,
    num_inference_steps: 4,
    guidance_scale: 0,
  }
};

// Updated endpoint per deprecation notice
const url = `https://router.huggingface.co/hf-inference/models/${encodeURIComponent(model)}`;

const tryOnce = async () => {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'image/png'
    },
    body: JSON.stringify(body)
  });
  return res;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let res = await tryOnce();
let attempts = 0;
while (!res.ok && attempts < 3) {
  let msg = '';
  try { const j = await res.clone().json(); msg = String(j?.error || ''); } catch {}
  if (res.status === 503 || msg.toLowerCase().includes('loading')) {
    attempts++;
    await sleep(1500 * attempts);
    res = await tryOnce();
    continue;
  }
  break;
}

if (!res.ok) {
  let detail = `${res.status} ${res.statusText}`;
  try { const j = await res.json(); if (j?.error) detail = j.error } catch {}
  console.error('HF generation failed:', detail);
  process.exit(2);
}

const buf = Buffer.from(await res.arrayBuffer());
const b64 = buf.toString('base64');
console.log('HF OK', { model, bytes: buf.length, dataUrlPrefix: 'data:image/png;base64,' + b64.slice(0, 40) + '...' });
