// Minimal Gemini vision smoke test: describe a tiny red square image
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config({ path: '.env.local' });
dotenv.config();

const key = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!key) {
  console.error('Gemini key missing. Set VITE_GEMINI_API_KEY in .env.local');
  process.exit(2);
}

// 1x1 red PNG (pure #FF0000)
const RED_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR42mP8z/C/HwAIAwMDw0yQYwAAAABJRU5ErkJggg==';

function readImageB64(filePath) {
  const abs = path.resolve(process.cwd(), filePath);
  const buf = fs.readFileSync(abs);
  return buf.toString('base64');
}

const client = new GoogleGenAI({ apiKey: key });

async function main() {
  try {
    const fileArg = process.argv.find((a) => a.startsWith('--file='));
    const assertArg = process.argv.find((a) => a.startsWith('--assert='));
    const useRed = process.argv.includes('--use-red');
    const assertColor = assertArg ? assertArg.split('=')[1].toLowerCase() : undefined;

    let b64;
    let mime = 'image/png';
    if (useRed) {
      // Some models may reject very small images; use with caution
      b64 = RED_PNG_BASE64;
      mime = 'image/png';
    } else {
      const filePath = fileArg ? fileArg.split('=')[1] : 'public/logo.png';
      b64 = readImageB64(filePath);
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
      if (ext === '.webp') mime = 'image/webp';
      if (ext === '.png') mime = 'image/png';
    }

    const imagePart = { inlineData: { data: b64, mimeType: mime } };
    const textPart = { text: 'What color is the pixel? Respond with a single common color word.' };
    const resp = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] }
    });
    const text = (resp.text || '').toLowerCase().trim();
    const detected = text.split(/\W+/).find(Boolean) || '';
    let ok = Boolean(text);
    if (assertColor) ok = text.includes(assertColor);

    console.log('[vision] ok:', ok, '-', detected || text.slice(0, 120));
    process.exitCode = ok ? 0 : 1;
  } catch (e) {
    console.error('[vision] fail:', e?.message || String(e));
    process.exit(1);
  }
}

await main();
