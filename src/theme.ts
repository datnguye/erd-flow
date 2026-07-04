import type { CSSProperties } from "react";
import type { ErdTheme, ResourceMeta } from "./types/props";

// Built-in dbt resource palette — the shared domain both first-party hosts
// speak. A host overrides or extends via the `resourceMeta` prop; a non-dbt
// host can replace it entirely. `color` feeds the minimap dot; `icon` feeds
// the table-header icon (ErdTableNode reads it, never a hardcoded
// resource_type comparison). The ERD card styling itself is CSS-driven (see
// ErdTableNode.css).
export const DEFAULT_RESOURCE_META: Record<string, ResourceMeta> = {
  model: { color: "#2f6feb", icon: "table" },
  source: { color: "#16a34a", icon: "database" },
  seed: { color: "#b45309", icon: "table" },
  snapshot: { color: "#7c3aed", icon: "table" },
};

// Map ErdTheme fields → the CSS custom properties the styles read. Only set
// tokens are emitted; the rest fall back to the hex defaults baked into the CSS.
const TOKEN_MAP: Record<keyof ErdTheme, string> = {
  nodeBg: "--erd-node-bg",
  nodeFg: "--erd-node-fg",
  border: "--erd-border",
  accent: "--erd-accent",
  fk: "--erd-fk",
  headerBg: "--erd-header-bg",
  hoverBg: "--erd-hover-bg",
  mutedFg: "--erd-muted-fg",
  linkFg: "--erd-link-fg",
  divider: "--erd-divider",
  icon: "--erd-icon",
  fontMono: "--erd-font-mono",
  edge: "--erd-edge",
  edgeSelected: "--erd-edge-selected",
  edgeWidth: "--erd-edge-width",
  edgeSelectedWidth: "--erd-edge-selected-width",
  minimapBg: "--erd-minimap-bg",
  minimapDim: "--erd-minimap-dim",
  minimapMask: "--erd-minimap-mask",
  shadow: "--erd-shadow",
};

export function themeStyle(theme?: ErdTheme): CSSProperties {
  if (!theme) return {};
  const style: Record<string, string> = {};
  for (const key of Object.keys(TOKEN_MAP) as (keyof ErdTheme)[]) {
    const value = theme[key];
    if (value != null) style[TOKEN_MAP[key]] = value;
  }
  return style as CSSProperties;
}
