import { memo, type ReactElement } from "react";
import { BaseEdge, getSmoothStepPath, Position, useInternalNode, type EdgeProps } from "@xyflow/react";

import { anchorNodeOf, endpointSides, fkStrokeStyle, resolveAnchor } from "../edge-anchor";
import { tailPath } from "../composite-edge/geometry";

// Single-column FK edge. It anchors on the FK column's row — computed from the
// column's index in the rendered list (not handle bounds, which only exist for
// visible rows) — and picks the card side each endpoint faces from node
// positions. A hidden column anchors at the collapse boundary. Rendered via
// BaseEdge so it keeps React Flow's interaction hit-area and click highlight.
// The path shape (`__edgePath`) and dash-animation gate (`__animated`) are
// decided at map time (see toFlowGraph options) and travel on edge data.

interface SingleEdgeData {
  from_column: string | null;
  to_column: string | null;
  relationship_type?: string | null;
  __animated?: boolean;
  __edgePath?: string;
  [k: string]: unknown;
}

export const SingleEdge = memo(function SingleEdge({
  source,
  target,
  data,
  style,
  markerEnd,
  selected,
}: EdgeProps): ReactElement | null {
  const fromNode = useInternalNode(source);
  const toNode = useInternalNode(target);

  const from = anchorNodeOf(fromNode);
  const to = anchorNodeOf(toNode);
  if (!from || !to) return null;

  const edgeData = data as SingleEdgeData | undefined;
  const fromCol = edgeData?.from_column ?? null;
  const toCol = edgeData?.to_column ?? null;

  const { fromIsLeft, toIsLeft } = endpointSides(from, to);
  const fromPoint = resolveAnchor(from, fromCol, fromIsLeft);
  const toPoint = resolveAnchor(to, toCol, toIsLeft);

  const path =
    edgeData?.__edgePath === "smoothstep"
      ? getSmoothStepPath({
          sourceX: fromPoint.x,
          sourceY: fromPoint.y,
          sourcePosition: fromIsLeft ? Position.Left : Position.Right,
          targetX: toPoint.x,
          targetY: toPoint.y,
          targetPosition: toIsLeft ? Position.Left : Position.Right,
        })[0]
      : tailPath(fromPoint, toPoint);

  const animated = edgeData?.__animated !== false && !selected;

  return (
    <BaseEdge
      path={path}
      markerEnd={markerEnd}
      className={`erd-single-edge${animated ? " animated" : ""}`}
      style={fkStrokeStyle(selected ?? false, style)}
    />
  );
});
