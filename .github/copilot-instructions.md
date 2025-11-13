# Copilot project instructions for Fantom AI (React + Vite + TS)

These instructions tailor GitHub Copilot (and AI agents) to this repository so generated code fits our stack and conventions.

## Tech stack
- React 18, Vite 6, TypeScript 5
- TailwindCSS for styling
- Google GenAI SDK (`@google/genai`) in `services/geminiService.ts`
- SPA entry at `index.html`, root component in `App.tsx`

## Core conventions
- Use functional React components with hooks; avoid class components.
- Prefer composition over large monoliths. Co-locate component logic and styles.
- Styling: use Tailwind utility classes. Avoid inline styles unless dynamic.
- Paths: public assets live under `public/`. App-wide logo path: `/logo.png`.
- Types: keep components typed but pragmatic. Our repo contains a minimal `types/react.d.ts`; avoid depending on niche DOM types in shared components to prevent TS friction.
- State: local UI state with React hooks. No global state lib.
- Imports: absolute alias `@/` maps to repo root (see `vite.config.ts`).

## Logo/branding
- Single source of truth: `components/Logo.tsx` renders `/public/logo.png` by default and is used in App hero, Sidebar brand, and Chat avatar.
- Favicon is also `/public/logo.png` via `index.html` so replacing `public/logo.png` updates UI and favicon.
- When adding new views, import and use `<Logo />` instead of duplicating images or SVGs.

## Components and structure
- Top-level features mirror files: `TextGeneration.tsx`, `Chat.tsx`, `ImageGeneration.tsx`, `Vision.tsx`, `SystemStatus.tsx` and corresponding versions under `components/`.
- Use `components/` for reusable UI (e.g., `Sidebar`, `PromptLibrary`, `ThemeSwitcher`).
- Keep component props minimal and typed in-line. Prefer explicit prop objects over `any`.

## Services
- `services/geminiService.ts` wraps Google GenAI calls. Reuse and extend it; don’t call the SDK directly from components.
- Read API key from Vite env: `import.meta.env.VITE_GEMINI_API_KEY`. Do not access `process.env` in client code except via `vite.config.ts` defines.

## Error handling
- Wrap risky UI trees with `components/ErrorBoundary.tsx`.
- In services, catch and return typed errors; surface friendly messages in UI.

## Accessibility and UX
- Provide `aria-label` and proper `alt` text.
- Ensure keyboard navigation; focus management for dialogs/menus.

## Testing/dev
- Prefer small integration tests if adding a test setup (none present yet). Keep examples minimal and runnable under Vite.
- Run locally: `npm run dev`. Build: `npm run build`. Preview: `npm run preview`.

## When generating code
- Respect TypeScript: include types/interfaces where helpful; avoid over-typing.
- Use Tailwind for layout; avoid CSS files unless necessary.
- Keep imports relative to `@/` or local folders. Don’t introduce new global state libs or styling systems.
- For async calls, prefer `async/await`, abort controllers for cancellations, and small typed helpers.

## Small examples
- Importing a service:
  ```ts
  import { textGenerate } from '@/services/geminiService';
  ```
- Using the shared logo:
  ```tsx
  import Logo from '@/components/Logo';
  <Logo className="h-8 w-auto" altText="Fantom AI" />
  ```

## Guardrails
- Don’t leak or hardcode API keys. Use `.env` and Vite env variables.
- Don’t reintroduce the old inline `FantomAIIcon`; prefer `Logo`.
- Keep bundle size reasonable; avoid heavy deps without discussion.
