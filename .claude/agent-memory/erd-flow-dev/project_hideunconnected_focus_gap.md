---
name: project-hideunconnected-focus-gap
description: hideUnconnected could hide the focus node itself when it has no FK edges within its own neighbourhood — fixed in round 4 (2026-07-04)
metadata:
  type: project
---

`ErdFlow.tsx`'s `visibleNodes` memo filtered `baseNodes` down to
`connectedNodeIds` whenever `hideUnconnected` was on, with no exemption for the
node the host is currently focusing (`focus` prop). Focusing an island node
(zero FK edges — a real dbt shape: a lone seed/source with no relationships)
while `hideUnconnected` was also on produced a **completely blank canvas**,
because the one node `focus` was supposed to keep was itself "unconnected" and
got filtered out.

**Why:** confirmed with a throwaway probe test before touching source — a
focus+hideUnconnected combination on an island node rendered zero table nodes.
This is the "focus windowing + hideUnconnected combined" interaction the round
4 task explicitly asked to check, and it was a genuine, previously-untested
gap (`hideUnconnected` had zero test coverage before this round).

**How to apply:** `visibleNodes` now always keeps `n.id === focus` in addition
to `connectedNodeIds.has(n.id)`. If touching this filter again, keep that
carve-out — the focus node must never be a casualty of hideUnconnected.
Regression test: `test/ErdFlow.test.tsx` → "hideUnconnected keeps the focused
node even when it has no edges". See [[feedback-review-process]] for the round
protocol this was found under.
