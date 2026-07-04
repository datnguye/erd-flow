---
description: Start the Vite dev server (the demo / playground) to iterate on node and edge rendering.
---

Start the Vite dev server so I can iterate on the ERD component visually.

Run `npm run dev` with `run_in_background: true`, then print:

- the demo URL: `http://localhost:5173/demo/index.html` (the repo root has no
  `index.html` — the playground entry is `demo/index.html`, so the bare root
  URL 404s).
- a reminder that the dev server renders the local `src/` — edits hot-reload, so
  I can watch node/edge/layout changes live.

If it fails to start within ~10 seconds, report the error output. This is the
right loop for anything visual: custom node internals, FK-edge anchoring, or a
layout engine, where the vitest suite can't show you the rendered result.
