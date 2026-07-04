# What & why

<!-- One tight paragraph: what changed and the problem it solves. -->

Closes #

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change (public API, `ErdPayload` shape, or theme tokens)
- [ ] Refactor (no behavior change)
- [ ] Docs only

## Area

- [ ] Component (`src/ErdFlow.tsx`, props)
- [ ] Nodes / edges (`src/components/`)
- [ ] Layout (`src/layout/`)
- [ ] Payload contract (`src/types/erd.ts`, `src/payload.ts`)
- [ ] Theming (`src/theme.ts`, `--erd-*` tokens, CSS)
- [ ] Build / packaging (`vite.config.ts`, `package.json`)
- [ ] Tests
- [ ] Docs
- [ ] CI (`.github/workflows/`)

## How to test

<!-- The real commands a reviewer runs to see it working. -->

```bash
task test
```

## Checklist

- [ ] `npx tsc --noEmit` passes (strict — this is the type gate; there is no lint step)
- [ ] `npx vitest run` passes
- [ ] `npm run build` produces `dist/index.js` + `dist/index.d.ts` + `dist/erd-flow.css` (when the change affects the build)
- [ ] `tableConstants.ts` ↔ `ErdTableNode.css` geometry changed in lockstep (when card geometry changed)
- [ ] No hardcoded colours — every colour reads a `var(--erd-*, #hex)` token
- [ ] `ErdPayload` shape unchanged, or the `erd-payload-contract` skill was consulted and both hosts considered
- [ ] Peer deps stayed peers (nothing moved into `dependencies`; new externals added to both `rollupOptions.external` and `peerDependencies`)
- [ ] README props table / token list updated for any new prop or token
- [ ] `.claude/design_patterns.md` updated when a load-bearing pattern was added or removed

## Screenshots / notes

<!-- For visual changes: a before/after from `npm run dev`. Otherwise delete. -->
