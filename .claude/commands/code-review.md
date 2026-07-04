---
description: Review the pending changes for correctness bugs and pattern drift, then fix the confirmed findings.
argument-hint: "[rounds]   e.g. 3 — review→fix cycles until clean (default 1)"
---

Invoke the **`code-review`** skill — it holds the repo-specific procedure (what
diff to review, the erd-flow-specific review dimensions, how to verify a finding
before trusting it, and the fix-then-gate loop).

Pass `$ARGUMENTS` as the number of review→fix rounds (default 1). Stop early
when a round produces zero confirmed findings.
