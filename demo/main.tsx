import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { ErdFlow, LAYOUT_STYLES, isLayoutStyle, type ErdNode, type LayoutStyle } from "../src";
import { SAMPLE } from "./sample";
import "./demo.css";

const params = new URLSearchParams(location.search);
const layoutParam = params.get("layout");
const initialLayout: LayoutStyle = isLayoutStyle(layoutParam) ? layoutParam : "radial";
const initialFocus = params.get("focus");
const initialCollapse = params.get("collapse") !== "off";

function Demo(): JSX.Element {
  const [layout, setLayout] = useState<LayoutStyle>(initialLayout);
  const [focus, setFocus] = useState<string | null>(initialFocus);
  const [collapse, setCollapse] = useState(initialCollapse);
  const [active, setActive] = useState<ErdNode | null>(null);
  const [expandAll, setExpandAll] = useState(false);
  const [interactive, setInteractive] = useState(params.get("locked") !== "on");
  const [expandState, setExpandState] = useState({ allExpanded: false, canExpand: false });

  return (
    <div className="demo">
      <header className="demo-bar">
        <strong>erd-flow demo</strong>
        <label>
          Layout{" "}
          <select
            data-testid="layout"
            value={layout}
            onChange={(e) => setLayout(e.target.value as LayoutStyle)}
          >
            {LAYOUT_STYLES.map((style) => (
              <option key={style} value={style}>
                {style}
              </option>
            ))}
          </select>
        </label>
        <label>
          Focus{" "}
          <select
            data-testid="focus"
            value={focus ?? ""}
            onChange={(e) => setFocus(e.target.value || null)}
          >
            <option value="">(none)</option>
            {SAMPLE.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            data-testid="collapse"
            checked={collapse}
            onChange={(e) => setCollapse(e.target.checked)}
          />{" "}
          collapse columns
        </label>
        <button
          type="button"
          data-testid="expand-all"
          disabled={!expandState.canExpand}
          onClick={() => setExpandAll(!expandState.allExpanded)}
        >
          {expandState.allExpanded ? "Collapse all" : "Expand all"}
        </button>
        <label>
          <input
            type="checkbox"
            data-testid="interactive"
            checked={interactive}
            onChange={(e) => setInteractive(e.target.checked)}
          />{" "}
          interactive
        </label>
        <span data-testid="active">{active ? `active: ${active.name}` : "no active node"}</span>
      </header>
      <div className="demo-canvas">
        <ErdFlow
          data={SAMPLE}
          layout={layout}
          focus={focus}
          collapseColumns={collapse}
          expandAll={expandAll}
          onExpandStateChange={setExpandState}
          interactive={interactive}
          onNodeActivate={setActive}
          onOpenNode={(n) => setActive(n)}
        />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
);
