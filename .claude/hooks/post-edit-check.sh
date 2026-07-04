#!/usr/bin/env bash
# Runs after Edit/Write. Fast sanity check on the edited file — never blocks.
# Reads the hook payload from stdin, extracts the path, runs the type gate.
#
# erd-flow is a single TypeScript package (no Python, no workspaces, no ESLint).
# The only check is a whole-project `tsc --noEmit`, filtered to lines that
# mention the edited file so the output stays scoped to what just changed.
# tsc prints paths relative to the project root, so the absolute hook path is
# stripped to a relative one before filtering; the trailing "(" anchors the
# match to tsc's `file(line,col)` format so `a.ts` never matches `a.tsx`.

set -euo pipefail

payload="$(cat)"
path="$(printf '%s' "$payload" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("file_path",""))' 2>/dev/null || true)"

[ -z "$path" ] && exit 0
[ ! -f "$path" ] && exit 0

rel="${path#"${CLAUDE_PROJECT_DIR:-$PWD}"/}"

case "$path" in
  */src/*.ts|*/src/*.tsx|*/test/*.ts|*/test/*.tsx)
    (npx --no-install tsc --noEmit 2>&1 | grep -F "$rel(" | head -20) || true
    ;;
esac

exit 0
