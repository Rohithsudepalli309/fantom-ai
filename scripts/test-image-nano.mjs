import 'dotenv/config';
import { GoogleGenAI, Modality } from '@google/genai';

const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
if (!apiKey) {
  console.error('Gemini API key missing. Add VITE_GEMINI_API_KEY to your .env');
  process.exit(1);
}

const client = new GoogleGenAI({ apiKey });

const prompt = 'minimal line icon, circle, black on white';
try {
  const resp = await client.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: { responseModalities: [Modality.IMAGE] }
  });
  const part = resp.candidates?.[0]?.content?.parts?.[0];
  if (part?.inlineData?.data) {
    console.log('Nano OK', { bytes: Buffer.byteLength(part.inlineData.data, 'base64'), prefix: part.inlineData.data.slice(0, 32) + '...' });
    process.exit(0);
  }
  console.error('Nano did not return image. Finish reason:', resp.candidates?.[0]?.finishReason);
  process.exit(2);
} catch (e) {
  console.error('Nano test failed:', e?.message || e);
  process.exit(3);
}
