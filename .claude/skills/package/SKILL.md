---
name: package
description: Use when building the library locally or reasoning about how a host consumes it — the Vite library-mode dist (ESM + .d.ts + styles.css), externalized peer deps, the exports map, and how a host mounts <ErdFlow>. This skill builds and verifies; it never publishes.
---

# Building & consuming @datnguye/erd-flow

Produce the `dist/` a host imports. **This is for building/verifying — real
releases publish to npm via the `release` skill / `release-manager` agent.**

## What the build emits

`npm run build` = `tsc -b && vite build`, driven by `vite.config.ts` in library
mode. It writes three things to `dist/`:

1. **`index.js`** — one ESM bundle (Vite `lib.formats: ["es"]`).
2. **`index.d.ts`** — rolled-up type declarations (`vite-plugin-dts` with
   `rollupTypes: true`).
3. **`erd-flow.css`** — the one stylesheet (`assetFileNames: "erd-flow.[ext]"`).

`package.json` `files: ["dist"]` means **only `dist/` is published** — source and
tests are not.

## Peer deps are externalized (load-bearing)

`react`, `react-dom`, `react/jsx-runtime`, `@xyflow/react`, and `@dagrejs/dagre`
are in `rollupOptions.external` **and** in `peerDependencies` — never in
`dependencies`. The host owns their versions; bundling them would double-load
React and break hooks. If you add a new external:

- Add it to `rollupOptions.external` in `vite.config.ts`, **and**
- Add it to `peerDependencies` in `package.json`.

Do both or neither — a mismatch either bloats the bundle or crashes the host.

## The exports map

```jsonc
"exports": {
  ".":            { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
  "./styles.css": "./dist/erd-flow.css"
}
```

`sideEffects: ["*.css"]` keeps the stylesheet from being tree-shaken away. So a
host does:

```tsx
import { ErdFlow } from "@datnguye/erd-flow";
import "@datnguye/erd-flow/styles.css";

<div style={{ width: "100%", height: "100vh" }}>
  <ErdFlow
    data={payload}                       // ErdPayload (dbterd-native shape)
    layout="radial"
    onOpenNode={(n) => open(n.model_path)}
    onNodeActivate={(n) => setDetails(n)}
    theme={{ nodeBg: "var(--vscode-editor-background)" }}  // maps host tokens → --erd-*
  />
</div>
```

`<ErdFlow>` fills its parent — the parent must have an explicit size. The public
API is exactly what `src/index.ts` exports: `ErdFlow`, the `Erd*` payload and
prop types, the layout registry (`registerLayout`/`resolveLayout`,
`LAYOUT_STYLES`/`isLayoutStyle`, `toFlowGraph`, `measureNodes` + their types),
the payload helpers (`windowPayload`/`erdNeighborhood`/`compactColumns`), and
the theme helpers (`themeStyle`, `DEFAULT_RESOURCE_META`). Every name there is
a semver commitment — check the barrel before assuming something is internal.

## Build & verify (sequential)

1. **Install** — `task install` (or `npm install`). Idempotent.
2. **Gate** — `npx tsc --noEmit && npx vitest run`. Strict typecheck is the only
   lint gate (no ESLint in this repo); tests must pass.
3. **Build** — `task build` (or `npm run build`).
4. **Inspect** — confirm all three artefacts exist and are non-empty:

   ```bash
   ls -lh dist/index.js dist/index.d.ts dist/erd-flow.css
   ```

   A missing `.d.ts` means `vite-plugin-dts` didn't run (types broken); a missing
   `erd-flow.css` means no component imported a stylesheet, or `assetFileNames`
   changed — either way the host's `import ".../styles.css"` will 404.
5. **Sanity-check the externals stayed external** — the peers must appear as
   `import` specifiers in the ESM bundle, not as inlined source:

   ```bash
   grep -oE 'from ?"(react|react-dom|react/jsx-runtime|@xyflow/react|@dagrejs/dagre)"' dist/index.js | sort -u
   # expect the externals listed; a bundled React would instead bloat the file
   # (index.js should stay in the tens of kB, not hundreds)
   ```

## Warnings to surface

- **If `dist/` is stale** (older than the newest `src/` file), say so — a host
  linking this package locally will consume the old build.
- **If the working tree is dirty**, the build reflects uncommitted changes. Fine
  for local verification, a footgun if the user thinks they built a known commit.

## Boundaries

This skill **never** runs `npm publish`, bumps the `version` field, creates a git
tag, or creates a GitHub Release. For any of those, redirect to the `release`
skill or the `release-manager` agent.
