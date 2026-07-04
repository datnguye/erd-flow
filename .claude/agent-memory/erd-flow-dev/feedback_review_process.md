---
name: feedback-review-process
description: How to run a verify-then-fix review round on this repo (dimensions, refutation discipline, gate)
metadata:
  type: feedback
---

Review rounds follow a strict order: CORRECTNESS > LOWEST COMPLEXITY (fix by
deletion) > DRY > PLUGGABLE > type honesty > tests > OSS hygiene. Every
candidate must be adversarially refuted first — check whether an existing
guard (e.g. `resolvableEdges` in `src/layout/index.ts`, the `MIN_DIST` floor in
`src/layout/force.ts`, the empty-array fallback in `columnPoints` before
`avgY`) already makes the "bug" impossible before reporting it as a finding.

**Why:** the task explicitly rewards confirmed findings with a concrete
failure scenario or a concrete simplification, and penalizes reporting
speculative issues an existing guard already covers (e.g. `avgY` looks
NaN-prone on an empty array, but its only caller `columnPoints` guarantees at
least one point).

**How to apply:** for every candidate, name the exact input/state that would
produce a wrong output, or the exact lines a simplification would delete,
before treating it as confirmed. Fix confirmed findings smallest-first, then
gate with `npx tsc --noEmit && npx vitest run` — both must pass or the fix
gets repaired/reverted. See [[project-tableconstants-lockstep-gaps]] and
[[project-dead-icon-exports]] for concrete findings from round 1
(2026-07-04); [[project-readme-prop-token-drift]] and
[[project-untested-pure-edge-helpers]] for round 2 (2026-07-04) — round 2 also
confirmed the round-1 tableConstants/CSS lockstep and `--erd-*` TOKEN_MAP
completeness both still hold, and re-refuted the same `columnPoints`
empty-array guard pattern showing up again in `resolveAnchor`'s null-column
fallback (same shape: caller (`mapEdge`'s `isComposite` gate) makes the
"empty" branch unreachable in practice).

Round 3 (2026-07-04) confirmed one more instance of
[[project-readme-prop-token-drift]] (`colorMode` prop shipped in `props.ts`
but never added to the README props table — the drift recurs with every new
prop, not just the ones caught in round 2) and refuted several plausible-looking
layout-engine candidates by actually running them: `runRadialLayout`/
`runForceLayout` at 500 nodes (star topology) stayed overlap-free and fast
(radial ~6ms, force ~270ms); `relaxOverlaps`'s 40-sweep cap only leaves residual
overlaps under a synthetic complete graph (every node wired to every other,
not a realistic dbt DAG) — a 50-node/~10-edges-per-node "realistic dense
schema" stayed overlap-free. Also refuted: `collapse` param on
`runDagreLayout`/`runRadialLayout`/`runForceLayout` looking dead in the
`registerLayout` wrappers (they hardcode `true` because `sizes` is always
supplied there) — it's not dead, it's the default entry point every engine
test exercises directly (2-arg calls), so the internal function legitimately
serves two callers with different needs. See
[[project-layout-engine-scale-verified]] for the measured numbers if a future
round wants to re-check at a different scale.

Round 4 (2026-07-04) went deep on the interaction layer (`ErdFlow.tsx`,
`ErdTableNode.tsx`) per the task's explicit focus. One confirmed correctness
bug with a reproduced failing-then-passing probe test: see
[[project-hideunconnected-focus-gap]] (`hideUnconnected` could hide the focus
node itself). One confirmed token-hygiene gap: see
[[project-shadow-token-gap]] (three hardcoded `rgba(0,0,0,...)` box-shadows,
now `var(--erd-shadow, ...)`). One confirmed a11y gap fixed cheaply: the
`.erd-table-header` (click-to-activate) had no keyboard path at all — added
`role="button"`, `tabIndex`, an Enter/Space `onKeyDown` that calls
`.click()` so it flows through the existing `onNodeClick` → `closest(...)`
gate unchanged, plus a `:focus-visible` outline (`var(--erd-border, ...)`, no
new token needed). Refuted after real investigation, not just pattern-match:
`interactive=false` intentionally only gates pan/zoom/drag (README + prop
docstring say so explicitly, and e2e already asserts click-to-activate still
works while zoom is locked) — don't re-flag this as "interactive doesn't
block all paths," that's the documented contract, not a bug. Also refuted:
`ErdTableNode`'s `React.memo` going stale on a mutated `columns` array —
every producer (`windowPayload`/`compactColumns`/`toFlowGraph`) always
constructs fresh objects, so staleness would require the *host* to mutate its
own `data` prop in place, which violates the already-documented
data-as-prop/immutable-input contract; not a library bug. Also
re-confirmed (no drift) the `__field` stamp/read contract between
`ErdFlow.tsx`'s `renderNodes`, `layout/index.ts`'s `toFlowGraph` (which
stamps `__collapse` — a legitimate second stamping site, not a violation,
since it's laid down before the decoration pass even runs), and every read
site in `ErdTableNode.tsx` / `edge-anchor.ts`.

Round 5 (2026-07-04, final) adversarially re-audited every round 1-4 fix by
hand-computing/reading library internals rather than re-trusting prior
verdicts. All held except one: see [[project-nokey-header-keydown-leak]] —
round 4's keyboard-a11y `onKeyDown` on `.erd-table-header` was itself correct
(no double-fire, `preventDefault` handled) but the element wasn't excluded
from `@xyflow/react`'s own global `panActivationKeyCode`/`deleteKeyCode`
listeners, found by reading `@xyflow/system`'s `isInputDOMNode` directly in
`node_modules` — fixed with the `nokey` class. Hand-verified
`estimateHeight`'s arithmetic against `ErdTableNode.css` line-by-line (sums
match exactly, including the border-box-folded 1px borders on
`.erd-table-more`/`.erd-table-expand`). Confirmed no dangling icon references
anywhere (demo/e2e/README) after the round-1 `icons.tsx` trim, README
prop/token tables fully match `props.ts`/`theme.ts` (all 30 props, all 19
`--erd-*` tokens), the four new pure-helper test files
(`edge-anchor.test.ts`, `composite-edge-geometry.test.ts`,
`column-highlight.test.ts`) follow the established local-fixture convention
(different xyflow-shaped fixtures than `test/_support`'s `ErdNode`/`ErdEdge`
factories legitimately don't reuse them), and the `hideUnconnected`+`focus`
fix is correct across the focus-absent, focus-has-edges, and
windowPayload-interaction cases (a windowed neighbour can never end up
falsely "disconnected" except the focus node itself, since BFS guarantees
every kept neighbour's qualifying edge also survives the edge filter).
