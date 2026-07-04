---
name: erd-payload-contract
description: Use whenever a change touches the shape of ErdPayload — the nodes/edges/columns/metadata the <ErdFlow> component renders (src/types/erd.ts). This is the public API two hosts (dbt-docs, dbterd-vscode) depend on; a field rename ripples outward.
---

# The ErdPayload contract

`ErdPayload` (`src/types/erd.ts`) is the **single data contract** the component
renders. It is public API — re-exported from `src/index.ts` — and consumed by
two hosts that this package cannot see:

- **dbt-docs** maps its `data.erd` onto this shape (a static SPA).
- **dbterd-vscode**'s FastAPI server emits it directly (a webview).

These are dbterd's `json`-target native field names. The package owns the
contract; the hosts conform to it. That's the whole point — one diagram, two
homes.

## The shape

```ts
export interface Column {
  name: string;
  data_type?: string | null;
  description?: string | null;
  is_primary_key?: boolean;
  is_foreign_key?: boolean;
}

export interface ErdNode {
  id: string;                    // dbt unique_id, e.g. "model.jaffle_shop.dim_customers"
  name: string;                  // display name
  label?: string | null;
  description?: string | null;
  resource_type?: string;        // OPEN string, not a dbt enum
  schema_name?: string | null;   // dbterd-native (not `schema`)
  database?: string | null;
  columns: Column[];
  hidden_column_count?: number;  // columns dropped by compact windowing; the
                                 // card renders a passive "+N more columns" row
  compiled_sql?: string | null;
  model_path?: string | null;
}

export interface ErdEdge {
  id: string;                    // stable id from dbterd's json target
  from_id: string;               // FK / child side
  to_id: string;                 // referenced / parent side
  from_column?: string | null;   // primary pair (= from_columns[0])
  to_column?: string | null;
  from_columns?: string[];       // full list (composite FKs)
  to_columns?: string[];
  relationship_type?: string;
  cardinality?: string;
  label?: string | null;
  name?: string | null;          // constraint name
}

export interface ErdMetadata {
  generated_at?: string;
  dbt_project_name?: string;
  [key: string]: unknown;        // open — hosts may attach their own metadata
}

export interface ErdPayload {
  nodes: ErdNode[];
  edges: ErdEdge[];
  metadata?: ErdMetadata;
}
```

## The load-bearing invariants

1. **Edge direction is fixed.** `from_id` is the FK/child side; `to_id` is the
   referenced/parent side. The edge components and every layout adjacency assume
   this. Don't flip it.
2. **`resource_type` is an open string, never an enum.** A non-dbt host defines
   its own taxonomy; the component keys colours/badges off the injected
   `resourceMeta` prop (`src/theme.ts` `DEFAULT_RESOURCE_META`), never a hardcoded
   enum. Narrowing it to a union would break non-dbt hosts.
3. **Optional stays optional.** Partial catalogs omit `data_type`,
   `is_foreign_key`, `schema_name`, etc. Every catalog-derived field is `?` /
   `| null`. Don't make one required.
4. **`from_columns`/`to_columns` drive composite edges.** An edge renders
   `composite` when either side has two-plus columns and both sides have at
   least one (`mapEdge` in `src/layout/index.ts`); the singular
   `from_column`/`to_column` is the primary pair, used when the edge renders
   `single`.
5. **Stable edge ids.** `ErdEdge.id` is a React key — it must be deterministic.

## Rules for a contract change

1. **The type is the source of truth here** — there's no codegen. Edit
   `src/types/erd.ts` and let strict TS flow the change through the consumers
   (`layout/`, `components/`, `payload.ts`).
2. **A rename is a breaking change.** Both hosts read these names. If you must
   rename, treat it as a major-version concern and note it for the release —
   don't silently rename a field a host emits.
3. **New field → optional first.** Add it as `?` so existing host payloads keep
   validating; the component reads it defensively.
4. **Verify both edge kinds.** After any edge-field change, exercise a single
   and a composite FK in the vitest suite.

## Checklist before finishing a contract change

- [ ] `src/types/erd.ts` updated; the new/renamed field is documented in the
      file's header comment if it's non-obvious.
- [ ] `src/index.ts` still re-exports the changed types (public surface intact).
- [ ] `npx tsc --noEmit` passes — strict mode flags every stale consumer.
- [ ] A vitest case exercises the new field end-to-end (node render + edge
      routing), using `test/_support/erd-factories.ts` fixtures.
- [ ] If the field affects layout adjacency or edge anchoring, checked against a
      composite (multi-column) FK, not just a single one.
