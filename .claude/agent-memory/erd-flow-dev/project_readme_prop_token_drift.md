---
name: project-readme-prop-token-drift
description: README.md Props table and --erd-* token list silently fall behind src/types/props.ts and theme.ts's TOKEN_MAP as props/tokens are added
metadata:
  type: project
---

Round-2 review (2026-07-04) diffed the README against the real source and
found two drifts: the Props table was missing `className` (`ErdFlowProps`
field, wired in `ErdFlow.tsx`'s root `<div>`), and the Theming section's token
list was missing `--erd-minimap-dim` and `--erd-minimap-mask` (both live in
`ErdTheme`, `theme.ts`'s `TOKEN_MAP`, and read in `ErdFlow.tsx`'s `MiniMap`
props). Neither omission broke anything at runtime — they're pure
documentation gaps — but a host author reading the README would not discover
either knob existed.

**Why:** nothing enforces README ↔ `ErdFlowProps`/`TOKEN_MAP` parity
automatically; a prop or token added to the source with no corresponding
README edit just silently under-documents the package. This is the same shape
of gap as [[project-tableconstants-lockstep-gaps]] (a pinned pair drifting)
except the "pin" here is a documentation convention, not a build-time
invariant, so nothing fails loudly.

**How to apply:** whenever a review touches `src/types/props.ts` (new prop) or
`theme.ts`'s `TOKEN_MAP` (new token), diff the full field/token list against
the README's Props table and Theming token list in the same pass — don't just
check that *a* prop's docs exist, enumerate every one. A quick one-liner:
`grep -oE -- '--erd-[a-z-]+' src/theme.ts` vs the same over `README.md`, and
eyeball `ErdFlowProps`'s field list against the Props table rows.
