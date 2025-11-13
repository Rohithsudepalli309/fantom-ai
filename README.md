<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/12N1CJQZvGi3y1cB_A3H64o-c7-Ne4qih

## Run Locally

Prerequisites: Node.js 18+

1. Install dependencies:
   `npx pnpm install`
2. Create `.env` (or `.env.local`) and set your keys:
   - Required (text/chat/vision): `VITE_GEMINI_API_KEY=YOUR_GEMINI_KEY`
   - Optional (free image generation fallback):
     - `VITE_HF_API_TOKEN=YOUR_HUGGING_FACE_TOKEN`
     - `VITE_HF_IMAGE_MODEL=stabilityai/sdxl-turbo` (optional override)

   Notes:
   - If `VITE_HF_API_TOKEN` is present, Image Generation will use the Hugging Face Inference API first.
   - If not present, it will attempt Google Imagen (which may require a billed account).
   - You can also switch to the “Nano” image model in the UI to avoid Imagen.

3. Run the app:
    `npx pnpm dev`

## Environment and Security

- Use `.env.local` for local-only secrets; it is git-ignored by default.
- Supported flags (examples):
   - `VITE_AUTH_PROVIDER=auto|supabase|firebase|local`
   - `VITE_AUTH_ALLOW_SIGNUP=false` (disable public signups)
   - `VITE_AUTH_IDLE_TIMEOUT_MIN=30` (auto sign-out on inactivity)
   - `VITE_USE_LOCAL_AI=false` (set to true to route text to a local LLM)

## Image Providers

- Default selection:
   - If `VITE_HF_API_TOKEN` exists → defaults to Hugging Face provider.
   - Otherwise → defaults to Google “Nano” image model.
- You can switch providers in the Image tab: Imagen | Nano | HF.
   - Imagen may require a billed Google GenAI account.

## Quick Smoke Tests

From the project root:

```powershell
npx pnpm smoke:text    # text generation
npx pnpm smoke:image   # image (Google image APIs may require billing)
npx pnpm smoke:image:hf # image via Hugging Face (requires VITE_HF_API_TOKEN)
npx pnpm smoke:vision  # vision (describe public/logo.png)
```

## Troubleshooting

- RESOURCE_EXHAUSTED / quota errors on image generation:
   - Add `VITE_HF_API_TOKEN` to `.env.local` and use the Hugging Face provider.
   - Or enable billing for Google image models.
- 503 UNAVAILABLE in Vision smoke:
   - The model may be temporarily overloaded. Retry after a short delay.
- Windows EPERM during install:
   - Use `npx pnpm install`; approve builds when prompted: `npx pnpm approve-builds`.
