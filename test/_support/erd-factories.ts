import type { Column, ErdEdge, ErdNode } from "@/types/erd";

const ID_COLUMN: Column = {
  name: "id",
  data_type: "bigint",
  description: null,
  is_primary_key: true,
  is_foreign_key: false,
};

export interface NodeOptions {
  resource_type?: string;
  schema_name?: string | null;
  database?: string | null;
  compiled_sql?: string | null;
}

export function node(
  id: string,
  name: string = id,
  columns: Column[] = [ID_COLUMN],
  options: NodeOptions = {},
): ErdNode {
  return {
    id,
    name,
    resource_type: options.resource_type ?? "model",
    schema_name: options.schema_name ?? "analytics",
    database: options.database ?? "prod",
    columns,
    compiled_sql: options.compiled_sql ?? null,
  };
}

export interface EdgeOptions {
  id?: string;
  from_column?: string | null;
  to_column?: string | null;
  from_columns?: string[];
  to_columns?: string[];
  relationship_type?: string;
}

export function edge(from: string, to: string, options: EdgeOptions = {}): ErdEdge {
  return {
    id: options.id ?? `${from}->${to}`,
    from_id: from,
    to_id: to,
    from_column: options.from_column ?? "id",
    to_column: options.to_column ?? "id",
    ...(options.from_columns ? { from_columns: options.from_columns } : {}),
    ...(options.to_columns ? { to_columns: options.to_columns } : {}),
    relationship_type: options.relationship_type ?? "fk",
  };
}
