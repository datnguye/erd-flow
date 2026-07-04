---
name: reactflow-nodes
description: Use when building or modifying the custom React Flow node and edge components in erd-flow — the ErdTableNode table card and the self-drawing single/composite FK edges. Covers registration, the height-pinned geometry, index-based edge anchoring, theming, and performance. Targets @xyflow/react v12.
---

# Custom React Flow nodes & edges (@datnguye/erd-flow)

We're on `@xyflow/react` v12 — the v11 `reactflow` package is legacy. Imports
come from `@xyflow/react`; styles from `@xyflow/react/dist/style.css`. This
package externalizes `@xyflow/react` as a peer dep — never bundle it.

## The two registries

Node and edge types are each registered **once** at module scope:

```ts
// src/components/nodeTypes.ts
export const nodeTypes: NodeTypes = { erdTable: ErdTableNode };
// src/components/edgeTypes.ts
export const edgeTypes: EdgeTypes = { composite: CompositeEdge, single: SingleEdge };
```

Never inline-define a node/edge component inside another component body — it
breaks React reconciliation and flickers on every render. Wrap components in
`memo` (both edges already are). Add a new node/edge type by adding it to the
registry, not by branching inside an existing component.

## The table card (`ErdTableNode`)

```
┌──────────────────────────┐
│ 📦 dim_customer          │  ← header: resource icon + name; click activates, dbl-click opens
├──────────────────────────┤
│ 🔑 customer_key  varchar │  ← row per column; PK/FK badge on the left
│    customer_name varchar │
│    region        varchar │
│    + 3 more              │  ← collapse toggle when > COLLAPSE_THRESHOLD columns
└──────────────────────────┘
```

Rules:

1. **Geometry is pinned, not approximated.** The card's geometry lives in
   `src/components/tableConstants.ts` (`HEADER_HEIGHT`, `COLUMN_HEIGHT`,
   `COLUMNS_TOP_PADDING`, `COLUMNS_BOTTOM_PADDING`, `CARD_BORDER_WIDTH`,
   `COLLAPSE_TOGGLE_HEIGHT`, `MIN_CARD_WIDTH`) and is **pinned** to the matching
   `height`/`padding`/`border` rules in `ErdTableNode.css` (each CSS rule names
   its constant in a comment). If you change one, change both in the same edit —
   the FK edge anchor computes column-row Y arithmetically from these constants,
   so a mismatch drifts every edge off its row; and every height-contributing
   constant must also appear in `dimensions.ts`'s `estimateHeight` sum or
   layouts pre-size cards short.
2. **Collapse for wide tables.** `isCollapsible` / `visibleColumnCount` decide
   how many rows show; the "+N more" toggle expands. `compact` (from
   `payload.ts`) is a *separate* pre-layout reduction to key columns only — don't
   conflate it with the render-time collapse.
3. **Theme with `--erd-*` tokens.** Never hardcode a colour. Read a token
   (`var(--erd-node-bg, #…)`) — every one has a hex fallback (see `theme.ts`'s
   `TOKEN_MAP`). A host maps its own theme onto `--erd-*`.
4. **No layout inside nodes.** Positions are computed once by the layout engines
   (`src/layout/`) before nodes hit React Flow. The node only renders.

## The self-drawing FK edges

Unlike a stock React Flow edge, our FK edges **draw themselves from live node
geometry** — there are no static `sourceHandle`/`targetHandle` (they'd pin the
side and vanish when a column collapses). `mapEdge` (in `src/layout/index.ts`)
sets only `source`/`target` and passes the column references through `data`.

- **`SingleEdge`** (one column each side) and **`CompositeEdge`** (N columns each
  side, drawn as one middle bundle forking to per-column tails).
- Both read geometry via `useInternalNode` and the shared `edge-anchor.ts`
  helpers: `anchorNodeOf` (builds a `name → index` **Map** for O(1) row lookup),
  `endpointSides` (which card side each endpoint faces), `resolveAnchor` (the
  absolute point on a column's row), `fkStrokeStyle`. Change edge behaviour in
  `edge-anchor.ts` so both edges stay in lockstep — don't fork one edge's
  anchoring.
- A column hidden under the collapse anchors at the **collapse boundary**
  (`anchorRowIndex`), so its edge sits on the card edge instead of piling onto
  one handle.
- An edge renders `composite` when **either** side has more than one column and
  both sides have at least one (`mapEdge`'s `isComposite`); otherwise `single`,
  anchored on each side's first column. With `compositeEdges: "fan"` a
  composite relationship renders as one `single` edge per column pair instead
  of a bundle.

## File layout

```
src/components/
├── ErdTableNode.tsx / .css   # the card node; CSS heights pinned to tableConstants
├── tableConstants.ts         # the pinned geometry (single source of truth)
├── edge-anchor.ts            # shared anchor resolution for both edges
├── single-edge/index.tsx     # SingleEdge
├── composite-edge/index.tsx  # CompositeEdge
├── composite-edge/geometry.ts   # bundle/tail path geometry (pure, tested)
├── column-highlight.ts       # selected-edge → highlighted columns
├── icons.tsx                 # the icon set
├── nodeTypes.ts / edgeTypes.ts   # the registries
```

## Performance notes

- `anchorNodeOf`'s name→index Map keeps each endpoint's row lookup O(1) — every
  edge re-anchors on each pan/zoom, so don't regress it to `indexOf` over an array.
- Both edge components are `memo`'d. Keep them so.
- For very large graphs, prefer windowing the payload (`focus` / `compact` in
  `payload.ts`) over rendering everything — that's the package's scale strategy.

## Common migration pitfalls from v11 `reactflow`

- `import { Handle, ... } from "reactflow"` → `from "@xyflow/react"`.
- `import "reactflow/dist/style.css"` → `"@xyflow/react/dist/style.css"`.
- `NodeProps<Data>` → `NodeProps<Node<Data, "typeKey">>`.
- Default-exported `ReactFlow` is now a named export: `import { ReactFlow } from
  "@xyflow/react"`.
