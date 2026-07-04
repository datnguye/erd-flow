// Estimated table card dimensions fed to dagre. We can't measure real
// rendered sizes before layout runs, so we approximate by header + per-column
// row height. Dagre uses these to space nodes without overlap.

import {
  CARD_BORDER_WIDTH,
  COLLAPSE_TOGGLE_HEIGHT,
  COLUMN_HEIGHT,
  COLUMNS_BOTTOM_PADDING,
  COLUMNS_TOP_PADDING,
  HEADER_HEIGHT,
  isCollapsible,
  MIN_CARD_WIDTH,
  visibleColumnCount,
} from "../components/tableConstants";
import type { Column, ErdNode } from "../types/erd";

const MAX_TABLE_WIDTH = 440;
// Visual budget per character; tuned against the ErdTableNode CSS (12px
// monospace column name + 10px muted type + PK/FK badge column).
const CHAR_WIDTH = 7;
const TABLE_HORIZONTAL_PADDING = 60;
const MIN_TABLE_HEIGHT = 80;

export interface TableDimensions {
  width: number;
  height: number;
}

export function estimateWidth(node: ErdNode): number {
  // Longest "column — type" line drives the card width. Length is capped so
  // a single absurdly-long column name doesn't blow out the layout.
  const contentLen = (col: Column): number =>
    col.name.length + (col.data_type ? col.data_type.length + 2 : 0);
  const longest = node.columns.reduce(
    (max, c) => Math.max(max, contentLen(c)),
    node.name.length,
  );
  const raw = longest * CHAR_WIDTH + TABLE_HORIZONTAL_PADDING;
  return Math.min(MAX_TABLE_WIDTH, Math.max(MIN_CARD_WIDTH, raw));
}

export function estimateHeight(node: ErdNode, collapse = true): number {
  const total = node.columns.length;
  const visible = visibleColumnCount(total, false, collapse);
  const moreRow = node.hidden_column_count ? 1 : 0;
  const toggleExtra = isCollapsible(total, collapse) ? COLLAPSE_TOGGLE_HEIGHT : 0;
  return Math.max(
    MIN_TABLE_HEIGHT,
    HEADER_HEIGHT +
      (visible + moreRow) * COLUMN_HEIGHT +
      COLUMNS_TOP_PADDING +
      COLUMNS_BOTTOM_PADDING +
      2 * CARD_BORDER_WIDTH +
      toggleExtra,
  );
}

export function estimateDimensions(node: ErdNode, collapse = true): TableDimensions {
  return { width: estimateWidth(node), height: estimateHeight(node, collapse) };
}

// A payload node carrying its estimated layout box — what a layout engine
// receives. The box is an estimate (real DOM sizes don't exist pre-render),
// so engines space by these, not by measured pixels.
export type SizedErdNode = ErdNode & TableDimensions;

// Host override for the layout box estimate. `visibleColumns` is the row count
// the card will render (post-collapse) and `hasToggle` whether the "N more"
// collapse toggle adds its extra strip — both derived from the same constants
// the default estimator uses, so a host can reproduce or replace the math.
export type EstimateSize = (
  node: ErdNode,
  visibleColumns: number,
  hasToggle: boolean,
) => TableDimensions;

export function measureNodes(
  nodes: readonly ErdNode[],
  collapse = true,
  estimateSize?: EstimateSize,
): SizedErdNode[] {
  return nodes.map((node) => {
    const dims = estimateSize
      ? estimateSize(
          node,
          visibleColumnCount(node.columns.length, false, collapse),
          isCollapsible(node.columns.length, collapse),
        )
      : estimateDimensions(node, collapse);
    return { ...node, ...dims };
  });
}

export function dimensionsOf(sized: readonly SizedErdNode[]): Map<string, TableDimensions> {
  return new Map(sized.map((n) => [n.id, { width: n.width, height: n.height }]));
}
