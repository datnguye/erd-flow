import type { ReactElement } from "react";

// Lucide icon paths (MIT) — https://lucide.dev. Inlined to avoid a runtime
// dependency and keep the webview bundle small. Stroke uses `currentColor` so
// each caller can theme via CSS.
//
// Convention: 24x24 viewBox, 2px stroke, rounded caps/joins — matches Lucide
// defaults so icons stay visually consistent if we swap later.

interface IconProps {
  size?: number;
  className?: string;
}

function base(size: number): {
  width: number;
  height: number;
  viewBox: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeLinecap: "round";
  strokeLinejoin: "round";
} {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
}

export function TableIcon({ size = 14, className }: IconProps): ReactElement {
  // Lucide "table-2": 3-row grid. Reads clearly as a data table at small sizes.
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
    </svg>
  );
}

export function DatabaseIcon({ size = 14, className }: IconProps): ReactElement {
  // Lucide "database": cylinder — the universal "source table" glyph.
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14a9 3 0 0 0 18 0V5" />
      <path d="M3 12a9 3 0 0 0 18 0" />
    </svg>
  );
}
