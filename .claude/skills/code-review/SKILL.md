---
name: code-review
description: Use when reviewing pending changes (or the whole of src/ and test/) in erd-flow — the repo-specific review dimensions, how to verify a finding before trusting it, and the fix-then-gate loop. Findings are fixed, not just reported, unless the user asks for report-only.
---

# Reviewing erd-flow changes

A review here is a **verify-then-fix loop**, not a comment dump. Each round:
find candidate issues → adversarially verify each one against the actual code →
fix the confirmed ones → run the gate. Repeat for the requested number of
rounds, stopping early when a round confirms nothing.

## Scope

- Uncommitted work exists → review `git diff HEAD` (staged + unstaged) plus
  untracked files.
- Clean tree on a feature branch → review `git diff main...HEAD`.
- Clean tree on `main` (or the user asks for a full pass) → review all of
  `src/` and `test/`.

## Review dimensions

Generic first — a review that only checks house style misses real bugs:

1. **Correctness** — logic errors, off-by-one, wrong operator, unhandled
   `null`/`undefined`/empty-array, stale React closures, missing effect deps,
   NaN/divide-by-zero in layout math.
2. **Lowest complexity — simple is best.** Prefer the least clever version
   that works: a needless abstraction layer, an indirection with one caller, a
   config option nobody sets, dead code, a hand-rolled version of something a
   stdlib/array method does, deep nesting where an early return reads flat.
   The fix for over-engineering is deletion, not documentation.
3. **DRY** — the same logic, constant, or fixture hand-copied in two places
   (source or tests). Extract to the existing shared home: `graph.ts` for
   layout primitives, `edge-anchor.ts` for anchor math, `tableConstants.ts`
   for geometry, `test/_support/` for fixtures. But don't force it: two things
   that merely look alike today and will evolve apart are not a DRY violation.
4. **Pluggable over hardcoded** — variation points go through the existing
   registries and injection seams (`registerLayout`/`resolveLayout`,
   `nodeTypes`/`edgeTypes`, `resourceMeta`, `--erd-*` tokens), never through
   `if`-chains on a specific value or a host-specific special case baked into
   a component.
5. **Type honesty** — `as` casts hiding real mismatches, `any` leaking into
   public types, non-null assertions on genuinely optional payload fields.
6. **Tests** — does the changed behavior have a test? Do tests use
   `test/_support/` factories instead of hand-built payloads?
7. **OSS package hygiene** — the things a stranger installing
   `@datnguye/erd-flow` hits: accidental public API (an export from
   `src/index.ts` that should be internal — every export is a semver
   liability), a breaking change disguised as a patch, runtime deps that
   should be peers, Node/browser-only globals leaking into library code,
   `console.log` left in, README examples that no longer match the real
   props, and anything published that isn't `dist/`.

Then the erd-flow-specific dimensions (each is a documented load-bearing
pattern — see `.claude/design_patterns.md` for the full statements):

8. **ErdPayload contract** — dbterd-native field names only; `resource_type`
   stays an open `string`; catalog-optional fields stay optional. Any shape
   change without the `erd-payload-contract` skill having been consulted is a
   finding.
9. **tableConstants ↔ CSS lockstep** — a geometry change in
   `src/components/tableConstants.ts` must have the matching
   `ErdTableNode.css` change in the same diff, and vice versa; and
   `src/layout/dimensions.ts`'s `estimateHeight` must still sum every constant
   that contributes to rendered height.
10. **Severed host seams** — no hardcoded colours (every colour is a
    `var(--erd-*, #hex)`), no fetch/storage/navigation inside the component,
    no host-specific globals; new interactive props follow the
    controlled-or-uncontrolled shape (`X` ?? `defaultX` ?? constant,
    `onXChange` only if the component itself emits).
11. **Edge anchoring** — no static `sourceHandle`/`targetHandle` on FK edges;
    anchor changes go through the shared `edge-anchor.ts` helpers so `single`
    and `composite` stay in lockstep.
12. **Layout registry** — a new built-in layout is an engine module + a
    `LAYOUT_STYLES` entry + a `registerLayout` call, never a fork of
    `toFlowGraph`; engines compose `graph.ts` primitives instead of copying
    them, and they place pre-sized nodes (never re-measure).
13. **Build hygiene** — peer deps never appear in `dependencies`; a new
    external goes in both `rollupOptions.external` and `peerDependencies`.
14. **Comment policy** — no new inline `//` comments; no history-relative
    comments ("used to", "no longer"). Rationale belongs in
    `.claude/design_patterns.md` or a docstring.

## Verify before you fix

For each candidate finding, read the surrounding code and try to **refute** it
(the guard may live one call up — e.g. `resolvableEdges` already filters
dangling endpoints before any engine runs). Drop anything you cannot state as a
concrete failure scenario: inputs/state → wrong output. Style opinions that no
convention above backs are not findings.

## Fix and gate

- Fix confirmed findings smallest-first; extend the established pattern rather
  than inventing a parallel one.
- Payload-shape fixes: read the `erd-payload-contract` skill first.
  Node/edge-internals fixes: read the `reactflow-nodes` skill first.
- After each round's fixes: `npx tsc --noEmit && npx vitest run` — both must
  pass before the next round starts. A fix that breaks the gate is reverted or
  repaired in the same round, never carried forward.
- A pattern added or removed along the way updates
  `.claude/design_patterns.md` in the same change.

## Reporting

After the final round, report per round: findings confirmed (file:line, one
sentence, its failure scenario), findings refuted (and why), fixes applied, and
gate result. If rounds were cut short because a round came back clean, say so.
