import { describe, expect, it } from "vitest";
import { compactColumns, erdNeighborhood, windowPayload } from "../src/payload";
import { toFlowGraph } from "../src/layout";
import { estimateHeight } from "../src/layout/dimensions";
import type { Column, ErdNode, ErdPayload } from "../src/types/erd";
import { node } from "./_support/erd-factories";

// A → B → C chain plus an isolated D, in dbterd-native edge direction
// (from_id = FK/child, to_id = parent).
const CHAIN: ErdPayload = {
  nodes: [node("a"), node("b"), node("c"), node("d")],
  edges: [
    { id: "e0", from_id: "b", to_id: "a", from_columns: [], to_columns: [] },
    { id: "e1", from_id: "c", to_id: "b", from_columns: [], to_columns: [] },
  ],
};

describe("erdNeighborhood", () => {
  it("depth 1 returns focus + direct FK neighbors only", () => {
    expect(erdNeighborhood(CHAIN, "b", 1)).toEqual(new Set(["b", "a", "c"]));
  });

  it("excludes unrelated islands", () => {
    expect(erdNeighborhood(CHAIN, "b", 1).has("d")).toBe(false);
  });

  it("depth 2 walks two hops undirected", () => {
    expect(erdNeighborhood(CHAIN, "c", 2)).toEqual(new Set(["c", "b", "a"]));
  });

  it("depth 0 returns only the focus", () => {
    expect(erdNeighborhood(CHAIN, "b", 0)).toEqual(new Set(["b"]));
  });

  it("isolated node returns only itself", () => {
    expect(erdNeighborhood(CHAIN, "d", 1)).toEqual(new Set(["d"]));
  });

  it("expands a node from its shortest-path depth even when a longer path visits it first", () => {
    // F–A, A–B, F–B, B–C: from F, B is reachable in 1 hop (F–B) or 2 hops
    // (F–A–B). A depth-first walk that treats `keep` as a global visited set
    // can reach B via the 2-hop path first and, with no remaining depth, never
    // expand to C. A proper BFS always credits B with its shortest-path depth
    // (1), so C is reached at depth 2.
    const graph: ErdPayload = {
      nodes: [node("f"), node("a"), node("b"), node("c")],
      edges: [
        { id: "e0", from_id: "f", to_id: "a", from_columns: [], to_columns: [] },
        { id: "e1", from_id: "a", to_id: "b", from_columns: [], to_columns: [] },
        { id: "e2", from_id: "f", to_id: "b", from_columns: [], to_columns: [] },
        { id: "e3", from_id: "b", to_id: "c", from_columns: [], to_columns: [] },
      ],
    };
    expect(erdNeighborhood(graph, "f", 2)).toEqual(new Set(["f", "a", "b", "c"]));
  });
});

describe("compactColumns", () => {
  const cols: Column[] = [
    { name: "id", is_primary_key: true },
    { name: "fk", is_foreign_key: true },
    { name: "extra1" },
    { name: "extra2" },
  ];

  it("keeps only key (PK/FK) columns", () => {
    expect(compactColumns(cols).map((c) => c.name)).toEqual(["id", "fk"]);
  });

  it("falls back to all columns when none are keyed", () => {
    const plain: Column[] = [{ name: "a" }, { name: "b" }];
    expect(compactColumns(plain)).toEqual(plain);
  });

  it("empty stays empty", () => {
    expect(compactColumns([])).toEqual([]);
  });
});

describe("windowPayload", () => {
  const cols: Column[] = [
    { name: "id", is_primary_key: true },
    { name: "note" },
  ];
  const data: ErdPayload = {
    nodes: [node("a", "a", cols), node("b", "b", cols), node("c", "c", cols), node("d", "d", cols)],
    edges: CHAIN.edges,
  };

  it("windows to the focus neighborhood and its edges", () => {
    const out = windowPayload(data, { focus: "b", focusDepth: 1 });
    expect(out.nodes.map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
    expect(out.edges).toHaveLength(2);
  });

  it("compacts columns when compact is set", () => {
    const out = windowPayload(data, { compact: true });
    expect(out.nodes[0].columns.map((c) => c.name)).toEqual(["id"]);
  });

  it("no focus + no compact returns an equivalent payload", () => {
    const out = windowPayload(data, {});
    expect(out.nodes).toHaveLength(4);
    expect(out.edges).toHaveLength(2);
  });

  it("does not mutate the input payload", () => {
    const before = data.nodes[0].columns.length;
    windowPayload(data, { compact: true });
    expect(data.nodes[0].columns.length).toBe(before);
  });

  it("compact records the dropped-column count as hidden_column_count", () => {
    const out = windowPayload(data, { compact: true });
    expect(out.nodes[0].hidden_column_count).toBe(1);
  });

  it("compact leaves hidden_column_count unset when nothing was dropped", () => {
    const unkeyed: ErdPayload = {
      nodes: [node("a", "a", [{ name: "x" }, { name: "y" }])],
      edges: [],
    };
    const out = windowPayload(unkeyed, { compact: true });
    expect(out.nodes[0].hidden_column_count).toBeUndefined();
  });
});

describe("toFlowGraph collapseColumns", () => {
  const wide: ErdPayload = {
    nodes: [
      {
        id: "wide",
        name: "wide",
        resource_type: "model",
        columns: Array.from({ length: 12 }, (_, i) => ({ name: `c${i}` })),
      },
    ],
    edges: [],
  };

  it("stamps __collapse=true by default", () => {
    const flow = toFlowGraph(wide, "dagre");
    expect(flow.nodes[0].data.__collapse).toBe(true);
  });

  it("stamps __collapse=false when collapse is disabled", () => {
    const flow = toFlowGraph(wide, "dagre", false);
    expect(flow.nodes[0].data.__collapse).toBe(false);
  });

  it("sizes a wide table taller when collapse is disabled (every row shown)", () => {
    const wideNode = wide.nodes[0] as ErdNode;
    expect(estimateHeight(wideNode, false)).toBeGreaterThan(estimateHeight(wideNode, true));
  });

  it("reserves one extra row for the compact '+N more columns' indicator", () => {
    const compacted: ErdNode = {
      id: "t",
      name: "t",
      columns: Array.from({ length: 6 }, (_, i) => ({ name: `c${i}` })),
    };
    const withMore: ErdNode = { ...compacted, hidden_column_count: 4 };
    expect(estimateHeight(withMore, false)).toBe(estimateHeight(compacted, false) + 22);
  });
});
