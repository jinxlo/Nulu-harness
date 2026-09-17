#!/usr/bin/env bash
# Sync DeepSeek Harness upstream into Nulu Harness.
#
#   fetch -> merge -> rebrand -> report
#
# The rebrand pass converts DeepSeek branding, CLI names, package scope, and
# DeepSeek-specific provider packages back into their Nulu equivalents, then
# reports anything still referencing "deepseek" for manual review.
#
# Usage:
#   ./scripts/sync-upstream.sh              # fetch + merge + rebrand + report
#   ./scripts/sync-upstream.sh --no-merge   # rebrand the current tree only
#
# Requires a clean working tree and the `upstream` remote already configured:
#   git remote add upstream https://github.com/deepseek-ai/deepseek-harness.git
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

NO_MERGE=0
for arg in "$@"; do
  case "$arg" in
    --no-merge) NO_MERGE=1 ;;
  esac
done

# Ensure the upstream remote exists.
if ! git remote | grep -qx upstream; then
  echo "[sync-upstream] adding upstream remote"
  git remote add upstream https://github.com/deepseek-ai/deepseek-harness.git
fi

if [[ "$NO_MERGE" == "0" ]]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "[sync-upstream] error: working tree is not clean; commit or stash first" >&2
    exit 1
  fi

  echo "[sync-upstream] fetching upstream master"
  git fetch upstream master

  if git merge-base --is-ancestor HEAD upstream/master; then
    echo "[sync-upstream] already up to date with upstream"
  else
    echo "[sync-upstream] merging upstream/master"
    if ! git merge upstream/master --no-edit; then
      echo "[sync-upstream] merge conflicts detected; resolve them, then run:"
      echo "  node scripts/rebrand-upstream.mjs"
      echo "  git add -A && git commit"
      exit 1
    fi
  fi
fi

echo "[sync-upstream] rebranding tree"
node scripts/rebrand-upstream.mjs

echo "[sync-upstream] done — review the report above, then commit the result:"
echo "  git add -A && git commit -m 'chore: sync upstream and re-apply Nulu rebrand'"
