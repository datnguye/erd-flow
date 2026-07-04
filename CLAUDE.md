# erd-flow

`@datnguye/erd-flow` is a standalone **React + TypeScript npm library**: a
reusable [React Flow](https://reactflow.dev) entity-relationship diagram for dbt
projects. It renders [dbterd](https://github.com/datnguye/dbterd)'s native
`json`-target shape directly — table nodes with per-column PK/FK badges,
self-drawing foreign-key edges that land on the exact joined rows, and pluggable
layouts (hierarchical / radial / force). The host hands it `data` and a couple
of callbacks; the graph owns no transport and no theme of its own, so one
diagram powers both dbt-docs (a static SPA) and dbterd-vscode (a webview).

It builds in Vite **library mode** to `dist/` (ESM + `.d.ts` + `erd-flow.css`),
externalizing its peer deps. It is **not** a server, **not** a VS Code
extension, **not** a Python project — there is exactly one npm package here.

## Table of contents

- [erd-flow](#erd-flow)
  - [Table of contents](#table-of-contents)
  - [Repo layout](#repo-layout)
  - [The ErdPayload contract](#the-erdpayload-contract)
  - [Workflows](#workflows)
  - [Conventions](#conventions)
  - [Design patterns](#design-patterns)
  - [Agentic setup](#agentic-setup)
  - [Agent memory](#agent-memory)
  - [External docs via context7 MCP](#external-docs-via-context7-mcp)
  - [Delegating work](#delegating-work)

## Repo layout

```
erd-flow/
├── src/
│   ├── index.ts               # the public API surface (the only barrel)
│   ├── ErdFlow.tsx            # the <ErdFlow> component (controlled-or-uncontrolled)
│   ├── ErdFlow.css            # canvas + chrome styles (--erd-* tokens)
│   ├── payload.ts             # focus windowing + compact (windowPayload/erdNeighborhood/compactColumns)
│   ├── theme.ts               # --erd-* token map + DEFAULT_RESOURCE_META
│   ├── components/            # the node + edge concerns:
│   │   ├── ErdTableNode.tsx / .css   # the table-card node (height-pinned to tableConstants)
│   │   ├── tableConstants.ts         # card geometry — pinned to ErdTableNode.css in lockstep
│   │   ├── edge-anchor.ts            # index-based column-row anchor (shared by both edges)
│   │   ├── single-edge/              # single-column self-drawing FK edge
│   │   ├── composite-edge/           # multi-column bundled FK edge (+ geometry.ts)
│   │   ├── column-highlight.ts       # selected-edge → highlighted columns
│   │   ├── icons.tsx, nodeTypes.ts, edgeTypes.ts   # icon set + React Flow registries
│   ├── layout/                # the layout registry:
│   │   ├── index.ts           # LAYOUT_STYLES + registerLayout/resolveLayout + toFlowGraph
│   │   ├── dagre.ts / radial.ts / force.ts   # the three engines
│   │   ├── graph.ts           # shared adjacency / component / island-grid helpers
│   │   ├── dimensions.ts      # pre-size a card for layout (reads tableConstants)
│   │   └── overlap.ts         # overlap resolution primitives
│   └── types/                 # erd.ts (the dbterd-native contract), flow.ts, props.ts
├── test/                      # vitest (jsdom); test/_support/ = factories + harness
├── demo/                      # the Vite dev playground (entry: demo/index.html)
├── dist/                      # built library (gitignored) — ESM + .d.ts + erd-flow.css
├── vite.config.ts             # library-mode build + vitest config
├── playwright.config.ts       # e2e suite (drives the demo via the Vite dev server)
├── tsconfig.json              # strict TS; @/* → src/*
├── package.json               # peer deps externalized; exports "." + "./styles.css"
├── Taskfile.yml               # task runner (wraps the npm scripts)
├── .github/workflows/         # pr-ci (gate + e2e) and release (tag-driven npm publish)
└── .claude/                   # agents, skills, commands, hooks
```

Flat single package. `src/` is grouped by concern: the component (`ErdFlow.tsx`)
sits over three internal tiers — `types/` (the contract) → `layout/` (positions)
→ `components/` (the rendered node + edges) — with `payload.ts` and `theme.ts`
as the pure host-facing helpers. `src/index.ts` is the **only** barrel; nothing
outside it is public API.

## The ErdPayload contract

Everything the component renders comes from one hand-written type: `ErdPayload`
in `src/types/erd.ts` — the dbterd `json`-target native field names (an edge's
`from_id` is the FK/child side, `to_id` the referenced/parent side;
`resource_type` is an **open string**, never a hardcoded dbt enum). This is the
seam both first-party hosts speak: dbt-docs maps its `data.erd` onto it,
dbterd-vscode's server emits it directly. Before changing the payload shape, read
`.claude/skills/erd-payload-contract/SKILL.md` — a field rename ripples to every
host. Keep optional fields optional (partial catalogs omit them).

## Workflows

Day-to-day work is driven by `task` (root `Taskfile.yml`), which wraps the npm
scripts. Slash commands wrap the same targets so the agentic and manual paths
stay aligned.

| Goal                                 | Task               | Slash command |
|--------------------------------------|--------------------|---------------|
| Install npm dependencies             | `task install`     | —             |
| Build the library (`dist/`)          | `task build`       | `/build`      |
| Typecheck (no emit)                  | `task typecheck`   | —             |
| Run the vitest suite                 | `task test`        | `/test`       |
| Run vitest in watch mode             | `task test:watch`  | —             |
| Run the Vite dev / demo server       | —                  | `/dev`        |
| Review + fix the pending changes     | —                  | `/code-review`|
| Open a GitHub PR for the branch      | —                  | `/pr`         |
| Run the Playwright E2E suite         | `task e2e`         | —             |
| Install the Playwright browser       | `task e2e:install` | —             |
| Remove `dist/` + caches              | `task clean`       | —             |

`task --list` shows everything. There is **no lint step** — this repo has no
ESLint config; `tsc --noEmit` (strict mode) is the type gate, and it must pass.

CI mirrors the same gate: `.github/workflows/pr-ci.yml` runs typecheck + vitest
+ build (and the Playwright e2e) on every PR and push to `main`;
`.github/workflows/release.yml` publishes to npm when a GitHub Release is
published (see the `release` skill for the full flow).

### CLI lifecycle

There is no CLI — this is a library. The lifecycle is `npm run build`
(`tsc -b && vite build`) → the host `import`s `<ErdFlow>` from `dist/`. `npm run
dev` runs Vite (a local demo / playground) for interactive iteration on node and
edge rendering.

## Conventions

- TypeScript strict: `npm run typecheck` (`tsc --noEmit`) must pass. No `any`
  leaking into public types; no unused vars/imports (strict flags catch them).
- Tests: `npm test` (vitest, jsdom) must pass. Share fixtures via
  `test/_support/` (`erd-factories.ts`, `erd-harness.tsx`) — DRY, don't
  hand-build a payload per test.
- **One concern per file.** A node component, an edge component, a layout
  engine, and a geometry helper each live in their own file. React Flow node/edge
  registries (`nodeTypes.ts` / `edgeTypes.ts`) are the one place types are wired.
- **The `--erd-*` theme-token contract.** Every colour is a CSS custom property
  with a baked-in hex fallback. Never hardcode a colour in a component or CSS
  rule — read a `--erd-*` token (see `theme.ts`'s `TOKEN_MAP`). The host maps its
  own theme (`--vscode-*`, web design tokens) onto these via the `theme` prop or
  plain CSS; the package ships a usable dark default.
- **tableConstants ↔ ErdTableNode.css lockstep.** The card geometry in
  `src/components/tableConstants.ts` (`HEADER_HEIGHT`, `COLUMN_HEIGHT`, …) is
  **pinned** to the matching `height` rules in `ErdTableNode.css`, because the
  FK-edge anchor computes a column's row Y arithmetically from those constants.
  Change one and change the other in the same edit — they are pinned, not
  approximated.
- **Peer deps are not bundled.** `react`, `react-dom`, `@xyflow/react`, and
  `@dagrejs/dagre` are `peerDependencies` and are externalized in the Vite lib
  build. Never add one as a runtime `dependency` — the host owns their versions.
- **Data-as-prop, callbacks-out.** The component owns no transport, no fetch, no
  storage. It takes `data` and emits `onOpenNode` / `onNodeActivate` /
  `onExpandStateChange` — the host wires those to its own world.
- **Do not add new inline comments.** Let names and structure carry intent; put
  rationale in `.claude/design_patterns.md` (or a module/function docstring for
  an API contract), never scattered `//` lines inside a function body. This
  applies to new and edited code alike.
- The few inline comments that already exist must describe the current
  implementation only — never the history that led to it. Drop "we used to…",
  "no longer…", "instead of the old…". A comment should read correctly to
  someone who has never seen a previous version.
- No backward-compat shims unless explicitly asked.

## Design patterns

The load-bearing patterns of this codebase are catalogued — with file:line
evidence — in the imported config below. Extend the established pattern instead
of inventing a parallel one.

@.claude/design_patterns.md

- When you add or remove a load-bearing pattern, update
  `.claude/design_patterns.md` in the same change (new entry + TOC), with a
  concrete file:line citation.
- Line numbers there can drift; the cited symbol is authoritative — grep it.

## Agentic setup

- `erd-flow-dev` agent (`memory: project`) — owns `src/` and `test/`: the
  React Flow ERD component, its nodes/edges, the layout registry, and the vitest
  suite.
- `release-manager` agent (`memory: local`) — cuts npm releases.
- Skills: `reactflow-nodes` (the ErdTableNode + self-drawing FK-edge patterns),
  `erd-payload-contract` (the `ErdPayload` shape both hosts speak), `package`
  (the library-mode build + how a host mounts `<ErdFlow>`), `release` (the npm
  publish procedure), `code-review` (the repo-specific review dimensions +
  fix-then-gate loop), `pr` (open a GitHub PR whose body fills
  `.github/PULL_REQUEST_TEMPLATE.md` honestly).
- Hooks: `block-secrets.sh` (PreToolUse, denies secret-file access),
  `post-edit-check.sh` (PostToolUse, `tsc --noEmit` on edited `.ts`/`.tsx`).

## Agent memory

`erd-flow-dev` uses `memory: project` — its scratchpad is committed and shared
with teammates. `release-manager` uses `memory: local` — personal, gitignored.
Because project memory lands in git:

- Never write secrets, tokens, or customer data into agent memory.
- Never write things only true for your local setup (personal paths, ports).
- Do write things that remain true across sessions: React Flow / dbterd quirks,
  architectural decisions, recurring pitfalls.

Agents curate their own `MEMORY.md` index — do not hand-edit it.

## External docs via context7 MCP

`context7` is configured in `.mcp.json`. Use it to pull up-to-date docs for
`@xyflow/react` (v12), `@dagrejs/dagre`, Vite (library mode), and Vitest before
writing non-trivial integration code. Prefer context7 over guessing from
training data when library behavior matters.

## Delegating work

- Component / node / edge / layout / test changes: delegate to `erd-flow-dev`.
- Anything touching the payload shape: read the `erd-payload-contract` skill
  first (it ripples to every host).
- Custom node/edge internals: read the `reactflow-nodes` skill first.
- Release cuts: `release-manager` agent / `/release`.
