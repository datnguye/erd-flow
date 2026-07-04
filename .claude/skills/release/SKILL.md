---
name: release
description: Use when cutting a release of @datnguye/erd-flow to the npm registry. Covers pre-flight, version selection, the tag-driven CI publish (the GitHub Release's X.Y.Z tag stamps the npm version), release notes, and post-publish verification.
---

# Releasing @datnguye/erd-flow

Releases publish the built `dist/` to the npm registry. The publish is
**GitHub-Release-driven and tag-versioned**: `.github/workflows/release.yml`
triggers on `release: published`, stamps `package.json`'s version **from the
release tag** (a plain `X.Y.Z` tag, no `v` prefix, applied via `npm version
--no-git-tag-version`),
re-runs the gate (typecheck + vitest + build), and runs `npm publish --access
public --provenance` with `NODE_AUTH_TOKEN` from the `NPM_TOKEN` secret (in
the `npm-publish` environment). The **tag is the single source of truth for
the version** — the in-repo `package.json` deliberately carries the
`0.0.0-dev` placeholder and is never published as-is. Locally you gate and
create the GitHub Release; **you never
run `npm publish` yourself** unless the workflow is broken and the user
explicitly asks for a manual publish.

Release notes live in the GitHub Release body — we do **not** maintain a
`CHANGELOG.md`.

## Cardinal rules

- **Never release an unbuilt or untested tree.** A broken package on npm is
  public and painful to unship. The gate (`build` + `tsc` + `vitest`) runs
  locally before tagging, and the workflow re-runs it before publishing — a red
  local gate never gets tagged, no exceptions.
- **`@datnguye/erd-flow` is a scoped package** → the publish needs
  `--access public` (npm defaults scoped packages to restricted). The workflow
  passes it; any manual fallback publish must too.
- **Never `npm unpublish`** a version casually, and never force-move or delete a
  published git tag. Prefer cutting a new patch over rewriting public refs.
- **The tag is the version.** Never hand-edit `package.json`'s `version` as
  part of a release — the workflow stamps it from the release tag. A tag that
  isn't `X.Y.Z` (or `X.Y.Z-pre`) is rejected by the workflow.

## Pre-flight (in order, stop on the first failure)

1. `git status` — must be clean.
2. On `main` (unless the user says otherwise).
3. `git pull --ff-only` — don't tag a stale commit.
4. `npm run build && npx tsc --noEmit && npx vitest run` — **all green**. If any
   fails, stop; a release never ships a red gate.
5. `gh workflow list` — confirm the `Release npm` workflow exists on the
   default branch (the publish depends on it, and on the `NPM_TOKEN` secret in
   the `npm-publish` environment).
6. `npm view @datnguye/erd-flow version` — record the currently-published
   version (may be "not found" for the very first release). The new version must
   be greater.
7. `git describe --tags --abbrev=0` — the latest tag, for the bump math (the
   in-repo `package.json` version is a `0.0.0-dev` placeholder; the tag
   governs).

## Choosing the version

- Read the user's argument (`patch` / `minor` / `major`, or an explicit
  `1.2.3` / `1.2.3-rc.1`).
- Pre-1.0 (currently `0.x`), a breaking change is a `minor` bump, not `major`.
- **Always confirm the exact version string with the user before publishing.**
  Show them: published version → proposed new version.

## Building release notes

Generate from the diff vs the previous tag — do NOT use
`--generate-notes` (a wall of commit subjects).

1. `git fetch --tags`.
2. `git log <prev-tag>..HEAD --pretty=format:"%h|%s" --no-merges` — commit list.
3. `git diff <prev-tag>..HEAD --stat` — gauge scope (component / layout / edges /
   types / build / docs).
4. Group by Conventional-Commit prefix; omit empty sections:
   - **Highlights** — 2–4 plain-language, user-visible wins (what a maintainer
     would post in Slack).
   - **Features** (`feat:`), **Fixes** (`fix:`), **Refactors** (`refactor:`),
     **Tests**, **Docs**.
5. Each entry explains user-visible impact, not the raw commit subject; append
   the short SHA.
6. End with `**Full Changelog**:
   https://github.com/datnguye/erd-flow/compare/<prev-tag>...X.Y.Z`.
7. Write the notes to `/tmp/X.Y.Z-notes.md`.

## Cutting the release

Show the user the proposed notes and the exact version, and **ask once more**
before releasing.

```bash
# 1. Create the GitHub Release — gh creates the X.Y.Z tag on main and this
#    is the publish trigger; the workflow stamps the npm version from the tag.
gh release create X.Y.Z --target main --notes-file /tmp/X.Y.Z-notes.md --title "X.Y.Z"
#   For a pre-release: add --prerelease — the workflow publishes it under the
#   npm `next` dist-tag instead of `latest`.

# 2. Watch the publish workflow to completion.
gh run watch $(gh run list --workflow=release.yml --limit 1 --json databaseId -q '.[0].databaseId')
```

No local version bump, commit, or tag push is needed — `gh release create`
mints the tag, and the workflow derives the published version from it. The
workflow rebuilds `dist/` itself and rejects a tag that isn't semver.

## Post-publish verification

1. `npm view @datnguye/erd-flow version` — shows the new version.
2. `npm view @datnguye/erd-flow dist.tarball` then inspect that the tarball
   contains `dist/index.js`, `dist/index.d.ts`, and `dist/erd-flow.css` — the
   three artefacts a host needs. A missing `.css` or `.d.ts` is a broken publish.
3. Print the GitHub Release URL for the user.
4. Optionally, in a scratch dir: `npm install @datnguye/erd-flow@X.Y.Z` and
   confirm `import { ErdFlow } from "@datnguye/erd-flow"` type-resolves.

## Recovering from a failed publish

- **Gate failed** — fix on `main`, re-run the gate, then release. Nothing was
  published.
- **The publish workflow failed after the Release was created** — the tag and
  Release exist but nothing is on npm. Read the run log (`gh run view
  --log-failed`), fix the cause (usually the `NPM_TOKEN` secret or a
  non-semver tag rejected by the guard), and re-run the workflow
  (`gh run rerun`). If the version is unrecoverable, cut the next patch rather
  than deleting the tag.
- Document the failure in agent memory so the next release avoids the trap.

## Never

- Publish without explicit user confirmation of the version.
- Publish a red gate (build/typecheck/tests failing).
- Touch `package.json`'s `version` — it stays at the `0.0.0-dev` placeholder;
  the release tag is the version.
- `npm unpublish` or force-move a published tag casually.
- Use `--generate-notes` — supply notes via `--notes-file`.
- Maintain or commit a `CHANGELOG.md`.
