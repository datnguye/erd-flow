import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeProps } from "@xyflow/react";
import { reactFlowMock } from "./_support/erd-harness";
import type { ErdFlowNode, ErdNodeData } from "../src/types/flow";

vi.mock("@xyflow/react", () => reactFlowMock());

// Import after the mock is registered.
const { ErdTableNode } = await import("../src/components/ErdTableNode");

function nodeProps(data: Partial<ErdNodeData>): NodeProps<ErdFlowNode> {
  return {
    id: (data.id as string) ?? "model.s.orders",
    data: {
      id: "model.s.orders",
      name: "orders",
      resource_type: "model",
      schema_name: "analytics",
      columns: [],
      ...data,
    },
  } as unknown as NodeProps<ErdFlowNode>;
}

afterEach(cleanup);

describe("ErdTableNode", () => {
  it("renders the schema qualifier only when __showSchema is stamped", () => {
    const { container, rerender } = render(<ErdTableNode {...nodeProps({ __showSchema: true })} />);
    expect(container.querySelector(".erd-table-schema")?.textContent).toBe("analytics");
    rerender(<ErdTableNode {...nodeProps({})} />);
    expect(container.querySelector(".erd-table-schema")).toBeNull();
  });

  it("renders a passive '+N more columns' row for compacted columns", () => {
    const { container } = render(
      <ErdTableNode
        {...nodeProps({ columns: [{ name: "id", is_primary_key: true }], hidden_column_count: 7 })}
      />,
    );
    expect(container.querySelector(".erd-table-more")?.textContent).toBe("+7 more columns");
  });

  it("exposes focus and dimmed stamps as data attributes", () => {
    const { container } = render(
      <ErdTableNode {...nodeProps({ __focus: true, __dimmed: true })} />,
    );
    const card = container.querySelector(".erd-table") as HTMLElement;
    expect(card.dataset.focus).toBe("true");
    expect(card.dataset.dimmed).toBe("true");
  });
});
