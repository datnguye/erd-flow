import { buildAdjacency } from "./layout/graph";
import type { Column, ErdNode, ErdPayload } from "./types/erd";

// The `depth`-hop undirected FK neighbourhood of a focus node, over the ERD's
// FK edges. Mirrors the DAG neighbourhood windowing: a focused ERD renders only
// the focus and its nearby tables so a deeply-connected fact table doesn't pull
// in the whole schema. A level-by-level BFS, so a node reachable via multiple
// paths always expands from its true shortest-path depth rather than whichever
// path visits it first.
export function erdNeighborhood(payload: ErdPayload, focus: string, depth = 1): Set<string> {
  const keep = new Set<string>([focus]);
  const adj = buildAdjacency(payload.edges);
  let frontier = [focus];
  for (let remaining = depth; remaining > 0 && frontier.length > 0; remaining--) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const nb of adj.get(id) ?? []) {
        if (!keep.has(nb)) {
          keep.add(nb);
          next.push(nb);
        }
      }
    }
    frontier = next;
  }
  return keep;
}

function isKeyColumn(col: Column): boolean {
  return col.is_primary_key === true || col.is_foreign_key === true;
}

// Compact a node's columns to only its key (PK/FK) columns, which carry the
// relationships. A table with no keyed columns keeps all of them (there is
// nothing to compact). Non-key columns dropped here are gone from the node's
// `columns` entirely — windowPayload records the dropped count as
// `hidden_column_count`, which the card surfaces as a passive "+N more
// columns" row — so this is what makes a wide fact table read as a few rows
// in the overview.
export function compactColumns(columns: Column[]): Column[] {
  const keyed = columns.filter(isKeyColumn);
  return keyed.length ? keyed : columns;
}

export interface WindowOptions {
  focus?: string | null;
  focusDepth?: number;
  compact?: boolean;
}

// Derive the payload actually laid out: window to the focus neighbourhood (when
// focused) and/or compact each node's columns. Pure — returns a new payload,
// never mutates the input.
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
    nodes = nodes.map((n: ErdNode) => {
      const kept = compactColumns(n.columns);
      const hidden = n.columns.length - kept.length;
      return hidden > 0
        ? { ...n, columns: kept, hidden_column_count: hidden }
        : { ...n, columns: kept };
    });
  }

  return { ...payload, nodes, edges };
}
