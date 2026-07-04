---
name: project-nokey-header-keydown-leak
description: The keyboard-a11y Enter/Space handler on .erd-table-header leaked into React Flow's global panActivationKeyCode listener; fixed round 5 with the nokey class
metadata:
  type: project
---

Round 4 added `role="button"`/`tabIndex`/an Enter-Space `onKeyDown` (`activateOnKey`)
to `.erd-table-header` so header activation has a keyboard path. Round 5 found
this leaked into React Flow's own global keyboard handling: `useKeyPress`
(`@xyflow/react`) binds `panActivationKeyCode` (default `"Space"`) at
`window` level and only skips a keydown when `isInputDOMNode(event)` is true —
which checks for `INPUT`/`SELECT`/`TEXTAREA`/`contenteditable`/an ancestor with
the `.nokey` class (see `@xyflow/system`'s `isInputDOMNode`). A plain
`<header role="button">` matches none of those, so pressing Space while the
header is focused both (a) triggered our own `.click()` → activation (wanted)
and (b) flipped React Flow's internal `panActivationKeyPressed` state
(unwanted — a stray pan-cursor/grab-mode side effect on the canvas).

**Why:** `isInputDOMNode` is the *only* gate xyflow's global key listeners
check; ARIA role/tabIndex alone don't opt an element out of xyflow's keyboard
handling — only real form elements or the `.nokey` escape-hatch class do.

**How to apply:** any custom interactive element inside `<ErdFlow>` that
attaches its own `onKeyDown` for Enter/Space/Delete-like keys must also carry
the `nokey` class (`className="... nokey"`) so it doesn't double-fire against
React Flow's own global `panActivationKeyCode`/`deleteKeyCode` listeners. This
generalizes to any *future* keyboard-interactive custom node/edge chrome, not
just `.erd-table-header`. See [[feedback-review-process]] for how this was
found — by reading `@xyflow/system`'s `isInputDOMNode` source directly via
context7/node_modules rather than assuming ARIA attributes were sufficient.
