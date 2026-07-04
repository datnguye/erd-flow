// Top-level layout orchestration. Measures the payload's nodes once, hands the
// sized nodes to the resolved layout engine, glues the engine's output to
// xyflow nodes, and translates ERD edges into xyflow edges (single-column or
// composite).

import type { Edge } from "@xyflow/react";

import type { ErdEdge, ErdPayload } from "../types/erd";
import type { ErdFlowNode, FlowGraph } from "../types/flow";
import {
  dimensionsOf,
  measureNodes,
  type EstimateSize,
  type SizedErdNode,
} from "./dimensions";
import { runDagreLayout, type LaidOutNode } from "./dagre";
import { runForceLayout } from "./force";
import { runRadialLayout } from "./radial";

export type { ErdFlowNode, ErdNodeData, FlowGraph } from "../types/flow";
export type { EstimateSize, SizedErdNode, TableDimensions } from "./dimensions";
export type { LaidOutNode } from "./dagre";
export { measureNodes } from "./dimensions";

// Built-in canvas arrangements. "hierarchical" is dagre's left-to-right
// ranking; "radial" fans hubs into stars; "force" is a spring simulation that
// settles shared dimensions among their facts (best for star/snowflake
// schemas). Single source of truth for the set of built-in layout styles and
// their order — the LayoutStyle union and the persisted-state validator
// (isLayoutStyle) both derive from this one array, and a host toolbar can
// derive its button list from it too. Persisting the chosen style across
// reloads is the host's job, not this library's. Hosts add their own
// arrangements with `registerLayout(name, engine)` and select them by name via
// the `layout` prop; an unregistered name resolves to DEFAULT_LAYOUT.
export const LAYOUT_STYLES = ["hierarchical", "radial", "force"] as const;

export type LayoutStyle = (typeof LAYOUT_STYLES)[number];

export const DEFAULT_LAYOUT: LayoutStyle = "radial";

// Narrow an arbitrary persisted/string value to a known built-in LayoutStyle.
export function isLayoutStyle(value: unknown): value is LayoutStyle {
  return typeof value === "string" && (LAYOUT_STYLES as readonly string[]).includes(value);
}

export interface LayoutEngineOptions {
  // The focal node for centre-based engines. The built-in engines ignore it;
  // a host engine (e.g. a focus-centred snowflake) reads it to pick its hub.
  centerId?: string | null;
}

// A layout engine maps pre-sized nodes + edges to positioned nodes. The nodes
// arrive already measured (see `measureNodes` / the `estimateSize` prop), so an
// engine only decides placement, never sizing.
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
registerLayout("radial", (sized, edges) =>
  runRadialLayout(sized, edges, true, dimensionsOf(sized)),
);
registerLayout("force", (sized, edges) =>
  runForceLayout(sized, edges, true, dimensionsOf(sized)),
);

// Edges whose endpoints both resolve to a node in the payload. A partial
// catalog can carry a dangling `from_id`/`to_id` (a table excluded from the
// extract, or windowed away upstream) — every layout engine assumes it can
// index into the node set for each edge endpoint, so this filter runs once
// here rather than being duplicated per engine.
function resolvableEdges(payload: ErdPayload): ErdEdge[] {
  const ids = new Set(payload.nodes.map((n) => n.id));
  return payload.edges.filter((e) => ids.has(e.from_id) && ids.has(e.to_id));
}

export interface ToFlowGraphOptions {
  // Focal node forwarded to the layout engine (see LayoutEngineOptions).
  centerId?: string | null;
  // Layout-box override forwarded to measureNodes.
  estimateSize?: EstimateSize;
  // How a multi-column FK renders: one bundled edge forking into per-column
  // tails ("bundle", the default), or one independent edge per column pair
  // ("fan").
  compositeEdges?: "bundle" | "fan";
  // Path shape for single-column edges: horizontal-tangent cubic bezier
  // ("cubic", the default) or an orthogonal smoothstep. The composite bundle
  // keeps its cubic geometry either way — pick "fan" to make every connector a
  // single edge and have the shape apply throughout.
  edgePath?: "cubic" | "smoothstep";
  // Whether an edge gets the marching-ants dash animation while unselected.
  // Defaults to animating every FK edge.
  animateEdge?: (edge: ErdEdge) => boolean;
}

export function toFlowGraph(
  payload: ErdPayload,
  style: string = DEFAULT_LAYOUT,
  collapse = true,
  options: ToFlowGraphOptions = {},
): FlowGraph {
  const sized = measureNodes(payload.nodes, collapse, options.estimateSize);
  const positions = resolveLayout(style)(sized, resolvableEdges(payload), {
    centerId: options.centerId ?? null,
  });
  const positionsById = new Map(positions.map((p) => [p.id, p]));

  const nodes: ErdFlowNode[] = payload.nodes.map((n) => {
    const pos = positionsById.get(n.id)!;
    return {
      id: n.id,
      type: "erdTable",
      data: { ...n, __collapse: collapse },
      position: { x: pos.x, y: pos.y },
    };
  });

  const edges: Edge[] = payload.edges.flatMap((e) => mapEdge(e, options));
  return { nodes, edges };
}

function edgeColumns(explicit: string[] | undefined, single: string | null | undefined): string[] {
  if (explicit && explicit.length > 0) return explicit;
  return single ? [single] : [];
}

// Both edge kinds render themselves via custom components that read live node
// geometry — they pick the anchor side per layout (auto side) and fall back to
// the table-level handle when a referenced column row is collapsed away. We
// only set source/target (so React Flow validates the endpoints) and hand the
// column references through `data`; no static sourceHandle/targetHandle, which
// would otherwise pin the side and vanish on collapse. Rendering flags decided
// here (`__animated`, `__edgePath`) also travel on `data` — stamped only when
// they deviate from the defaults the edge components already assume.
function mapEdge(edge: ErdEdge, options: ToFlowGraphOptions): Edge[] {
  const fromCols = edgeColumns(edge.from_columns, edge.from_column);
  const toCols = edgeColumns(edge.to_columns, edge.to_column);
  const isComposite =
    (fromCols.length > 1 || toCols.length > 1) && fromCols.length > 0 && toCols.length > 0;
  const animated = options.animateEdge ? options.animateEdge(edge) : true;
  const renderFlags: { __animated?: boolean; __edgePath?: string } = {};
  if (!animated) renderFlags.__animated = false;
  if (options.edgePath === "smoothstep") renderFlags.__edgePath = "smoothstep";

  if (isComposite && options.compositeEdges === "fan") {
    const pairs = Math.max(fromCols.length, toCols.length);
    return Array.from({ length: pairs }, (_, i) => ({
      id: `${edge.id}__${i}`,
      source: edge.from_id,
      target: edge.to_id,
      type: "single",
      animated,
      data: {
        from_column: fromCols[Math.min(i, fromCols.length - 1)] ?? null,
        to_column: toCols[Math.min(i, toCols.length - 1)] ?? null,
        relationship_type: edge.relationship_type,
        ...renderFlags,
      },
    }));
  }

  if (isComposite) {
    return [
      {
        id: edge.id,
        source: edge.from_id,
        target: edge.to_id,
        type: "composite",
        animated,
        data: { from_columns: fromCols, to_columns: toCols, ...renderFlags },
      },
    ];
  }

  return [
    {
      id: edge.id,
      source: edge.from_id,
      target: edge.to_id,
      type: "single",
      animated,
      data: {
        from_column: fromCols[0] ?? null,
        to_column: toCols[0] ?? null,
        relationship_type: edge.relationship_type,
        ...renderFlags,
      },
    },
  ];
}
