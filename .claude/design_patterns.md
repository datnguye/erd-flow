# Design patterns

The load-bearing patterns of `@datnguye/erd-flow`. Extend the established
pattern instead of inventing a parallel one. Line numbers drift — the cited
**symbol** is authoritative; grep it.

## Table of contents

- [Design patterns](#design-patterns)
  - [Table of contents](#table-of-contents)
  - [The dbterd-native ErdPayload contract (hand-written types)](#the-dbterd-native-erdpayload-contract-hand-written-types)
    - [Theory](#theory)
    - [Example](#example)
  - [Layout registry (one LAYOUT\_STYLES source of truth)](#layout-registry-one-layout_styles-source-of-truth)
    - [Theory](#theory-1)
    - [Example](#example-1)
  - [Severed host seams (callbacks, --erd-\* tokens, data-as-prop)](#severed-host-seams-callbacks---erd--tokens-data-as-prop)
    - [Theory](#theory-2)
    - [Example](#example-2)
  - [tableConstants ↔ ErdTableNode.css height lockstep + index-based anchoring](#tableconstants--erdtablenodecss-height-lockstep--index-based-anchoring)
    - [Theory](#theory-3)
    - [Example](#example-3)
  - [Self-drawing composite / single FK edges](#self-drawing-composite--single-fk-edges)
    - [Theory](#theory-4)
    - [Example](#example-4)
  - [Focus windowing + compact in payload.ts](#focus-windowing--compact-in-payloadts)
    - [Theory](#theory-5)
    - [Example](#example-5)
  - [Controlled-or-uncontrolled props on ErdFlow](#controlled-or-uncontrolled-props-on-erdflow)
    - [Theory](#theory-6)
    - [Example](#example-6)
  - [Vite library-mode build (externalized peers, ESM + dts + css)](#vite-library-mode-build-externalized-peers-esm--dts--css)
    - [Theory](#theory-7)
    - [Example](#example-7)

## The dbterd-native ErdPayload contract (hand-written types)

### Theory

Everything the component renders flows from **one hand-written type**:
`ErdPayload` in `src/types/erd.ts`. These are dbterd's `json`-target native field
names — an edge carries `from_id` (the FK/child side) and `to_id` (the
referenced/parent side); a node carries `schema_name`; a column carries
`data_type`. The types are authored by hand (not generated), because the package
*owns* the contract that both first-party hosts speak: dbt-docs maps its
`data.erd` onto this shape, dbterd-vscode's server emits it directly. **Two
deliberate design choices:** `resource_type` is an **open `string`**, not a dbt
enum, so a non-dbt host defines its own taxonomy (the component keys colours off
the injected `resourceMeta`, never a hardcoded enum); and optional fields stay
optional because partial catalogs omit them. Don't narrow `resource_type` to an
enum and don't make a catalog-optional field required — a field rename ripples to
every host (see the `erd-payload-contract` skill).

### Example

```typescript
// src/types/erd.ts — dbterd-native names; resource_type is an open string
export interface ErdEdge {
  id: string;
  from_id: string; // FK / child side
  to_id: string;   // referenced / parent side
  from_columns?: string[];
  to_columns?: string[];
  // ...
}
export interface ErdNode {
  id: string;
  name: string;
  resource_type?: string; // open string, not a dbt enum
  schema_name?: string | null;
  columns: Column[];
}
```

- `src/types/erd.ts` — `interface Column`, `interface ErdNode`, `interface ErdEdge`, `interface ErdPayload`
- `src/index.ts` — the payload types are re-exported here (the only public barrel)

## Layout registry (one LAYOUT_STYLES source of truth)

### Theory

Layouts live in a **name → engine registry**, not scattered `if` chains. A
`LayoutEngine` maps pre-sized nodes + edges to positions — nodes arrive already
measured via `measureNodes` (and the host's `estimateSize` override), so an
engine decides *placement only, never sizing*. The three built-ins register
themselves at module load via `registerLayout(name, engine)`;
`resolveLayout(name)` looks a style up and falls back to `DEFAULT_LAYOUT` for
an unknown name, so a stale persisted value never crashes. `registerLayout` is
**public API**: a host adds its own arrangement and selects it by name through
the `layout` prop. `LAYOUT_STYLES = ["hierarchical", "radial", "force"] as
const` stays the single source of truth for the *built-in* set — the
`LayoutStyle` union, the `isLayoutStyle` persisted-value validator, and a host
toolbar's button list all derive from it. `toFlowGraph(payload, style,
collapse, options)` is the single glue: it measures nodes, runs the resolved
engine, maps positions onto xyflow nodes, and translates each `ErdEdge` via
`mapEdge`. The built-in engines share graph primitives (adjacency,
connected-component split, island-grid packing, centre→top-left normalisation)
from `src/layout/graph.ts` — they *compose* those, they don't each carry a
copy. Add a built-in by adding an engine module + a `LAYOUT_STYLES` entry + a
`registerLayout` call; don't fork `toFlowGraph`. `toFlowGraph` also filters to
`resolvableEdges` (both endpoints present in `payload.nodes`) before handing
edges to any engine — a partial catalog can carry a dangling
`from_id`/`to_id`, and every engine indexes into its dimension map per edge
endpoint with no null-check, so this filter is a single guard shared by all
engines rather than a per-engine defensive copy.

### Example

```typescript
// src/layout/index.ts — a name → engine registry; built-ins self-register
export const LAYOUT_STYLES = ["hierarchical", "radial", "force"] as const;
export type LayoutStyle = (typeof LAYOUT_STYLES)[number];
export const DEFAULT_LAYOUT: LayoutStyle = "radial";

export type LayoutEngine = (
  sized: readonly SizedErdNode[],
  edges: readonly ErdEdge[],
  opts: LayoutEngineOptions,
) => LaidOutNode[];

const engines = new Map<string, LayoutEngine>();
export function registerLayout(name: string, engine: LayoutEngine): void {
  engines.set(name, engine);
}
export function resolveLayout(name: string): LayoutEngine {
  return engines.get(name) ?? engines.get(DEFAULT_LAYOUT)!;
}

registerLayout("hierarchical", (sized, edges) =>
  runDagreLayout(sized, edges, true, dimensionsOf(sized)),
);
```

- `src/layout/index.ts` — `LAYOUT_STYLES`, `LayoutStyle`, `DEFAULT_LAYOUT`, `isLayoutStyle`, `LayoutEngine`, `LayoutEngineOptions`, `registerLayout`, `resolveLayout`, `resolvableEdges`, `toFlowGraph`, `ToFlowGraphOptions`, `mapEdge`
- `src/layout/dagre.ts` / `radial.ts` / `force.ts` — `runDagreLayout`, `runRadialLayout`, `runForceLayout` (the built-in engines)
- `src/layout/dimensions.ts` — `measureNodes`, `EstimateSize`, `SizedErdNode`, `dimensionsOf` (sizing happens before any engine runs)
- `src/layout/graph.ts` — `buildAdjacency`, `splitConnected`, `findComponents`, `layoutIslandGrid`, `normalizeToOrigin`, `centreToTopLeft` (shared primitives)

## Severed host seams (callbacks, --erd-* tokens, data-as-prop)

### Theory

The component is deliberately **decoupled from any host** by three severed seams,
so the same graph mounts in a static SPA and a VS Code webview without either
world leaking in:

1. **Callbacks out, no transport in.** `<ErdFlow>` owns no fetch, storage, or
   navigation. It takes `data` and emits `onOpenNode(node)` (double-click → the
   host opens the backing model/file) and `onNodeActivate(node | null)` (header
   click activates; pane click clears → the host renders its own details pane).
   The host wires these to its own world.
2. **`--erd-*` theme tokens with hex fallbacks.** Every colour is a CSS custom
   property with a baked-in hex default. `ErdTheme` fields map to `--erd-*`
   variables via `theme.ts`'s `TOKEN_MAP`; `themeStyle(theme)` emits only the set
   tokens, so an unset host still gets a usable dark ERD. A host maps its own
   tokens (`--vscode-editor-background`, web design tokens) onto `--erd-*` — the
   package never reads a host-specific variable. This includes chrome that isn't
   a component prop, like the MiniMap's dimmed-node colour (`--erd-minimap-dim`)
   and mask (`--erd-minimap-mask`) — never an inline `rgba(...)` literal.
3. **Data-as-prop, open taxonomy.** `resource_type` colour and icon come from
   the injected `resourceMeta` prop (merged over `DEFAULT_RESOURCE_META`), and
   the display label from `labelFor(node)` — the package hardcodes no dbt enum
   and no id-shortening scheme. `ResourceMeta.icon` ("database" | "table")
   replaces any hardcoded `resource_type === "source"` check: `ErdFlow` resolves
   it per node into `data.__icon` (the same stamped-`__field` idiom as
   `__active`/`__filterState`), and `ErdTableNode` reads `data.__icon`, never
   `data.resource_type`, to pick its header icon.

Don't reach for a host global, a hardcoded colour, or a fetch inside the
component — thread it through a prop or a `--erd-*` token.

### Example

```typescript
// src/theme.ts — ErdTheme fields → --erd-* tokens; only set tokens emitted
export function themeStyle(theme?: ErdTheme): CSSProperties {
  if (!theme) return {};
  const style: Record<string, string> = {};
  for (const key of Object.keys(TOKEN_MAP) as (keyof ErdTheme)[]) {
    const value = theme[key];
    if (value != null) style[TOKEN_MAP[key]] = value;
  }
  return style as CSSProperties;
}

// src/components/edge-anchor.ts — hex fallback baked into the var() reference
stroke: selected ? "var(--erd-edge-selected, #e5c07b)" : "var(--erd-edge, #007acc)",
```

- `src/types/props.ts` — `ErdFlowProps` (`onOpenNode`, `onNodeActivate`, `resourceMeta`, `labelFor`, `theme`), `ErdTheme` (incl. `minimapDim`, `minimapMask`), `ResourceMeta` (`color`, `icon`)
- `src/theme.ts` — `TOKEN_MAP`, `themeStyle`, `DEFAULT_RESOURCE_META`
- `src/ErdFlow.tsx` — `onNodeActivate?.(record)`, `onOpenNode?.(record)`, `onNodeActivate?.(null)` (the emit sites); `renderNodes`'s `__icon` stamp; `miniMapNodeColor` (the `--erd-minimap-dim` fallback)
- `src/components/edge-anchor.ts` — `fkStrokeStyle` (the `var(--erd-*, #hex)` fallback idiom)
- `src/components/ErdTableNode.tsx` — reads `data.__icon` for the header icon (never `data.resource_type` directly)

## tableConstants ↔ ErdTableNode.css height lockstep + index-based anchoring

### Theory

The FK-edge anchor computes a column's row Y **arithmetically** from the column's
index in the rendered list, not from React Flow handle bounds (which only exist
for visible rows and lag re-measurement). For that arithmetic to land on the
actual pixel row, the card geometry in `src/components/tableConstants.ts`
(`HEADER_HEIGHT`, `COLUMN_HEIGHT`, `COLUMNS_TOP_PADDING`, `COLUMNS_BOTTOM_PADDING`,
`CARD_BORDER_WIDTH`, `COLLAPSE_TOGGLE_HEIGHT`, `MIN_CARD_WIDTH`) is **pinned** to
the matching `height`/`padding`/`border` rules in `ErdTableNode.css` — the CSS
comments literally name the constant (`height: 32px; /* HEADER_HEIGHT */`).
Change one and change the other in the **same edit**; they are pinned, not
approximated. `dimensions.ts`'s `estimateHeight` sums the same constants (plus
`CARD_BORDER_WIDTH` twice, top and bottom) to pre-size a card before its real
DOM height is known — every constant that contributes to the rendered height
must also appear there or dagre/radial/force underestimate the card and layouts
overlap. `anchorNodeOf` caches its `name → index` **Map** in a module-level
`WeakMap` keyed on the node's columns array identity (every edge endpoint
re-anchors on each pan/zoom/drag render, so this avoids rebuilding it every
frame) and `anchorRowIndex` folds a collapsed-away column onto the collapse
boundary so its edge stays on the card edge instead of piling on one handle.

### Example

```typescript
// src/components/tableConstants.ts — the pinned geometry (CSS mirrors these)
export const HEADER_HEIGHT = 32;   // .erd-table-header height (border-box)
export const COLUMN_HEIGHT = 22;   // .erd-column height (border-box)
export const COLUMNS_TOP_PADDING = 4;
export const COLUMNS_BOTTOM_PADDING = 4;
export const CARD_BORDER_WIDTH = 1; // .erd-table border, top + bottom

// src/components/edge-anchor.ts — row Y is arithmetic from the constants,
// including the outer card border sitting above the header
function rowCenterY(rowIndex: number): number {
  return CARD_BORDER_WIDTH + HEADER_HEIGHT + COLUMNS_TOP_PADDING
    + rowIndex * COLUMN_HEIGHT + COLUMN_HEIGHT / 2;
}
```

- `src/components/tableConstants.ts` — `HEADER_HEIGHT`, `COLUMN_HEIGHT`, `COLUMNS_TOP_PADDING`, `COLUMNS_BOTTOM_PADDING`, `CARD_BORDER_WIDTH`, `COLLAPSE_TOGGLE_HEIGHT`, `MIN_CARD_WIDTH`, `visibleColumnCount`, `isCollapsible`
- `src/components/ErdTableNode.css` — the pinned `height`/`padding`/`border` rules (each comments its constant name)
- `src/components/edge-anchor.ts` — `anchorNodeOf` (WeakMap-cached name→index Map), `rowCenterY`, `anchorRowIndex` (collapse-boundary fold), `resolveAnchor`
- `src/layout/dimensions.ts` — `estimateHeight` (sums the same constants to pre-size a card before layout)

## Self-drawing composite / single FK edges

### Theory

FK edges **draw themselves** from live node geometry rather than pinning to
static React Flow handles. `mapEdge` (in `src/layout/index.ts`) sets only
`source`/`target` and hands the column references through `data` — deliberately
**no** static `sourceHandle`/`targetHandle`, which would pin the side and vanish
when a column collapses. Two edge components register in `edgeTypes`:
`SingleEdge` (one column each side) and `CompositeEdge` (N columns each side,
drawn as one bundle in the middle forking to per-column tails, like
dbdiagram.io). Both read live geometry via `useInternalNode` + the shared
`edge-anchor.ts` helpers (`anchorNodeOf`, `endpointSides`, `resolveAnchor`,
`fkStrokeStyle`) so the two edge kinds stay in lockstep and each endpoint picks
the card side it faces per layout. `mapEdge` derives each side's column list
once via `edgeColumns` (the plural array if present, else the singular field
wrapped in a one-element array, else empty) so a 1:1 edge described only by
`from_columns`/`to_columns` still anchors, and an asymmetric edge (e.g. 2
columns on one side, 1 on the other) doesn't silently drop columns. An edge
becomes `composite` when either side has more than one column and both sides
have at least one; otherwise `single`, anchored on each side's first column.
Don't reintroduce static handles; extend the shared anchor helpers so both
edges get the change.

### Example

```typescript
// src/layout/index.ts — mapEdge sets only source/target; column refs via data
const fromCols = edgeColumns(edge.from_columns, edge.from_column);
const toCols = edgeColumns(edge.to_columns, edge.to_column);
const isComposite = (fromCols.length > 1 || toCols.length > 1) && fromCols.length > 0 && toCols.length > 0;
if (isComposite) {
  return { id: edge.id, source: edge.from_id, target: edge.to_id,
           type: "composite", data: { from_columns: fromCols, to_columns: toCols } };
}
return { id: edge.id, source: edge.from_id, target: edge.to_id, type: "single",
         data: { from_column: fromCols[0] ?? null, to_column: toCols[0] ?? null,
                 relationship_type: edge.relationship_type } };

// src/components/single-edge/index.tsx — self-drawing from live geometry
const { fromIsLeft, toIsLeft } = endpointSides(from, to);
const fromPoint = resolveAnchor(from, fromCol, fromIsLeft);
const toPoint = resolveAnchor(to, toCol, toIsLeft);
```

- `src/layout/index.ts` — `mapEdge`, `edgeColumns` (composite vs single; no static handles)
- `src/components/edgeTypes.ts` — `edgeTypes` (`composite`, `single` registry)
- `src/components/single-edge/index.tsx` — `SingleEdge`
- `src/components/composite-edge/index.tsx` — `CompositeEdge`, `columnPoints`; `composite-edge/geometry.ts` — `tailPath`, `bundlePath`, `avgY`
- `src/components/edge-anchor.ts` — `anchorNodeOf`, `endpointSides`, `resolveAnchor`, `fkStrokeStyle` (shared by both edges)

## Focus windowing + compact in payload.ts

### Theory

Large-schema performance is handled by **windowing the payload before layout**,
in pure functions under `src/payload.ts` — never by the component mutating data.
`windowPayload(payload, {focus, focusDepth, compact})` returns a **new** payload:
when `focus` is set it keeps only the focus node's `depth`-hop FK neighbourhood
(`erdNeighborhood`, a BFS over the undirected FK adjacency — mirroring the DAG
neighbourhood windowing so a deeply-connected fact table doesn't pull in the
whole schema), and when `compact` is set it reduces each node's columns to only
its keyed (PK/FK) columns (`compactColumns`, which keeps all columns for a table
that has none, since there's nothing to compact), stamping the dropped count as
`hidden_column_count` so the card can render a passive "+N more columns" row.
These three
(`windowPayload`/`erdNeighborhood`/`compactColumns`) are **exported** so a host
can pre-window itself. `collapseColumns` is separate and lives at render time —
it collapses a wide table to a few rows with an interactive "N more" toggle
(controlled by `tableConstants`), independent of `compact`. `ErdFlow`'s single
positioning effect calls `windowPayload` then `toFlowGraph`. Keep windowing pure;
don't mutate the input payload.

### Example

```typescript
// src/payload.ts — pure windowing; returns a new payload, never mutates
export function windowPayload(payload: ErdPayload, options: WindowOptions): ErdPayload {
  const { focus, focusDepth = 1, compact = false } = options;
  let nodes = payload.nodes;
  let edges = payload.edges;
  if (focus) {
    const keep = erdNeighborhood(payload, focus, focusDepth);
    nodes = nodes.filter((n) => keep.has(n.id));
    edges = edges.filter((e) => keep.has(e.from_id) && keep.has(e.to_id));
  }
  if (compact) {
    nodes = nodes.map((n) => {
      const kept = compactColumns(n.columns);
      const hidden = n.columns.length - kept.length;
      return hidden > 0
        ? { ...n, columns: kept, hidden_column_count: hidden }
        : { ...n, columns: kept };
    });
  }
  return { ...payload, nodes, edges };
}
```

- `src/payload.ts` — `windowPayload`, `erdNeighborhood`, `compactColumns`, `WindowOptions` (all exported via `src/index.ts`)
- `src/ErdFlow.tsx` — the positioning `useEffect` (`windowPayload(data, …)` → `toFlowGraph(…)`)
- `src/components/tableConstants.ts` — `isCollapsible`, `visibleColumnCount` (the separate render-time `collapseColumns` collapse)

## Controlled-or-uncontrolled props on ErdFlow

### Theory

`<ErdFlow>` supports React's **controlled-or-uncontrolled** convention on its
interactive props, so a host can either drive them from its own state or let the
component manage them. The pattern per prop: a `X` (controlled value) and a
`defaultX` / internal default, resolved as `props.X ?? <fallback>`. `layout`
resolves to `props.layout ?? props.defaultLayout ?? DEFAULT_LAYOUT` — both
props are deliberately **unvalidated open strings**, not `LayoutStyle`, because
a host may name an engine it added via `registerLayout`; `resolveLayout` falls
back to `DEFAULT_LAYOUT` for an unknown name, so validation lives at
resolution, not at the prop. `filter` resolves to `props.filter ?? ""`;
`hideUnconnected` to
`props.hideUnconnected ?? false`. There is deliberately no `onLayoutChange` /
`onFilterChange` / `onHideUnconnectedChange` — the component renders no UI that
would mutate these itself, so an `onXChange` here would be a callback with no
emit site. `expandAll` is the one prop in this family that *is* paired with a
callback (`onExpandStateChange`), because the component's own expand/collapse
toggle button is the thing that changes that state. Follow this shape for any
new interactive prop: a controlled value plus an optional default, and only add
an `onXChange` if the component itself can produce a new value for it.

### Example

```typescript
// src/ErdFlow.tsx — controlled value ?? default ?? constant; an open string
// because a host may pass a registerLayout-added name (resolveLayout falls
// back safely for unknown names)
const layout: string = props.layout ?? props.defaultLayout ?? DEFAULT_LAYOUT;
const filter = props.filter ?? "";
const hideUnconnected = props.hideUnconnected ?? false;
```

- `src/ErdFlow.tsx` — the `layout` / `filter` / `hideUnconnected` resolution
- `src/types/props.ts` — `ErdFlowProps` (`layout`/`defaultLayout`, `filter`, `hideUnconnected`, `expandAll`/`onExpandStateChange`)

## Vite library-mode build (externalized peers, ESM + dts + css)

### Theory

The package builds in Vite **library mode** to `dist/`, emitting ESM
(`index.js`), rolled-up type declarations (`index.d.ts` via `vite-plugin-dts`
with `rollupTypes: true`), and one stylesheet (`erd-flow.css` via
`assetFileNames`). The **peer deps are externalized** in `rollupOptions.external`
(`react`, `react-dom`, `react/jsx-runtime`, `@xyflow/react`, `@dagrejs/dagre`) so
the host owns their versions and they're never double-bundled. `package.json`
mirrors this: those four are `peerDependencies` (never `dependencies`), and
`exports` maps `"."` → `dist/index.js` + types and `"./styles.css"` →
`dist/erd-flow.css` (with `sideEffects: ["*.css"]` so the CSS survives
tree-shaking). The same `vite.config.ts` also hosts the vitest config (jsdom).
Never add a peer as a runtime `dependency`; if you add a new external, add it to
both `rollupOptions.external` and `peerDependencies`.

### Example

```typescript
// vite.config.ts — library mode; peers externalized; ESM + dts + one css asset
export default defineConfig({
  plugins: [react(), dts({ include: ["src"], rollupTypes: true })],
  build: {
    lib: { entry: resolve(__dirname, "src/index.ts"), formats: ["es"], fileName: () => "index.js" },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "@xyflow/react", "@dagrejs/dagre"],
      output: { assetFileNames: "erd-flow.[ext]" },
    },
  },
});
```

- `vite.config.ts` — `build.lib`, `rollupOptions.external`, `assetFileNames`, `dts({ rollupTypes: true })`, `test` (vitest jsdom)
- `package.json` — `peerDependencies`, `exports` (`"."` + `"./styles.css"`), `sideEffects`, `files: ["dist"]`
- `src/index.ts` — the single entry barrel the lib build bundles from
