---
name: project-dead-icon-exports
description: icons.tsx originally exported ~12 unused Lucide icons; trimmed to the 2 actually rendered (round 1 review, 2026-07-04)
metadata:
  type: project
---

`src/components/icons.tsx` originally hand-rolled a dozen inline Lucide icons
(RefreshIcon, ServerCogIcon, UnlinkIcon, HierarchyIcon, StarIcon, OrganicIcon,
UnfoldVerticalIcon, FoldVerticalIcon, SearchIcon, CloseIcon, FileCodeIcon,
FileIcon) alongside the two `ErdTableNode.tsx` actually renders
(`DatabaseIcon`, `TableIcon`). None of the other ten were imported anywhere in
`src/`, `test/`, or `demo/`, and none are re-exported from `src/index.ts` (the
only public barrel), so no host could reach them either — they read like
leftover scaffolding for a toolbar (layout-style icons, expand/collapse,
search/close chrome) that doesn't exist in this component. Deleted in round 1;
kept only `DatabaseIcon`/`TableIcon`.

**Why:** `ErdFlow` renders no toolbar of its own (data-as-prop, callbacks-out —
see the design_patterns.md "Severed host seams" entry); a host builds its own
chrome. Icons for layout-switcher buttons, search boxes, etc. belong in the
*host* (dbt-docs / dbterd-vscode), not this package, unless a component here
actually renders them.

**How to apply:** before adding a new icon to `icons.tsx`, confirm some
component in `src/` actually renders it in the same change. If a future round
finds another unused export anywhere in `src/`, treat it the same way — grep
for real usage (including `demo/`) before assuming it's public-API surface
worth keeping.
