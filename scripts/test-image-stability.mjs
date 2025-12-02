import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const key = process.env.VITE_STABILITY_API_KEY || process.env.STABILITY_API_KEY;
if (!key) {
  console.error('Stability API key missing. Set VITE_STABILITY_API_KEY in .env.local');
  process.exit(1);
}

const prompt = 'minimal line icon, circle, black on white';
const width = Number(process.env.STAB_WIDTH || 1024);
const height = Number(process.env.STAB_HEIGHT || 1024);
const steps = Number(process.env.STAB_STEPS || 20);
const cfg = Number(process.env.STAB_CFG || 7);

const urls = [
  'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
  'https://api.stability.ai/v1/generation/stable-diffusion-xl-base-1.0/text-to-image'
];

async function main() {
  const body = {
    text_prompts: [{ text: prompt }],
    width,
    height,
    steps,
    cfg_scale: cfg,
    samples: 1,
  };

  let lastErr;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        lastErr = `${res.status} ${res.statusText} ${txt.slice(0, 200)}`;
        continue;
      }
      const json = await res.json();
      const b64 = json?.artifacts?.[0]?.base64;
      if (!b64) {
        lastErr = 'no image in response';
        continue;
      }
      console.log('Stability SDXL OK', { modelPath: url.split('/').slice(-2, -1)[0], bytes: Buffer.byteLength(b64, 'base64'), dataUrlPrefix: 'data:image/png;base64,' + b64.slice(0, 40) + '...' });
      return;
    } catch (e) {
      lastErr = e?.message || String(e);
    }
  }
  console.error('Stability SDXL failed:', lastErr || 'unknown error');
  // Try v2beta fallback API for SDXL
  try {
    const fd = new FormData();
    fd.set('prompt', prompt);
    fd.set('output_format', 'png');
    fd.set('width', String(width));
    fd.set('height', String(height));
    fd.set('steps', String(steps));
    fd.set('cfg_scale', String(cfg));
    const res = await fetch('https://api.stability.ai/v2beta/stable-image/generate/sdxl', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}` },
      body: fd,
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error('Stability SDXL v2beta failed:', `${res.status} ${res.statusText}`, txt.slice(0, 200));
      process.exit(2);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    console.log('Stability SDXL OK', { modelPath: 'v2beta/sdxl', bytes: buf.byteLength, dataUrlPrefix: 'data:image/png;base64,' + buf.toString('base64').slice(0, 40) + '...' });
  } catch (e) {
    console.error('Stability SDXL v2beta error:', e?.message || String(e));
    process.exit(2);
  }
}

await main();
