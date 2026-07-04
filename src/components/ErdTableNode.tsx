import {
  memo,
  useCallback,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
} from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Column } from "../types/erd";
import type { ErdFlowNode } from "../types/flow";
import { DatabaseIcon, TableIcon } from "./icons";
import { isCollapsible, visibleColumnCount } from "./tableConstants";
import "./ErdTableNode.css";

function columnBadge(col: Column): string {
  if (col.is_primary_key) return "PK";
  if (col.is_foreign_key) return "FK";
  return "";
}

function ColumnRow({ col, highlighted }: { col: Column; highlighted: boolean }): ReactElement {
  const badge = columnBadge(col);
  return (
    <li className="erd-column" data-highlighted={highlighted ? "true" : "false"}>
      <span className={`erd-column-badge badge-${badge.toLowerCase() || "none"}`}>{badge}</span>
      <span className="erd-column-name">{col.name}</span>
      <span className="erd-column-type">{col.data_type ?? ""}</span>
    </li>
  );
}

export const ErdTableNode = memo(function ErdTableNode({ id, data }: NodeProps<ErdFlowNode>) {
  const hasCompiledSql = typeof data.compiled_sql === "string" && data.compiled_sql.length > 0;

  // Column collapse can be turned off host-side (`collapseColumns={false}`), so
  // a table always shows every column with no toggle — suits a focused view
  // where the whole neighbourhood is small and the join columns must stay
  // visible. `__collapse` is stamped on node data by ErdFlow (default true).
  const collapse = data.__collapse !== false;
  const canCollapse = isCollapsible(data.columns.length, collapse);
  // Expand state lives on node data, stamped by ErdFlow, so the FK edges can
  // read it and anchor to the right rows; the node just reflects it and
  // forwards the toggle.
  const expanded = data.__expanded === true;
  const onToggleExpand = data.__onToggleExpand as ((id: string) => void) | undefined;
  const toggleExpand = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onToggleExpand?.(id);
    },
    [id, onToggleExpand],
  );

  const activateOnKey = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.currentTarget.click();
  }, []);

  const visibleColumns = data.columns.slice(
    0,
    visibleColumnCount(data.columns.length, expanded, collapse),
  );
  const hiddenCount = data.columns.length - visibleColumns.length;

  // Filter highlight: ErdFlow stamps `__filterState` on data — "match" lights
  // the node up, "dim" fades it. Absent means "no filter active" (default look).
  const filterState = data.__filterState as "match" | "dim" | undefined;
  const isActive = data.__active === true;
  // The focused node (ErdFlow's `focus` prop) — exposed as `data-focus` so a
  // host can ring it via CSS; the package draws nothing by default.
  const isFocus = data.__focus === true;
  // Edge-selection dimming (ErdFlow's `dimOnSelect`): a node not touching the
  // selected edge fades so the joined pair stands out.
  const isDimmed = data.__dimmed === true;
  const showSchema = data.__showSchema === true && !!data.schema_name;
  // Columns dropped by compact windowing — surfaced as a passive count row,
  // distinct from the interactive "N more" collapse toggle below.
  const compactedCount = data.hidden_column_count ?? 0;
  // Columns joined by the selected edge(s) — ErdFlow stamps the set to light up.
  const highlightColumns = data.__highlightColumns as Set<string> | undefined;
  // Header icon resolved from the merged resourceMeta, stamped by ErdFlow —
  // never a hardcoded resource_type comparison, so a non-dbt host's taxonomy
  // still picks an icon.
  const icon = data.__icon as "database" | "table" | undefined;

  return (
    <div
      className="erd-table"
      data-resource={data.resource_type}
      data-filter={filterState ?? "off"}
      data-active={isActive ? "true" : "false"}
      data-focus={isFocus ? "true" : "false"}
      data-dimmed={isDimmed ? "true" : "false"}
    >
      {/* Hidden connection points React Flow needs so the FK edges validate.
          They render no visible dot — the custom edges compute their own anchors
          from the column rows, so the cards stay clean. */}
      <Handle type="target" position={Position.Left} id="__node_in" className="erd-hidden-handle" />
      <Handle type="source" position={Position.Right} id="__node_out" className="erd-hidden-handle" />
      <header
        className="erd-table-header nokey"
        title={hasCompiledSql ? "Double-click to open" : ""}
        role="button"
        tabIndex={0}
        onKeyDown={activateOnKey}
      >
        <span className="erd-table-icon">
          {icon === "database" ? <DatabaseIcon size={14} /> : <TableIcon size={14} />}
        </span>
        <span className="erd-table-name">{data.name}</span>
        {showSchema ? <span className="erd-table-schema">{data.schema_name}</span> : null}
      </header>
      <ul className="erd-table-columns">
        {visibleColumns.map((col, i) => (
          <ColumnRow
            key={`${col.name}-${i}`}
            col={col}
            highlighted={highlightColumns?.has(col.name) ?? false}
          />
        ))}
      </ul>
      {compactedCount > 0 ? (
        <div className="erd-table-more">+{compactedCount} more columns</div>
      ) : null}
      {canCollapse ? (
        <button
          type="button"
          className="erd-table-expand"
          onClick={toggleExpand}
          title={expanded ? "Collapse columns" : `Show ${hiddenCount} more columns`}
        >
          {expanded ? "▲ Collapse" : `▼ ${hiddenCount} more`}
        </button>
      ) : null}
    </div>
  );
});
