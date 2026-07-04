---
name: pr
description: Use when opening a pull request for erd-flow — pushes the current branch and creates a GitHub PR whose body follows .github/PULL_REQUEST_TEMPLATE.md (filled from the actual diff, with the right Type/Area boxes ticked and the checklist verified, not blindly checked). Mirrors the code-review skill's structure.
---

# Opening an erd-flow pull request

This skill turns the current branch into a well-formed PR for **this** repo
(`datnguye/erd-flow`). It does not invent scope — it reads the diff, fills the
committed `.github/PULL_REQUEST_TEMPLATE.md`, and **verifies** each checklist item
against reality rather than ticking it blind. The template is the contract; this
skill is how you fill it honestly.

## When to use

The user wants to raise a PR (`/pr`, "open a PR", "PR this branch"). Not for
cutting a release (that's the `release` skill / `/release`) and not for
reviewing a change (that's `code-review` / `/code-review`).

## Pre-flight (gather, don't guess)

```bash
git rev-parse --abbrev-ref HEAD                 # current branch
git fetch origin && git log --oneline origin/main..HEAD   # the commits in this PR
git diff origin/main...HEAD --stat              # the net diff vs the base
git status --short                              # uncommitted / untracked leftovers
gh repo view --json defaultBranchRef -q .defaultBranchRef.name   # the base branch
```

### Create the feature branch (when needed)

A PR can't come off the default branch — so **move the work onto a feature branch
first**. Branch when the current branch *is* the base (`main`) **or** is already
the remote default; otherwise the current feature branch is reused as-is.

Derive the branch name from the work, matching the PR title conventions
(`feat:`/`fix:`/`refactor:`/`docs:`):

- **Type** = the change type inferred from the diff + commits (`feat`, `fix`,
  `refactor`, `docs`, `chore`).
- **Slug** = a short kebab-case summary of the change (from the issue title the
  user named, else the dominant theme of the diff). Keep it terse:
  `feat/composite-edge-fan`, `fix/radial-island-overlap`, `docs/theming-tokens`.

```bash
# Only when HEAD is main (or the repo default): carry the working tree onto a new branch.
git switch -c <type>/<slug>     # uncommitted work follows the switch; nothing is lost
```

Confirm the derived name with the user before creating it (a branch name is
sticky), then create it and continue. If the user supplied a name in
`$ARGUMENTS`, use that verbatim instead of deriving one.

Other hard stops — surface and ask, don't paper over:

- **Uncommitted changes.** If `git status` is dirty (after any branch switch),
  ask whether to commit them into this PR (and on what message) before pushing —
  never silently leave work out of the diff the reviewer sees.
  - **One-line commit message, no attribution.** The commit message is **exactly
    one line**: `<type>: <concise description>`
    (`feat:`/`fix:`/`refactor:`/`docs:`/`chore:`), matching the PR title
    convention. Nothing below the subject — no body, no bullet list, and **no
    author/co-author attribution trailer of any kind**. All the detail lives in
    the *PR body*, not the commit. Squash multiple WIP commits into this single
    line before opening the PR (`git commit --amend` / interactive squash).
    Commit with a single `-m "<type>: <desc>"` and no `-m` trailer.
- **No diff vs base.** If `origin/main...HEAD` is empty once you're on the feature
  branch, there's nothing to PR.

## Validate before opening (the review gate)

A PR that fails the repo's own gates wastes a review cycle. Run them and **report
the result in the PR body's checklist** (tick only what actually passed):

```bash
npx tsc --noEmit          # strict typecheck (there is no lint step in this repo)
npx vitest run            # the vitest suite (jsdom)
npm run build             # when the change affects the build — then verify
                          # dist/index.js + dist/index.d.ts + dist/erd-flow.css
```

If the change touches card geometry, confirm `tableConstants.ts` and
`ErdTableNode.css` moved in lockstep in this diff; if it touches the payload
shape, confirm the `erd-payload-contract` skill was consulted. If the gates
fail, **stop** and report — offer to fix (or to open the PR as a **draft** with
the failures called out), but don't tick a box that's red.

For a substantive change, consider running the **code-review** skill first and
folding its verdict into the PR body — but that's an offer, not a requirement.

## Compose the PR body from the template

Read `.github/PULL_REQUEST_TEMPLATE.md` and fill it from the **actual diff**:

- **What & why** — one tight paragraph: what changed and the problem it solves.
  Link the issue (`Closes #N`) when the user names one; otherwise drop the
  `Closes #` line rather than leaving a dangling `#`.
- **Type of change** — tick the *one* box the diff supports (bug / feature /
  breaking / refactor / docs). A change to the public API surface
  (`src/index.ts` exports), the `ErdPayload` shape, or the `--erd-*` token set
  is **breaking** — say so explicitly.
- **Area** — tick every touched area, mapped from the changed paths
  (`src/ErdFlow.tsx` → Component, `src/components/` → Nodes/edges,
  `src/layout/` → Layout, `src/types/erd.ts`/`src/payload.ts` → Payload
  contract, `src/theme.ts`/CSS → Theming, `vite.config.ts`/`package.json` →
  Build, `test/` → Tests, `README.md`/`.claude/` → Docs,
  `.github/workflows/` → CI).
- **How to test** — the real commands a reviewer runs to see it working (the
  `task` target or the `npm run dev` interaction specific to this change), not
  the template placeholder.
- **Checklist** — tick each item only after verifying it (the typecheck result,
  the vitest result, the dist artefacts when build-affecting, the lockstep, the
  token rule, the peer-dep rule, README props/tokens sync, design_patterns.md
  updated on a pattern change). Leave unchecked anything that genuinely doesn't
  apply and add a short "n/a — <why>" so the reviewer isn't left guessing.
- **Screenshots / notes** — a before/after from `npm run dev` for visual
  node/edge/layout changes; carry over anything the user told you.

## Create the PR

Push the branch and open the PR with the composed body via a heredoc (so the
markdown survives intact). Default to a normal PR; use `--draft` when the gates
are red or the user asks. **No attribution footer in the PR description** — never
append a generated-by / author credit (and don't reintroduce one when editing an
existing PR's body).

```bash
git push -u origin HEAD
gh pr create \
  --base "$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)" \
  --title "<type>: <concise summary>" \
  --body "$(cat <<'EOF'
<the filled-in template body>
EOF
)"
```

Title convention: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:` + a concise
summary. Creating a PR is outward-facing — if anything is ambiguous (base
branch, draft vs ready, which commits belong), confirm before pushing. After
it's created, report the PR URL `gh` prints back. Opening the PR triggers
`.github/workflows/pr-ci.yml` (typecheck + vitest + build + e2e) — mention that
the reviewer should expect those checks.

## Output

End with the PR URL and a one-line summary of what was opened (title, base, draft
or ready, and the gate results you folded into the checklist). If you opened a
draft because gates were red, say so plainly and list what needs fixing.
