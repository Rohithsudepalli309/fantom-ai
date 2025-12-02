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
2. Create `.env` (or `.env.local`) and set your env:
    - Text/Chat/Vision (optional): `VITE_GEMINI_API_KEY=YOUR_GEMINI_KEY`
    - Image (local Stable Diffusion / Automatic1111):
       - `VITE_LOCAL_SD=http://127.0.0.1:7860`
       - `VITE_USE_LOCAL_AI=true`
      - Start A1111 with: `--api --cors-allow-origins=http://localhost:5173,http://127.0.0.1:5173`
      - Dev proxy: the app proxies `/sdapi` to `VITE_LOCAL_SD` via Vite (no CORS required in dev)

3. Run the app:
    `npx pnpm dev`

## Environment and Security

- Use `.env.local` for local-only secrets; it is git-ignored by default.
- Supported flags (examples):
   - `VITE_AUTH_PROVIDER=auto|supabase|firebase|local`
   - `VITE_AUTH_ALLOW_SIGNUP=false` (disable public signups)
   - `VITE_AUTH_IDLE_TIMEOUT_MIN=30` (auto sign-out on inactivity)
   - `VITE_USE_LOCAL_AI=false` (set to true to route text to a local LLM)

## Image Generation

- Uses local Stable Diffusion (Automatic1111) only.
- Supported model presets (ensure installed in A1111):
  - stabilityai/stable-diffusion-xl-base-1.0
  - stable-diffusion-v1-5/stable-diffusion-v1-5
  - Lykon/DreamShaper
  - CompVis/stable-diffusion-v1-4
 - UI supports aspect ratio, optional width/height, style, steps, CFG, and negative prompt.

## Multi-Provider Architecture

Active AI provider can be selected at runtime (Settings or `localStorage.setItem('VITE_AI_PROVIDER', 'nemotron')`).

Supported modalities by provider:

| Provider    | Text / Chat | Vision (Image Understanding) | Image Generation | Video Generation |
|-------------|-------------|------------------------------|------------------|------------------|
| Gemini      | Yes         | Yes                          | Via Stability/local SD wrapper | Planned* |
| Nemotron Nano 12B 2 VL | Yes | Yes | Not supported (fallback Stability / SD) | Not supported |
| Local LLM (Ollama) | Yes | Yes (text-only heuristic) | No | No |
| Stability API | No (images only) | No | Yes | No |
| Local Stable Diffusion | No | No | Yes | No |

Notes:
- Nemotron integration uses placeholder REST schema (`/v1/chat/completions`, `/v1/vision`). Adjust when official spec differs.
- Web search (grounding) currently only implemented for Gemini; Nemotron requests with web search enabled will return an error.
- VideoGeneration component is a placeholder pending a supported model/API.

Environment variables for Nemotron (set in `.env.local`):
```
VITE_AI_PROVIDER=nemotron
VITE_NVIDIA_API_KEY=YOUR_KEY
VITE_NVIDIA_BASE_URL=https://api.nvidia.com   # or provided endpoint
VITE_NVIDIA_MODEL=nemotron-nano-12b-2-vl
```

To switch providers at runtime without rebuild (browser console):
```js
localStorage.setItem('VITE_AI_PROVIDER', 'gemini'); // or 'nemotron' | 'local'
window.location.reload();
```


## Quick Smoke Tests

From the project root:

```powershell
npx pnpm smoke:text    # text generation
npx pnpm smoke:vision  # vision (describe public/logo.png)
```

## Troubleshooting

- Failed to fetch or CORS errors for image generation:
   - Ensure A1111 is running with `--api --cors-allow-origins=http://localhost:5173,http://127.0.0.1:5173`.
   - Confirm `VITE_LOCAL_SD` points to your A1111 URL.
- 503 UNAVAILABLE in Vision smoke:
   - The model may be temporarily overloaded. Retry after a short delay.
- Windows EPERM during install:
   - Use `npx pnpm install`; approve builds when prompted: `npx pnpm approve-builds`.
