---
name: project-layout-engine-scale-verified
description: Measured perf/overlap numbers for the radial and force layout engines at scale, so a future review doesn't re-derive them from scratch
metadata:
  type: project
---

Round 3 (2026-07-04) measured `runRadialLayout`/`runForceLayout`
(`src/layout/radial.ts`, `src/layout/force.ts`) against synthetic payloads to
check the "O(n²) hot spot" and "40-sweep `relaxOverlaps` cap" concerns raised
by [[feedback-review-process]]'s dimension list. Numbers (single run, jsdom
vitest env, M-series laptop — treat as order-of-magnitude, not a perf budget):

- 500-node single-hub star: radial ~6ms, force ~270ms, zero overlaps in both.
- 50 nodes with ~10 random edges each (492 edges total, a plausible dense dbt
  DAG): both engines zero overlaps.
- 100-node **complete graph** (every node wired to every other, ~4950 edges —
  not a realistic ERD shape): force layout left 15 residual overlapping pairs
  after the 40-sweep `relaxOverlaps` cap. This is the one input where the cap
  is provably insufficient, but it requires a topology no real dbt schema
  produces (a table FK'd to literally every other table).

**Why:** these numbers refute "O(n²) hurts at 500 nodes" and "40 sweeps might
leave visible overlaps" as generic claims — they only hold under a pathological
complete-graph input. Recorded so a future round doesn't have to re-run the
same synthetic benchmarks to refute the same candidate finding.

**How to apply:** if a future round re-raises overlap or perf concerns on
`runRadialLayout`/`runForceLayout`/`relaxOverlaps`, check first whether the
failing case is a realistic dbt FK topology (sparse, tree-like with some
shared-dimension fan-in) before treating it as confirmed — only a complete-graph
or near-complete-graph input has been shown to break the overlap guarantee.
