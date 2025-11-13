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

function readImageB64(filePath) {
  const abs = path.resolve(process.cwd(), filePath);
  const buf = fs.readFileSync(abs);
  return buf.toString('base64');
}

const client = new GoogleGenAI({ apiKey: key });

async function main() {
  try {
    const fileArg = process.argv.find((a) => a.startsWith('--file='));
    const filePath = fileArg ? fileArg.split('=')[1] : 'public/logo.png';
    const b64 = readImageB64(filePath);
    const imagePart = { inlineData: { data: b64, mimeType: 'image/png' } };
    const textPart = { text: 'What color is the pixel?' };
    const resp = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] }
    });
    const text = (resp.text || '').toLowerCase();
    const ok = text.includes('red');
    console.log('[vision] ok:', ok, '-', (resp.text || '').slice(0, 120));
    process.exitCode = ok ? 0 : 1;
  } catch (e) {
    console.error('[vision] fail:', e?.message || String(e));
    process.exit(1);
  }
}

await main();
