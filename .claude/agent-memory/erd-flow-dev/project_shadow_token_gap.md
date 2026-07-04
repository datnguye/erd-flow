---
name: project-shadow-token-gap
description: three box-shadow rgba(0,0,0,...) ambient ombres in ErdTableNode.css were hardcoded, not var(--erd-*, #hex) — added --erd-shadow in round 4 (2026-07-04)
metadata:
  type: project
---

`ErdTableNode.css` had three `box-shadow` rules using bare
`rgba(0, 0, 0, 0.25|0.35|0.4)` — the base card shadow, the filter-match glow,
and the active-node glow — none wrapped in a `var(--erd-*, ...)` token, in
violation of the stated "every colour is a `--erd-*` token with a hex
fallback" invariant. Confirmed live because `colorMode` (an `ErdFlow` prop)
supports `"light"`, and a host opting into light mode had no way to lighten
these three ambient blacks.

**Why:** `--erd-minimap-mask` was already precedent for tokenizing an
rgba-alpha "colour" (not just solid hex), so these three were a real, not
speculative, gap against the same standard, once `colorMode="light"` made the
inconsistency host-visible.

**How to apply:** added one shared `--erd-shadow` token (all three shadows are
the same semantic "ambient shadow black," so one token, not three) to
`ErdTheme` (`src/types/props.ts`), `TOKEN_MAP` (`src/theme.ts`), and the
README token list. If a future round adds another shadow/glow, reuse
`--erd-shadow` unless the semantics genuinely diverge (e.g. a colored glow
would still want its own token, like `--erd-accent` already covers the
filter-match ring colour separately from its shadow blur).
