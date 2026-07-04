import { describe, expect, it } from "vitest";
import {
  anchorNodeOf,
  endpointSides,
  fkStrokeStyle,
  resolveAnchor,
  type AnchorNode,
} from "../src/components/edge-anchor";
import {
  CARD_BORDER_WIDTH,
  COLUMN_HEIGHT,
  COLUMNS_TOP_PADDING,
  HEADER_HEIGHT,
  MIN_CARD_WIDTH,
} from "../src/components/tableConstants";

function internalNode(overrides: {
  columns?: { name: string }[];
  expanded?: boolean;
  collapse?: boolean;
  width?: number;
  measuredWidth?: number;
  base?: { x: number; y: number };
}) {
  const { columns = [], expanded, collapse, width, measuredWidth, base = { x: 0, y: 0 } } = overrides;
  return {
    data: { columns, __expanded: expanded, __collapse: collapse },
    measured: measuredWidth !== undefined ? { width: measuredWidth } : {},
    width,
    internals: { positionAbsolute: base },
  } as unknown as Parameters<typeof anchorNodeOf>[0];
}

describe("anchorNodeOf", () => {
  it("returns null for a null node", () => {
    expect(anchorNodeOf(null)).toBeNull();
  });

  it("derives column count and a name->index map from node.data.columns", () => {
    const anchor = anchorNodeOf(
      internalNode({ columns: [{ name: "id" }, { name: "fk" }], base: { x: 10, y: 20 } }),
    );
    expect(anchor).not.toBeNull();
    expect(anchor!.columnCount).toBe(2);
    expect(anchor!.columnIndex.get("id")).toBe(0);
    expect(anchor!.columnIndex.get("fk")).toBe(1);
    expect(anchor!.base).toEqual({ x: 10, y: 20 });
  });

  it("falls back to MIN_CARD_WIDTH when neither measured nor width is set", () => {
    const anchor = anchorNodeOf(internalNode({}));
    expect(anchor!.width).toBe(MIN_CARD_WIDTH);
  });

  it("prefers measured.width over node.width", () => {
    const anchor = anchorNodeOf(internalNode({ width: 300, measuredWidth: 260 }));
    expect(anchor!.width).toBe(260);
  });

  it("defaults collapse to true and expanded to false when unset", () => {
    const anchor = anchorNodeOf(internalNode({}));
    expect(anchor!.collapse).toBe(true);
    expect(anchor!.expanded).toBe(false);
  });

  it("reads collapse=false and expanded=true from node data", () => {
    const anchor = anchorNodeOf(internalNode({ collapse: false, expanded: true }));
    expect(anchor!.collapse).toBe(false);
    expect(anchor!.expanded).toBe(true);
  });
});

describe("resolveAnchor", () => {
  const columns = Array.from({ length: 8 }, (_, i) => ({ name: `c${i}` }));
  const node: AnchorNode = {
    base: { x: 100, y: 200 },
    width: 240,
    columnIndex: new Map(columns.map((c, i) => [c.name, i])),
    columnCount: columns.length,
    expanded: false,
    collapse: true,
  };

  function rowCenterY(rowIndex: number): number {
    return CARD_BORDER_WIDTH + HEADER_HEIGHT + COLUMNS_TOP_PADDING + rowIndex * COLUMN_HEIGHT + COLUMN_HEIGHT / 2;
  }

  it("anchors on the card's left edge when sideIsLeft is true", () => {
    const p = resolveAnchor(node, "c0", true);
    expect(p.x).toBe(100);
    expect(p.y).toBe(200 + rowCenterY(0));
  });

  it("anchors on the card's right edge when sideIsLeft is false", () => {
    const p = resolveAnchor(node, "c0", false);
    expect(p.x).toBe(100 + 240);
  });

  it("anchors a visible column at its own row", () => {
    const p = resolveAnchor(node, "c2", true);
    expect(p.y).toBe(200 + rowCenterY(2));
  });

  it("folds a column hidden by collapse onto the collapse boundary row", () => {
    // 8 columns, collapsed (not expanded) -> only the first 5 rows are visible.
    const p = resolveAnchor(node, "c7", true);
    expect(p.y).toBe(200 + rowCenterY(4));
  });

  it("anchors an unknown column name at the collapse boundary", () => {
    const p = resolveAnchor(node, "does-not-exist", true);
    expect(p.y).toBe(200 + rowCenterY(4));
  });

  it("anchors a null column at the collapse boundary", () => {
    const p = resolveAnchor(node, null, true);
    expect(p.y).toBe(200 + rowCenterY(4));
  });

  it("uses every row once collapse is disabled", () => {
    const expandedNode: AnchorNode = { ...node, collapse: false };
    const p = resolveAnchor(expandedNode, "c7", true);
    expect(p.y).toBe(200 + rowCenterY(7));
  });
});

describe("endpointSides", () => {
  it("puts the leftmost node's side facing right and the other facing left", () => {
    const left: AnchorNode = {
      base: { x: 0, y: 0 },
      width: 100,
      columnIndex: new Map(),
      columnCount: 0,
      expanded: false,
      collapse: true,
    };
    const right: AnchorNode = { ...left, base: { x: 500, y: 0 } };
    expect(endpointSides(left, right)).toEqual({ fromIsLeft: false, toIsLeft: true });
    expect(endpointSides(right, left)).toEqual({ fromIsLeft: true, toIsLeft: false });
  });

  it("resolves deterministically when both nodes share the same x", () => {
    const a: AnchorNode = {
      base: { x: 0, y: 0 },
      width: 100,
      columnIndex: new Map(),
      columnCount: 0,
      expanded: false,
      collapse: true,
    };
    expect(endpointSides(a, a)).toEqual({ fromIsLeft: false, toIsLeft: true });
  });
});

describe("fkStrokeStyle", () => {
  it("uses the default edge token when unselected", () => {
    const style = fkStrokeStyle(false);
    expect(style.stroke).toBe("var(--erd-edge, #007acc)");
    expect(style.strokeWidth).toBe("var(--erd-edge-width, 2)");
  });

  it("uses the selected edge token when selected", () => {
    const style = fkStrokeStyle(true);
    expect(style.stroke).toBe("var(--erd-edge-selected, #e5c07b)");
    expect(style.strokeWidth).toBe("var(--erd-edge-selected-width, 3)");
  });

  it("merges an override style on top of the resolved stroke", () => {
    const style = fkStrokeStyle(false, { opacity: 0.5 });
    expect(style.opacity).toBe(0.5);
    expect(style.stroke).toBe("var(--erd-edge, #007acc)");
  });
});
