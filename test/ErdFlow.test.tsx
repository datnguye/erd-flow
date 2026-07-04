import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { reactFlowMock, scalePayload } from "./_support/erd-harness";
import { edge, node } from "./_support/erd-factories";
import type { ErdNode, ErdPayload } from "../src/types/erd";

vi.mock("@xyflow/react", () => reactFlowMock());
vi.mock("@xyflow/react/dist/style.css", () => ({}));

// Import after the mock is registered.
const { ErdFlow } = await import("../src/ErdFlow");

const SMALL: ErdPayload = {
  nodes: [
    node("model.s.orders", "orders", [{ name: "id", is_primary_key: true }]),
    node("model.s.items", "items", [{ name: "order_id", is_foreign_key: true }]),
  ],
  edges: [
    edge("model.s.items", "model.s.orders", {
      id: "e0",
      from_columns: ["order_id"],
      to_columns: ["id"],
    }),
  ],
};

// A wide table (> the 5-column collapse threshold) joined to a small one, so
// the graph is collapsible and lays out cleanly under the hierarchical engine.
const WIDE: ErdPayload = {
  nodes: [
    node(
      "model.s.wide",
      "wide",
      Array.from({ length: 12 }, (_, i) => ({
        name: `c${i}`,
        is_primary_key: i === 0,
        is_foreign_key: i === 1,
      })),
    ),
    node("model.s.ref", "ref", [{ name: "id", is_primary_key: true }]),
  ],
  edges: [
    edge("model.s.wide", "model.s.ref", {
      id: "e0",
      from_columns: ["c1"],
      to_columns: ["id"],
    }),
  ],
};

afterEach(cleanup);

describe("ErdFlow", () => {
  it("renders a node per table", async () => {
    render(<ErdFlow data={SMALL} />);
    await waitFor(() => expect(screen.getByTestId("node-model.s.orders")).toBeTruthy());
    expect(screen.getByTestId("node-model.s.items")).toBeTruthy();
  });

  it("calls onOpenNode with the node record on double-click", async () => {
    const onOpen = vi.fn();
    render(<ErdFlow data={SMALL} onOpenNode={onOpen} />);
    await waitFor(() => expect(screen.getByTestId("node-model.s.orders")).toBeTruthy());
    fireEvent.doubleClick(screen.getByTestId("node-model.s.orders"));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect((onOpen.mock.calls[0][0] as ErdNode).id).toBe("model.s.orders");
  });

  it("activates a node when its header is clicked", async () => {
    const onActivate = vi.fn();
    render(<ErdFlow data={SMALL} onNodeActivate={onActivate} />);
    await waitFor(() => expect(screen.getByTestId("node-header-model.s.orders")).toBeTruthy());
    fireEvent.click(screen.getByTestId("node-header-model.s.orders"));
    expect(onActivate).toHaveBeenCalled();
    expect((onActivate.mock.calls.at(-1)?.[0] as ErdNode).id).toBe("model.s.orders");
  });

  it("clears the active node on pane click (activate → null)", async () => {
    const onActivate = vi.fn();
    render(<ErdFlow data={SMALL} onNodeActivate={onActivate} />);
    await waitFor(() => expect(screen.getByTestId("pane")).toBeTruthy());
    fireEvent.click(screen.getByTestId("pane"));
    expect(onActivate).toHaveBeenLastCalledWith(null);
  });

  it("windows to the focus neighborhood", async () => {
    const big = scalePayload({ hubs: 1, spokesPerHub: 3, islands: 4 }) as ErdPayload;
    render(<ErdFlow data={big} focus="model.big.hub_0" focusDepth={1} />);
    // hub + its 3 spokes render; the 4 unrelated islands do not.
    await waitFor(() => expect(screen.getByTestId("node-model.big.hub_0")).toBeTruthy());
    expect(screen.queryByTestId("node-source.big.island_0")).toBeNull();
  });

  it("labelFor overrides the displayed name", async () => {
    render(<ErdFlow data={SMALL} labelFor={(n) => n.id.split(".").pop() as string} />);
    await waitFor(() => {
      const header = screen.getByTestId("node-header-model.s.orders");
      expect(header.textContent).toBe("orders");
    });
  });

  it("a re-render with a new labelFor identity does not wipe a dragged position", async () => {
    const { rerender } = render(
      <ErdFlow data={SMALL} labelFor={(n) => n.name} />,
    );
    await waitFor(() => expect(screen.getByTestId("node-model.s.orders")).toBeTruthy());
    fireEvent.click(screen.getByTestId("drag-node"));
    await waitFor(() =>
      expect(screen.getByTestId("node-model.s.orders").dataset.x).toBe("999"),
    );
    rerender(<ErdFlow data={SMALL} labelFor={(n) => n.name} />);
    expect(screen.getByTestId("node-model.s.orders").dataset.x).toBe("999");
  });

  it("reports canExpand=true when a wide table is collapsible", async () => {
    const onExpandState = vi.fn();
    render(<ErdFlow data={WIDE} layout="hierarchical" onExpandStateChange={onExpandState} />);
    await waitFor(() =>
      expect(onExpandState.mock.calls.at(-1)?.[0]).toMatchObject({ canExpand: true }),
    );
  });

  it("reports canExpand=false when collapse is off (nothing to expand)", async () => {
    const onExpandState = vi.fn();
    render(
      <ErdFlow
        data={WIDE}
        layout="hierarchical"
        collapseColumns={false}
        onExpandStateChange={onExpandState}
      />,
    );
    await waitFor(() =>
      expect(onExpandState.mock.calls.at(-1)?.[0]).toMatchObject({
        canExpand: false,
        allExpanded: false,
      }),
    );
  });

  it("expandAll=true reports allExpanded=true", async () => {
    const onExpandState = vi.fn();
    render(<ErdFlow data={WIDE} layout="hierarchical" expandAll onExpandStateChange={onExpandState} />);
    await waitFor(() =>
      expect(onExpandState.mock.calls.at(-1)?.[0]).toMatchObject({ allExpanded: true }),
    );
  });

  it("dragging a node does not wipe a per-table expand toggle set while expandAll=false", async () => {
    render(<ErdFlow data={WIDE} layout="hierarchical" expandAll={false} />);
    await waitFor(() => expect(screen.getByTestId("node-model.s.wide")).toBeTruthy());
    fireEvent.click(screen.getByTestId("toggle-expand-model.s.wide"));
    await waitFor(() =>
      expect(screen.getByTestId("node-model.s.wide").dataset.expanded).toBe("true"),
    );
    fireEvent.click(screen.getByTestId("drag-node"));
    await waitFor(() =>
      expect(screen.getByTestId("node-model.s.wide").dataset.x).toBe("999"),
    );
    expect(screen.getByTestId("node-model.s.wide").dataset.expanded).toBe("true");
  });

  it("hideUnconnected keeps the focused node even when it has no edges", async () => {
    const withIsland: ErdPayload = {
      nodes: [
        node("model.s.orders", "orders", [{ name: "id", is_primary_key: true }]),
        node("source.s.island", "island", [{ name: "id", is_primary_key: true }]),
      ],
      edges: [],
    };
    render(<ErdFlow data={withIsland} focus="source.s.island" hideUnconnected />);
    await waitFor(() => expect(screen.getByTestId("node-source.s.island")).toBeTruthy());
  });

  it("stamps __focus on the focused node only", async () => {
    render(<ErdFlow data={SMALL} focus="model.s.orders" />);
    await waitFor(() =>
      expect(screen.getByTestId("node-model.s.orders").dataset.focus).toBe("true"),
    );
    expect(screen.getByTestId("node-model.s.items").dataset.focus).toBe("false");
  });

  it("stamps __showSchema when the prop is set", async () => {
    render(<ErdFlow data={SMALL} showSchema />);
    await waitFor(() =>
      expect(screen.getByTestId("node-model.s.orders").dataset.showSchema).toBe("true"),
    );
  });

  it("dimOnSelect fades unselected edges and non-endpoint nodes", async () => {
    const three: ErdPayload = {
      nodes: [
        node("model.s.orders", "orders", [{ name: "id", is_primary_key: true }]),
        node("model.s.items", "items", [{ name: "order_id", is_foreign_key: true }]),
        node("model.s.payments", "payments", [{ name: "order_id", is_foreign_key: true }]),
      ],
      edges: [
        edge("model.s.items", "model.s.orders", { id: "e0", from_column: "order_id" }),
        edge("model.s.payments", "model.s.orders", { id: "e1", from_column: "order_id" }),
      ],
    };
    render(<ErdFlow data={three} dimOnSelect />);
    await waitFor(() => expect(screen.getByTestId("edge-e0")).toBeTruthy());
    fireEvent.click(screen.getByTestId("edge-e0"));
    await waitFor(() =>
      expect(screen.getByTestId("edge-e1").dataset.opacity).toBe("0.1"),
    );
    expect(screen.getByTestId("edge-e0").dataset.opacity).toBe("1");
    expect(screen.getByTestId("node-model.s.payments").dataset.dimmed).toBe("true");
    expect(screen.getByTestId("node-model.s.orders").dataset.dimmed).toBe("false");
    expect(screen.getByTestId("node-model.s.items").dataset.dimmed).toBe("false");
  });

  it("interactive=false gates pan/zoom/drag/scroll props on ReactFlow", async () => {
    render(<ErdFlow data={SMALL} interactive={false} />);
    const flow = await screen.findByTestId("react-flow");
    expect(flow.dataset.panOnDrag).toBe("false");
    expect(flow.dataset.zoomOnScroll).toBe("false");
    expect(flow.dataset.zoomOnPinch).toBe("false");
    expect(flow.dataset.zoomOnDoubleClick).toBe("false");
    expect(flow.dataset.nodesDraggable).toBe("false");
    expect(flow.dataset.preventScrolling).toBe("false");
  });

  it("interactive=true (default) leaves preventScrolling on so zoom-on-scroll can capture the wheel", async () => {
    render(<ErdFlow data={SMALL} />);
    const flow = await screen.findByTestId("react-flow");
    expect(flow.dataset.preventScrolling).toBe("true");
  });

  it("without dimOnSelect a selection dims nothing", async () => {
    render(<ErdFlow data={SMALL} />);
    await waitFor(() => expect(screen.getByTestId("edge-e0")).toBeTruthy());
    fireEvent.click(screen.getByTestId("edge-e0"));
    await waitFor(() =>
      expect(screen.getByTestId("edge-e0").dataset.selected).toBe("true"),
    );
    expect(screen.getByTestId("node-model.s.orders").dataset.dimmed).toBe("false");
  });
});
