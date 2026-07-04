import { estimateDimensions } from "@/layout/dimensions";
import type { ErdNode } from "@/types/erd";

interface PositionedNode {
  id: string;
  x: number;
  y: number;
}

export function countOverlaps(out: PositionedNode[], nodes: ErdNode[]): number {
  const dims = new Map(nodes.map((n) => [n.id, estimateDimensions(n)]));
  const boxes = out.map((p) => ({
    x: p.x,
    y: p.y,
    w: dims.get(p.id)!.width,
    h: dims.get(p.id)!.height,
  }));
  let overlaps = 0;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 1 && oy > 1) overlaps++;
    }
  }
  return overlaps;
}
