---
description: Run the vitest suite (and the strict typecheck) and report pass/fail.
---

Run the gate in parallel (separate Bash calls in one message):

1. `npx tsc --noEmit` — strict typecheck (there is no ESLint in this repo).
2. `npx vitest run` — the vitest suite (jsdom).

Report a short table:

| Check      | Result | Notes                          |
|------------|--------|--------------------------------|
| typecheck  | ...    | first error location if failing |
| vitest     | ...    | failing test names              |

If a test fails, name the file and the assertion. Do not attempt to fix failures
unless the user asks.
