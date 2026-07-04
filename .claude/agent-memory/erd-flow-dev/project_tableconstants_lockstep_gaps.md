---
name: project-tableconstants-lockstep-gaps
description: estimateHeight in dimensions.ts had drifted from the CSS/tableConstants lockstep it must sum every height-contributing constant
metadata:
  type: project
---

Round-1 review (2026-07-04) of the initial uncommitted tree found
`estimateHeight` (`src/layout/dimensions.ts`) summed `COLUMNS_BOTTOM_PADDING`
but not `COLUMNS_TOP_PADDING`, even though `.erd-table-columns` in
`ErdTableNode.css` applies `padding: 4px 0` (both top and bottom contribute to
the real rendered height) and the CSS comment names both constants
explicitly. Both were 4px at review time, so the undercount was small (4px)
but real, and would grow if the two constants ever diverge. Fixed by adding
`COLUMNS_TOP_PADDING` to the `estimateHeight` sum.

**Why:** this is exactly the invariant CLAUDE.md calls out — "dimensions.ts's
estimateHeight sums the same constants ... every constant that contributes to
the rendered height must also appear there or dagre/radial/force underestimate
the card and layouts overlap." A drift here doesn't fail loudly; it just makes
layouts very slightly cramped, so it's easy to introduce and easy to miss.

**How to apply:** whenever `tableConstants.ts` or `ErdTableNode.css`'s pinned
`height`/`padding`/`border` rules change, cross-check `estimateHeight` sums
every one of them (`HEADER_HEIGHT`, `COLUMN_HEIGHT`, `COLUMNS_TOP_PADDING`,
`COLUMNS_BOTTOM_PADDING`, `CARD_BORDER_WIDTH` ×2, `COLLAPSE_TOGGLE_HEIGHT`) —
grep `estimateHeight` and diff its arithmetic against the CSS's `height`/
`padding` list, don't just check the constant was updated somewhere.
