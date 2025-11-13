// Minimal Gemini API smoke test (text and optional image)
// Usage:
//   node scripts/smoke-gemini.mjs           # text only
//   node scripts/smoke-gemini.mjs --image   # text + image nano

import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback to .env if present

const key = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!key) {
  console.error('Gemini key missing. Set VITE_GEMINI_API_KEY in .env.local');
  process.exit(2);
}

const client = new GoogleGenAI({ apiKey: key });

async function testText() {
  try {
    const resp = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'ping'
    });
    const text = (resp.text || '').trim();
    console.log('[text] ok:', Boolean(text), text ? text.slice(0, 60) : '');
  } catch (e) {
    console.error('[text] fail:', e?.message || String(e));
    process.exitCode = 1;
  }
}

async function testImageNano() {
  try {
    const resp = await client.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: 'a small solid red square icon' }] },
      config: { responseModalities: ['IMAGE'] }
    });
    const part = resp?.candidates?.[0]?.content?.parts?.[0];
    const b64 = part?.inlineData?.data;
    console.log('[image-nano] ok:', Boolean(b64), b64 ? `len=${b64.length}` : '');
  } catch (e) {
    console.error('[image-nano] fail:', e?.message || String(e));
    // Do not hard fail prod if image is restricted; leave nonzero code but continue
    process.exitCode = 1;
  }
}

const wantImage = process.argv.includes('--image');

await testText();
if (wantImage) {
  await testImageNano();
}
