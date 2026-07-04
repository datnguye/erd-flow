import { describe, expect, it } from "vitest";
import type { Edge } from "@xyflow/react";
import { columnsForSelectedEdges } from "../src/components/column-highlight";

function edge(overrides: Partial<Edge> & { data?: Record<string, unknown> }): Edge {
  return {
    id: overrides.id ?? "e1",
    source: overrides.source ?? "a",
    target: overrides.target ?? "b",
    selected: overrides.selected,
    data: overrides.data,
  } as Edge;
}

describe("columnsForSelectedEdges", () => {
  it("returns an empty map when nothing is selected", () => {
    const edges = [edge({ selected: false, data: { from_column: "id", to_column: "id" } })];
    expect(columnsForSelectedEdges(edges)).toEqual(new Map());
  });

  it("maps a selected single-column edge's columns to its source/target", () => {
    const edges = [
      edge({ selected: true, source: "orders", target: "customers", data: { from_column: "customer_id", to_column: "id" } }),
    ];
    const result = columnsForSelectedEdges(edges);
    expect(result.get("orders")).toEqual(new Set(["customer_id"]));
    expect(result.get("customers")).toEqual(new Set(["id"]));
  });

  it("maps a selected composite edge's column arrays", () => {
    const edges = [
      edge({
        selected: true,
        source: "orders",
        target: "customers",
        data: { from_columns: ["a", "b"], to_columns: ["x", "y"] },
      }),
    ];
    const result = columnsForSelectedEdges(edges);
    expect(result.get("orders")).toEqual(new Set(["a", "b"]));
    expect(result.get("customers")).toEqual(new Set(["x", "y"]));
  });

  it("ignores a null/undefined column reference", () => {
    const edges = [edge({ selected: true, data: { from_column: null, to_column: undefined } })];
    expect(columnsForSelectedEdges(edges)).toEqual(new Map());
  });

  it("merges columns from multiple selected edges touching the same node", () => {
    const edges = [
      edge({ id: "e1", selected: true, source: "orders", target: "customers", data: { from_column: "customer_id", to_column: "id" } }),
      edge({ id: "e2", selected: true, source: "orders", target: "regions", data: { from_column: "region_id", to_column: "id" } }),
    ];
    const result = columnsForSelectedEdges(edges);
    expect(result.get("orders")).toEqual(new Set(["customer_id", "region_id"]));
  });
});
