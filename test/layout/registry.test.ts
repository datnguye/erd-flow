import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAYOUT,
  registerLayout,
  resolveLayout,
  toFlowGraph,
  type LayoutEngine,
  type SizedErdNode,
} from "@/layout";
import type { ErdPayload } from "@/types/erd";
import { edge, node } from "../_support/erd-factories";

const payload: ErdPayload = {
  nodes: [
    node("model.s.orders", "orders", [
      { name: "id", is_primary_key: true },
      { name: "customer_id", is_foreign_key: true },
    ]),
    node("model.s.customers", "customers"),
  ],
  edges: [
    edge("model.s.orders", "model.s.customers", { id: "e1", from_column: "customer_id" }),
  ],
};

const grid: LayoutEngine = (sized) =>
  sized.map((n, i) => ({
    id: n.id,
    x: i * 1000,
    y: i * 500,
    dimensions: { width: n.width, height: n.height },
  }));

describe("registerLayout / resolveLayout", () => {
  it("a registered engine is used by toFlowGraph under its name", () => {
    registerLayout("test-grid", grid);
    const graph = toFlowGraph(payload, "test-grid");
    expect(graph.nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(graph.nodes[1].position).toEqual({ x: 1000, y: 500 });
  });

  it("an unknown name resolves to the default engine", () => {
    expect(resolveLayout("no-such-layout")).toBe(resolveLayout(DEFAULT_LAYOUT));
    const graph = toFlowGraph(payload, "no-such-layout");
    expect(graph.nodes).toHaveLength(2);
  });

  it("engines receive pre-sized nodes and the centerId", () => {
    let seen: { sized: readonly SizedErdNode[]; centerId?: string | null } | null = null;
    registerLayout("test-spy", (sized, edges, opts) => {
      seen = { sized, centerId: opts.centerId };
      return grid(sized, edges, opts);
    });
    toFlowGraph(payload, "test-spy", true, { centerId: "model.s.orders" });
    expect(seen!.centerId).toBe("model.s.orders");
    expect(seen!.sized[0].width).toBeGreaterThan(0);
    expect(seen!.sized[0].height).toBeGreaterThan(0);
  });

  it("estimateSize overrides the layout box the engine sees", () => {
    let widths: number[] = [];
    registerLayout("test-sizes", (sized, edges, opts) => {
      widths = sized.map((n) => n.width);
      return grid(sized, edges, opts);
    });
    toFlowGraph(payload, "test-sizes", true, {
      estimateSize: (n, visibleColumns) => ({ width: 230, height: 34 + visibleColumns * 22 }),
    });
    expect(widths).toEqual([230, 230]);
  });
});

describe("toFlowGraph edge options", () => {
  const composite: ErdPayload = {
    nodes: [
      node("model.s.orders", "orders", [
        { name: "customer_id", is_foreign_key: true },
        { name: "segment_code", is_foreign_key: true },
      ]),
      node("model.s.customers", "customers", [
        { name: "id", is_primary_key: true },
        { name: "segment", is_primary_key: true },
      ]),
    ],
    edges: [
      edge("model.s.orders", "model.s.customers", {
        id: "e1",
        from_columns: ["customer_id", "segment_code"],
        to_columns: ["id", "segment"],
      }),
    ],
  };

  it("compositeEdges: 'fan' splits a multi-column FK into per-pair single edges", () => {
    const graph = toFlowGraph(composite, DEFAULT_LAYOUT, true, { compositeEdges: "fan" });
    expect(graph.edges.map((e) => e.id)).toEqual(["e1__0", "e1__1"]);
    expect(graph.edges.every((e) => e.type === "single")).toBe(true);
    expect(graph.edges[0].data).toMatchObject({ from_column: "customer_id", to_column: "id" });
    expect(graph.edges[1].data).toMatchObject({ from_column: "segment_code", to_column: "segment" });
  });

  it("compositeEdges default keeps the bundled composite edge", () => {
    const graph = toFlowGraph(composite);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].type).toBe("composite");
  });

  it("animateEdge gates the dash animation per edge", () => {
    const off = toFlowGraph(payload, DEFAULT_LAYOUT, true, { animateEdge: () => false });
    expect(off.edges[0].data).toMatchObject({ __animated: false });
    const on = toFlowGraph(payload, DEFAULT_LAYOUT, true, { animateEdge: () => true });
    expect(on.edges[0].data).not.toHaveProperty("__animated");
  });

  it("edgePath: 'smoothstep' travels on edge data; the default stamps nothing", () => {
    const stepped = toFlowGraph(payload, DEFAULT_LAYOUT, true, { edgePath: "smoothstep" });
    expect(stepped.edges[0].data).toMatchObject({ __edgePath: "smoothstep" });
    const cubic = toFlowGraph(payload);
    expect(cubic.edges[0].data).not.toHaveProperty("__edgePath");
  });
});
