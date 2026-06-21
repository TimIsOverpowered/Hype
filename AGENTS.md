# Hype v2.0 - AI Agent Instructions

## 🎯 Project Overview

Hype is a desktop application for visualizing Twitch chat data and clipping Twitch VODs.

## 🛠 Tech Stack

- **Backend/Desktop:** Tauri v2 (Rust)
- **Frontend:** React 19, Vite, TypeScript
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite`, no `tailwind.config.js`), shadcn/ui
- **Media Processing:** FFmpeg-next RUST
- **Video Player:** Native `<video>` + hls.js
- **Charting/Graphs:** Apache ECharts (`echarts-for-react`)
- **State/Fetching:** TanStack Query v5, React Router v7

## 📜 Strict Coding Guidelines

### 1. TypeScript & Types

- Use **Strict TypeScript** for all files (`.ts`, `.tsx`).
- **NEVER** use `any`. Define strict interfaces for all external data, especially Twitch GraphQL responses.
- Prefer `interface` for object shapes and `type` for unions/intersections.
- **NEVER** use dynamic imports

### 2. Architecture & Performance

- **Web Workers are Mandatory:** Any heavy data processing—specifically ZSTD log decoding, large chat array parsing, and parsing 7TV/BTTV/FFZ emotes—MUST be offloaded to a Web Worker to prevent main-thread UI freezing.
- **Tauri Native APIs:** Replace any Node.js `fs` or `path` logic with Tauri's native Rust plugins (`@tauri-apps/plugin-fs`, `@tauri-apps/plugin-dialog`).
- **MediaBunny over FFmpeg:** Do not spawn backend FFmpeg processes. All video clipping, chunk fetching (`.m3u8`), and transmuxing will be handled frontend-side via MediaBunny and WebCodecs.

### 3. Styling & UI

- Use **Tailwind CSS v4** syntax. Do not generate or look for a `tailwind.config.js` file. Custom theme variables should be defined in `index.css` using the `@theme` directive.
- Keep components small and functional. Use React 19's native hooks appropriately.
- Replace all legacy spinning loaders with Tailwind animated skeleton screens (`animate-pulse`).

### 4. Code Generation Rules

- When writing code, prioritize readability, early returns, and immutability.
- If migrating an old v1.0 function, translate the logic directly into TypeScript, but discard any MUI (`@mui/material`) or Electron (`ipcRenderer`) wrappers.
- Do not hallucinate package versions. Stick to the stack defined above.

### 5. Linting & TypeScript Strictness

- **Linter/Formatter:** Use **Biome** instead of ESLint/Prettier. The AI must ensure code adheres to Biome's recommended rules and formatting constraints.
- **Type Safety:** \* The project runs on strict mode (`"strict": true`). This is the single most important safety net.
  - `any` is strictly banned (`noImplicitAny: true` and `noExplicitAny: "error"`).
  - Ensure all variables, function parameters, and return types are explicitly typed or properly inferred.
- **Component Safety:** React components must avoid using array indices as keys (`noArrayIndexKey`).

## After every file edit

- Run `npx tsc --noEmit` to typecheck
- Run `npm run lint` to see any eslint issues
- Run `cargo check` in src-tauri to see any rust issues
- Do not move on to the next task until both pass
