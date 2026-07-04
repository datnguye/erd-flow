---
description: Build the library into dist/ (ESM + .d.ts + styles.css) and verify the three artefacts. Publishing is separate — see /release.
---

Invoke the **`package`** skill — it holds the full procedure (the Vite
library-mode build via `task build`, the externalized peer deps, the exports
map, and verifying `dist/index.js` + `dist/index.d.ts` + `dist/erd-flow.css`).

This produces the local `dist/` a host imports. It does not bump the version,
tag, or publish — for that, use `/release` or the `release-manager` agent.
