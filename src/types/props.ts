import type { FitViewOptions } from "@xyflow/react";
import type { ErdEdge, ErdNode, ErdPayload } from "./erd";
import type { EstimateSize } from "../layout";

// How a host describes one resource type: the accent colour used for the
// minimap dot, and an optional table-header icon. The component keys off
// `ErdNode.resource_type` (an open string) so a non-dbt host defines its own
// taxonomy without the package hardcoding a dbt enum. `icon` defaults to
// "table" when unset.
export interface ResourceMeta {
  color?: string;
  icon?: "database" | "table";
}

// Theme tokens the component reads through CSS custom properties. Every token
// has a built-in hex fallback (see ErdTableNode.css / edge-anchor.ts), so a
// host may set none and still get a usable dark ERD; a host maps its own theme
// (VS Code's `--vscode-*`, or a web app's design tokens) onto these.
export interface ErdTheme {
  nodeBg?: string;
  nodeFg?: string;
  border?: string;
  accent?: string;
  fk?: string;
  headerBg?: string;
  hoverBg?: string;
  mutedFg?: string;
  linkFg?: string;
  divider?: string;
  icon?: string;
  fontMono?: string;
  edge?: string;
  edgeSelected?: string;
  // Stroke widths (CSS lengths / bare numbers as strings, e.g. "1" or "2.5").
  edgeWidth?: string;
  edgeSelectedWidth?: string;
  minimapBg?: string;
  minimapDim?: string;
  minimapMask?: string;
  shadow?: string;
}

export interface ErdFlowProps {
  // The ERD data to render (dbterd-native shape).
  data: ErdPayload;

  // Layout selection by registered name — a built-in LayoutStyle or a name the
  // host added via `registerLayout`; an unknown name falls back to the default.
  // Uncontrolled unless `layout` is provided.
  layout?: string;
  defaultLayout?: string;

  // Layout-box estimate override. Layout engines space cards by an estimated
  // width/height (real DOM sizes don't exist pre-layout); a host with its own
  // card geometry passes the matching math here.
  estimateSize?: EstimateSize;

  // Name filter (highlights matches, dims the rest — never removes nodes).
  filter?: string;

  // Drop zero-edge island tables.
  hideUnconnected?: boolean;

  // Focus a node: render only its FK neighbourhood (see `focusDepth`). Null/omit
  // renders the whole graph.
  focus?: string | null;
  focusDepth?: number;

  // Compact rendering: each table keeps only its key (PK/FK) columns, dropping
  // the rest from the payload before layout (non-key columns render nowhere,
  // there's no toggle to bring them back). Suits a dense overview; false shows
  // every column. Independent of `collapseColumns`, which is a separate
  // render-time "N more" toggle over whichever columns are kept here.
  compact?: boolean;

  // Whether wide tables (> ~5 columns) collapse to a few rows with an
  // interactive "N more" toggle. Defaults to true. Pass false for a focused
  // view where the whole neighbourhood is small and every join column should
  // stay visible (e.g. a single-model "related tables" ERD).
  collapseColumns?: boolean;

  // Expand-all control. When provided, forces every collapsible table expanded
  // (true) or collapsed (false), overriding per-table toggles — a host renders
  // its own "expand all / collapse all" button and drives this. When omitted,
  // per-table expand toggles work independently (the default).
  expandAll?: boolean;

  // Reports the aggregate expand state after each render so a host can label
  // its expand-all button: `allExpanded` (every collapsible table is open) and
  // `canExpand` (at least one table has hidden rows to expand).
  onExpandStateChange?: (state: { allExpanded: boolean; canExpand: boolean }) => void;

  // Pan / zoom / drag interactivity. Defaults to true. Pass false to lock the
  // canvas (a static, non-pannable diagram that releases the wheel, so the
  // page scrolls past it) — a host can gate this behind its own "click to
  // unlock" affordance.
  interactive?: boolean;

  // Called when a table is activated (header single-click) or deactivated
  // (pane/background click → null). The host renders its own details surface.
  onNodeActivate?: (node: ErdNode | null) => void;

  // Called on table double-click — the host opens the backing file/model.
  onOpenNode?: (node: ErdNode) => void;

  // Resource-type vocabulary (colours/icons). Merged over the built-in dbt
  // defaults.
  resourceMeta?: Record<string, ResourceMeta>;

  // id → display label. Defaults to the node's `name`. dbt-docs passes a
  // `shortName(unique_id)`; a non-dbt host may pass identity.
  labelFor?: (node: ErdNode) => string;

  // Theme token overrides (all optional; hex fallbacks otherwise).
  theme?: ErdTheme;

  // React Flow colour mode. Defaults to "dark".
  colorMode?: "light" | "dark" | "system";

  // Show the built-in MiniMap / Controls / Background chrome. All default true.
  minimap?: boolean;
  controls?: boolean;
  background?: boolean;

  // Render the schema qualifier (`schema_name`) in each table header,
  // right-aligned after the name. Defaults to false.
  showSchema?: boolean;

  // How a multi-column FK renders: one bundled edge forking into per-column
  // tails ("bundle", the default), or one independent edge per column pair
  // ("fan").
  compositeEdges?: "bundle" | "fan";

  // Path shape for single-column edges: horizontal-tangent cubic bezier
  // ("cubic", the default) or an orthogonal smoothstep.
  edgePath?: "cubic" | "smoothstep";

  // Whether an edge gets the marching-ants dash animation while unselected.
  // Defaults to animating every FK edge; a host can gate it (e.g. only
  // one-to-many cardinalities).
  animateEdge?: (edge: ErdEdge) => boolean;

  // When an edge is selected, fade every other edge and every node not touching
  // it, so the joined pair stands out. Defaults to false.
  dimOnSelect?: boolean;

  // Mount only the nodes/edges inside the viewport (React Flow's
  // onlyRenderVisibleElements). Defaults to false; a host rendering very large
  // uncapped ERDs turns it on to bound DOM cost by what's on screen.
  onlyRenderVisibleElements?: boolean;

  // Options for every fit-to-view (the initial fit and the re-fits after
  // relayout / visibility changes) — padding, zoom clamps, etc.
  fitViewOptions?: FitViewOptions;

  // Change this value to request a re-fit (~120ms later, letting the container
  // settle) without touching the data — e.g. pass the host's fullscreen state.
  refitKey?: unknown;

  className?: string;
}
