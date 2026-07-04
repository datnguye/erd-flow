---
name: project-untested-pure-edge-helpers
description: edge-anchor.ts, composite-edge/geometry.ts, and column-highlight.ts had zero test coverage despite being pure and xyflow-independent
metadata:
  type: project
---

Round-2 review (2026-07-04) found `src/components/edge-anchor.ts` (the shared
FK-edge anchor math — `anchorNodeOf`, `resolveAnchor`, `endpointSides`,
`fkStrokeStyle`), `src/components/composite-edge/geometry.ts` (`avgY`,
`bundlePoint`, `bundlePath`, `tailPath`), and `src/components/column-highlight.ts`
(`columnsForSelectedEdges`) had no dedicated test file. `ErdFlow.test.tsx` and
`ErdTableNode.test.tsx` both mock `@xyflow/react` entirely via
`reactFlowMock()`, so `SingleEdge`/`CompositeEdge` (which call these helpers)
never actually execute inside the suite either — this was a real coverage
gap, not just a missing-test-for-a-trivial-function nit. `geometry.ts`'s own
header comment already states the intent ("kept separate ... so it can be
unit-tested against fixed Point inputs without pulling xyflow into the test
environment") — the separation existed but the tests never got written.

Added `test/edge-anchor.test.ts`, `test/composite-edge-geometry.test.ts`, and
`test/column-highlight.test.ts` — all construct plain-object fixtures (no
xyflow mock needed, since every tested export takes plain data, never calls a
hook itself) and assert concrete pixel/set values, including the collapse-fold
boundary (`resolveAnchor` folding a hidden column onto the last visible row)
and the same-x tie-break in `endpointSides`.

**Why:** these three files are the actual FK-edge rendering math this
repo exists to get right (see the "Self-drawing composite / single FK edges"
design pattern) — a regression here silently mis-anchors every edge, and
nothing in the existing suite would catch it since the edge *components*
aren't exercised (xyflow is mocked).

**How to apply:** when reviewing test coverage, don't stop at "is there a test
file for this feature" — check whether the feature's own component test mocks
away the very library the component under test calls into. If
`@xyflow/react` is mocked, any code that only runs through a real
`useInternalNode`/`BaseEdge` call is untested no matter how green the suite
looks. Prefer testing the pure, hook-free exports directly (as these three
files already export) rather than trying to un-mock xyflow.
