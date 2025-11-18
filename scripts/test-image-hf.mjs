import 'dotenv/config';

const token = process.env.VITE_HF_API_TOKEN || process.env.HF_API_TOKEN;
if (!token) {
  console.error('HF token missing. Add VITE_HF_API_TOKEN to your .env');
  process.exit(1);
}

const preferredModel = process.env.VITE_HF_IMAGE_MODEL || 'stabilityai/stable-diffusion-xl-base-1.0';
const candidateModels = Array.from(new Set([
  preferredModel,
  'stabilityai/sd-turbo',
  'black-forest-labs/FLUX.1-schnell',
  'segmind/SSD-1B'
]));
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

const routerUrlFor = (m) => `https://router.huggingface.co/hf-inference/models/${encodeURIComponent(m)}`;
const legacyUrlFor = (m) => `https://api-inference.huggingface.co/models/${encodeURIComponent(m)}`;

const tryOnce = async (url) => {
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

async function tryModel(modelName) {
  // 1) Try router endpoint first with limited retries for 503/loading
  let res = await tryOnce(routerUrlFor(modelName));
  let attempts = 0;
  while (!res.ok && attempts < 2) {
    let msg = '';
    try { const j = await res.clone().json(); msg = String(j?.error || ''); } catch {}
    if (res.status === 503 || msg.toLowerCase().includes('loading')) {
      attempts++;
      await sleep(1500 * attempts);
      res = await tryOnce(routerUrlFor(modelName));
      continue;
    }
    break;
  }
  // 2) Router is the supported API; if it's a permission/not-found issue, skip to next model
  return res;
}

let res;
let usedModel = '';
for (const m of candidateModels) {
  const attempt = await tryModel(m);
  if (attempt.ok) { res = attempt; usedModel = m; break; }
  // Skip on hard errors and continue trying next model
  if ([401, 403, 404, 405].includes(attempt.status)) {
    continue;
  } else {
    // For other errors like 5xx, try next candidate after a short delay
    await sleep(800);
    continue;
  }
}

if (!res || !res.ok) {
  let detail = res ? `${res.status} ${res.statusText}` : 'no response';
  try { if (res) { const j = await res.json(); if (j?.error) detail = j.error } } catch {}
  console.error('HF generation failed:', detail);
  process.exit(2);
}
if (!res.ok) {
  let detail = `${res.status} ${res.statusText}`;
  try { const j = await res.json(); if (j?.error) detail = j.error } catch {}
  console.error('HF generation failed:', detail);
  process.exit(2);
}

const buf = Buffer.from(await res.arrayBuffer());
const b64 = buf.toString('base64');
console.log('HF OK', { model: usedModel, bytes: buf.length, dataUrlPrefix: 'data:image/png;base64,' + b64.slice(0, 40) + '...' });
