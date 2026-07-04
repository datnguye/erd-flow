import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type NodeChange,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from "@xyflow/react";
import { columnsForSelectedEdges } from "./components/column-highlight";
import { edgeTypes } from "./components/edgeTypes";
import { nodeTypes } from "./components/nodeTypes";
import { isCollapsible } from "./components/tableConstants";
import { DEFAULT_LAYOUT, toFlowGraph } from "./layout";
import { windowPayload } from "./payload";
import { DEFAULT_RESOURCE_META, themeStyle } from "./theme";
import type { ErdFlowNode } from "./types/flow";
import type { ErdFlowProps } from "./types/props";
import "@xyflow/react/dist/style.css";
import "./components/ErdTableNode.css";
import "./ErdFlow.css";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

type FilterHighlight = "match" | "dim" | undefined;

interface DecorationEntry {
  source: ErdFlowNode;
  filterState: FilterHighlight;
  active: boolean;
  expanded: boolean;
  highlightKey: string;
  icon: string;
  focus: boolean;
  dimmed: boolean;
  showSchema: boolean;
  decorated: ErdFlowNode;
}

export function ErdFlow(props: ErdFlowProps): ReactElement {
  const {
    data,
    focus = null,
    focusDepth = 1,
    compact = false,
    collapseColumns = true,
    expandAll,
    onExpandStateChange,
    interactive = true,
    onNodeActivate,
    onOpenNode,
    resourceMeta,
    labelFor,
    theme,
    colorMode = "dark",
    minimap = true,
    controls = true,
    background = true,
    showSchema = false,
    compositeEdges = "bundle",
    edgePath = "cubic",
    animateEdge,
    estimateSize,
    dimOnSelect = false,
    onlyRenderVisibleElements = false,
    fitViewOptions,
    refitKey,
    className,
  } = props;

  // Registered layout name; resolveLayout (inside toFlowGraph) falls back to
  // the default for an unknown one, so persisted junk can't break rendering.
  const layout: string = props.layout ?? props.defaultLayout ?? DEFAULT_LAYOUT;
  const filter = props.filter ?? "";
  const hideUnconnected = props.hideUnconnected ?? false;

  const meta = useMemo(
    () => ({ ...DEFAULT_RESOURCE_META, ...(resourceMeta ?? {}) }),
    [resourceMeta],
  );

  const [baseNodes, setBaseNodes] = useState<ErdFlowNode[]>([]);
  const [baseEdges, setBaseEdges] = useState<Edge[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState<ErdFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | undefined>();
  const [expandedNodeIds, setExpandedNodeIds] = useState<ReadonlySet<string>>(new Set());

  const toggleExpanded = useCallback((nodeId: string): void => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const flowRef = useRef<ReactFlowInstance<ErdFlowNode, Edge> | null>(null);
  const pendingRefit = useRef(false);

  const labelForRef = useRef(labelFor);
  labelForRef.current = labelFor;
  const estimateSizeRef = useRef(estimateSize);
  estimateSizeRef.current = estimateSize;
  const animateEdgeRef = useRef(animateEdge);
  animateEdgeRef.current = animateEdge;

  // Sole owner of positioning: window the payload to the focus neighbourhood
  // and/or compact its columns, then lay out. Re-runs on any input that changes
  // the laid-out graph. `labelFor`, `estimateSize`, and `animateEdge` are read
  // via refs so an inline host callback (a new function identity every render)
  // doesn't re-run the layout.
  useEffect(() => {
    const windowed = windowPayload(data, { focus, focusDepth, compact });
    const flow = toFlowGraph(windowed, layout, collapseColumns, {
      centerId: focus ?? null,
      estimateSize: estimateSizeRef.current,
      compositeEdges,
      edgePath,
      animateEdge: animateEdgeRef.current,
    });
    const label = labelForRef.current;
    if (label) {
      for (const n of flow.nodes) n.data.name = label(n.data);
    }
    setBaseNodes(flow.nodes);
    setBaseEdges(flow.edges);
    pendingRefit.current = true;
  }, [data, focus, focusDepth, compact, collapseColumns, layout, compositeEdges, edgePath]);

  const matchedIds = useMemo<Set<string>>(() => {
    const query = normalize(filter);
    if (!query) return new Set();
    const set = new Set<string>();
    for (const node of baseNodes) {
      if (normalize(node.data.name).includes(query)) set.add(node.id);
    }
    return set;
  }, [filter, baseNodes]);

  const filterActive = filter.trim().length > 0;

  const connectedNodeIds = useMemo<Set<string>>(
    () => new Set(baseEdges.flatMap((e) => [e.source, e.target])),
    [baseEdges],
  );

  const highlightedColumns = useMemo<Map<string, Set<string>>>(
    () => columnsForSelectedEdges(edges),
    [edges],
  );

  const highlightKeys = useMemo<Map<string, string>>(() => {
    const keys = new Map<string, string>();
    for (const [nodeId, columns] of highlightedColumns) {
      keys.set(nodeId, [...columns].sort().join(","));
    }
    return keys;
  }, [highlightedColumns]);

  const visibleNodes = useMemo<ErdFlowNode[]>(
    () =>
      hideUnconnected
        ? baseNodes.filter((n) => n.id === focus || connectedNodeIds.has(n.id))
        : baseNodes,
    [baseNodes, connectedNodeIds, hideUnconnected, focus],
  );

  const visibleIds = useMemo<Set<string>>(
    () => new Set(visibleNodes.map((n) => n.id)),
    [visibleNodes],
  );

  // Nodes touching a selected edge — the ones dimOnSelect keeps at full
  // opacity. Empty set ⇒ no dimming (nothing selected, or the feature is off).
  const selectedEdgeEndpoints = useMemo<Set<string>>(() => {
    if (!dimOnSelect) return new Set();
    const endpoints = new Set<string>();
    for (const e of edges) {
      if (e.selected) {
        endpoints.add(e.source);
        endpoints.add(e.target);
      }
    }
    return endpoints;
  }, [dimOnSelect, edges]);

  const decoratedCache = useRef(new Map<string, DecorationEntry>());

  const renderNodes = useMemo<ErdFlowNode[]>(() => {
    const cache = decoratedCache.current;
    const next = new Map<string, DecorationEntry>();
    const dimActive = selectedEdgeEndpoints.size > 0;
    const result = visibleNodes.map((node) => {
      const isMatch = filterActive ? matchedIds.has(node.id) : false;
      const isActive = node.id === activeNodeId;
      const filterState: FilterHighlight = filterActive ? (isMatch ? "match" : "dim") : undefined;
      const highlightSet = highlightedColumns.get(node.id);
      const highlightKey = highlightKeys.get(node.id) ?? "";
      const isExpanded = expandedNodeIds.has(node.id);
      const icon = meta[node.data.resource_type ?? ""]?.icon ?? "table";
      const isFocus = node.id === focus;
      const isDimmed = dimActive && !selectedEdgeEndpoints.has(node.id);
      const prev = cache.get(node.id);
      let entry: DecorationEntry;
      if (
        prev &&
        prev.source === node &&
        prev.filterState === filterState &&
        prev.active === isActive &&
        prev.expanded === isExpanded &&
        prev.highlightKey === highlightKey &&
        prev.icon === icon &&
        prev.focus === isFocus &&
        prev.dimmed === isDimmed &&
        prev.showSchema === showSchema
      ) {
        entry = prev;
      } else {
        entry = {
          source: node,
          filterState,
          active: isActive,
          expanded: isExpanded,
          highlightKey,
          icon,
          focus: isFocus,
          dimmed: isDimmed,
          showSchema,
          decorated: {
            ...node,
            data: {
              ...node.data,
              __filterState: filterState,
              __active: isActive,
              __highlightColumns: highlightSet,
              __expanded: isExpanded,
              __onToggleExpand: toggleExpanded,
              __icon: icon,
              __focus: isFocus,
              __dimmed: isDimmed,
              __showSchema: showSchema,
            },
          } as ErdFlowNode,
        };
      }
      next.set(node.id, entry);
      return entry.decorated;
    });
    decoratedCache.current = next;
    return result;
  }, [
    visibleNodes,
    matchedIds,
    filterActive,
    activeNodeId,
    highlightedColumns,
    highlightKeys,
    expandedNodeIds,
    toggleExpanded,
    meta,
    focus,
    selectedEdgeEndpoints,
    showSchema,
  ]);

  const renderEdges = useMemo<Edge[]>(
    () => baseEdges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target)),
    [baseEdges, visibleIds],
  );

  const fitViewOptionsRef = useRef(fitViewOptions);
  fitViewOptionsRef.current = fitViewOptions;

  const prevVisibleIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    setNodes(renderNodes);
    const prev = prevVisibleIds.current;
    const membershipChanged =
      prev !== null &&
      (prev.size !== visibleIds.size || [...visibleIds].some((id) => !prev.has(id)));
    prevVisibleIds.current = visibleIds;
    const relaidOut = pendingRefit.current;
    pendingRefit.current = false;
    if (membershipChanged || relaidOut) {
      void flowRef.current?.fitView({ duration: 200, ...fitViewOptionsRef.current });
    }
  }, [renderNodes, setNodes, visibleIds]);

  // Host-requested re-fit: a changed refitKey (e.g. fullscreen toggled) re-fits
  // after a short settle so the container has its new size before measuring.
  const prevRefitKey = useRef(refitKey);
  useEffect(() => {
    if (prevRefitKey.current === refitKey) return;
    prevRefitKey.current = refitKey;
    const timer = setTimeout(() => {
      void flowRef.current?.fitView({ duration: 200, ...fitViewOptionsRef.current });
    }, 120);
    return () => clearTimeout(timer);
  }, [refitKey]);

  useEffect(() => {
    setEdges((prev) => {
      const selectedIds = new Set(prev.filter((e) => e.selected).map((e) => e.id));
      return renderEdges.map((e) => (selectedIds.has(e.id) ? { ...e, selected: true } : e));
    });
  }, [renderEdges, setEdges]);

  const onNodeClick = useCallback<NodeMouseHandler>(
    (event, node) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".erd-table-header")) return;
      setActiveNodeId(node.id);
      const record = baseNodes.find((n) => n.id === node.id)?.data;
      if (record) onNodeActivate?.(record);
    },
    [baseNodes, onNodeActivate],
  );

  const onNodeDoubleClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      const record = baseNodes.find((n) => n.id === node.id)?.data;
      if (record) onOpenNode?.(record);
    },
    [baseNodes, onOpenNode],
  );

  const onNodesChangeWithSync = useCallback(
    (changes: NodeChange<ErdFlowNode>[]): void => {
      onNodesChange(changes);
      const dropped = new Map<string, { x: number; y: number }>();
      for (const change of changes) {
        if (change.type === "position" && change.dragging === false && change.position) {
          dropped.set(change.id, change.position);
        }
      }
      if (dropped.size === 0) return;
      setBaseNodes((prev) =>
        prev.map((n) => {
          const pos = dropped.get(n.id);
          return pos ? { ...n, position: pos } : n;
        }),
      );
    },
    [onNodesChange],
  );

  const clearActiveNode = useCallback((): void => {
    setActiveNodeId(undefined);
    onNodeActivate?.(null);
  }, [onNodeActivate]);

  // Ids of tables wide enough to collapse — the only ones expand-all affects.
  // Empty when collapse is off (nothing collapses, so nothing to expand).
  const collapsibleIds = useMemo<string[]>(
    () =>
      collapseColumns
        ? baseNodes.filter((n) => isCollapsible(n.data.columns.length)).map((n) => n.id)
        : [],
    [baseNodes, collapseColumns],
  );

  // A stable key over the collapsible id *set* (order-independent), so a drag
  // that replaces `baseNodes` (and thus `collapsibleIds`' identity) without
  // changing which tables are collapsible does not re-fire the expand-all
  // effect below and clobber the user's per-table toggles.
  const collapsibleIdsKey = [...collapsibleIds].sort().join(",");

  // Controlled expand-all: when the host passes `expandAll`, force every
  // collapsible table open (true) or closed (false), overriding per-table
  // toggles. Keyed on `expandAll` and the collapsible id set's content, not
  // `collapsibleIds`' identity, so unrelated re-renders (e.g. node drags)
  // don't re-apply it and wipe user toggles.
  useEffect(() => {
    if (expandAll === undefined) return;
    setExpandedNodeIds(expandAll ? new Set(collapsibleIds) : new Set());
  }, [expandAll, collapsibleIdsKey]);

  // Report the aggregate expand state so a host can label its expand-all button.
  const allExpanded = useMemo(
    () => collapsibleIds.length > 0 && collapsibleIds.every((id) => expandedNodeIds.has(id)),
    [collapsibleIds, expandedNodeIds],
  );
  useEffect(() => {
    onExpandStateChange?.({ allExpanded, canExpand: collapsibleIds.length > 0 });
  }, [allExpanded, collapsibleIds.length, onExpandStateChange]);

  const miniMapNodeColor = useCallback(
    (node: { data?: Record<string, unknown> }): string => {
      const d = node.data ?? {};
      if ((d.__filterState as string | undefined) === "dim") {
        return "var(--erd-minimap-dim, rgba(120, 120, 120, 0.45))";
      }
      const rtype = d.resource_type as string | undefined;
      return (rtype && meta[rtype]?.color) || "var(--erd-border, #007acc)";
    },
    [meta],
  );

  const rootStyle = useMemo(() => themeStyle(theme), [theme]);

  // dimOnSelect: while an edge is selected, fade every other edge and animate
  // the selected one (selection emphasis). Applied to the render pass only —
  // the `edges` state (and its selection) is untouched.
  const displayEdges = useMemo<Edge[]>(() => {
    if (!dimOnSelect || !edges.some((e) => e.selected)) return edges;
    return edges.map((e) =>
      e.selected ? { ...e, animated: true } : { ...e, style: { ...e.style, opacity: 0.1 } },
    );
  }, [dimOnSelect, edges]);

  return (
    <div className={`erd-flow${className ? ` ${className}` : ""}`} style={rootStyle}>
      <ReactFlow
        nodes={nodes}
        edges={displayEdges}
        onNodesChange={onNodesChangeWithSync}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={clearActiveNode}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={(instance) => {
          flowRef.current = instance;
        }}
        fitView
        fitViewOptions={fitViewOptions}
        onlyRenderVisibleElements={onlyRenderVisibleElements}
        minZoom={0.05}
        colorMode={colorMode}
        proOptions={{ hideAttribution: true }}
        panOnDrag={interactive}
        zoomOnScroll={interactive}
        zoomOnPinch={interactive}
        zoomOnDoubleClick={interactive}
        nodesDraggable={interactive}
        panOnScroll={false}
      >
        {background ? <Background /> : null}
        {controls ? <Controls /> : null}
        {minimap ? (
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            ariaLabel="Mini-map"
            nodeColor={miniMapNodeColor}
            nodeStrokeColor="var(--erd-border, #007acc)"
            nodeStrokeWidth={2}
            nodeBorderRadius={4}
            maskColor="var(--erd-minimap-mask, rgba(0, 0, 0, 0.4))"
            style={{
              background: "var(--erd-minimap-bg, #1e1e1e)",
              border: "1px solid var(--erd-divider, #3c3c3c)",
              borderRadius: 6,
            }}
          />
        ) : null}
      </ReactFlow>
    </div>
  );
}
