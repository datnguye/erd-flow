---
description: Cut an npm release — build, gate, bump, publish to the registry, tag, and write release notes.
argument-hint: "<bump>   e.g. patch | minor | major | 1.2.3 | 1.2.3-rc.1"
---

Invoke the **`release`** skill — it holds the full procedure (pre-flight, the
local gate, version selection, the tag-driven CI publish — the GitHub Release's
`X.Y.Z` tag stamps the npm version — release-notes generation, and
post-publish verification).

Pass `$ARGUMENTS` as the desired bump.

For the full guarded flow with memory of prior releases, use the
`release-manager` agent instead — it carries local memory of previous releases
and follows the same skill.
