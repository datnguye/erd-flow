// The ERD data contract @datnguye/erd-flow renders. These are the dbterd
// `json`-target native field names: an edge carries `from_id` (the FK/child
// side) and `to_id` (the referenced/parent side); a node carries `schema_name`
// and columns carry `data_type`. A host supplies a payload of this shape —
// dbt-docs maps its `data.erd` here, dbterd-vscode's server emits it directly.
//
// `resource_type` is an open string so a host defines its own resource taxonomy
// (see `ResourceMeta`); the component keys colours/badges/labels off it via the
// injected `resourceMeta` prop, never a hardcoded enum.

export interface Column {
  name: string;
  data_type?: string | null;
  description?: string | null;
  is_primary_key?: boolean;
  is_foreign_key?: boolean;
}

export interface ErdNode {
  id: string;
  name: string;
  label?: string | null;
  description?: string | null;
  resource_type?: string;
  schema_name?: string | null;
  database?: string | null;
  columns: Column[];
  // Columns dropped by compact windowing (windowPayload). When set, the card
  // renders a passive "+N more columns" row and the height estimate reserves
  // one row for it.
  hidden_column_count?: number;
  compiled_sql?: string | null;
  model_path?: string | null;
}

export interface ErdEdge {
  id: string;
  from_id: string;
  to_id: string;
  from_column?: string | null;
  to_column?: string | null;
  from_columns?: string[];
  to_columns?: string[];
  relationship_type?: string;
  cardinality?: string;
  label?: string | null;
  name?: string | null;
}

export interface ErdMetadata {
  generated_at?: string;
  dbt_project_name?: string;
  [key: string]: unknown;
}

export interface ErdPayload {
  nodes: ErdNode[];
  edges: ErdEdge[];
  metadata?: ErdMetadata;
}
