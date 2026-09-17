#!/usr/bin/env bash
# Nulu Harness upstream adaptation pipeline.
#
#   fetch → classify → sync branch → merge → rebrand → validate → report
#
# This NEVER merges upstream into `main`. It creates a dated sync branch,
# classifies the incoming changes, applies the deterministic rebrand, runs the
# invariant validation, and writes an audit report. A human then reviews and
# merges the branch into `main`.
#
# Usage:
#   ./scripts/sync-upstream.sh                  # full pipeline
#   ./scripts/sync-upstream.sh --classify-only  # analyze + report, no merge
#   ./scripts/sync-upstream.sh --adapt          # run the AI adaptation executor
#   ./scripts/sync-upstream.sh --resume         # resume adaptation executor
#
# Requires a clean working tree and the `upstream` remote:
#   git remote add upstream https://github.com/deepseek-ai/deepseek-harness.git
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CLASSIFY_ONLY=0
ADAPT=0
RESUME=0
for arg in "$@"; do
  case "$arg" in
    --classify-only) CLASSIFY_ONLY=1 ;;
    --adapt) ADAPT=1 ;;
    --resume) RESUME=1 ;;
  esac
done

# Short-circuit: the adaptation executor consumes an existing queue and state.
if [[ "$ADAPT" == "1" || "$RESUME" == "1" ]]; then
  node scripts/upstream-sync/run-adaptations.mjs ${RESUME:+"--resume"}
  exit $?
fi

if ! git remote | grep -qx upstream; then
  echo "[sync-upstream] adding upstream remote"
  git remote add upstream https://github.com/deepseek-ai/deepseek-harness.git
fi

echo "[sync-upstream] fetching upstream master"
git fetch upstream master

BASE="$(git merge-base HEAD upstream/master)"
echo "[sync-upstream] fork base: ${BASE:0:12}"

# Analyze before modifying anything.
echo "[sync-upstream] classifying incoming changes"
node scripts/upstream-sync/classify.mjs "${BASE}..upstream/master"

echo "[sync-upstream] detecting high-risk architectural changes"
node scripts/upstream-sync/risk-detect.mjs "${BASE}..upstream/master"

echo "[sync-upstream] preparing semantic-adaptation briefs"
node scripts/upstream-sync/semantic-adapt.mjs "${BASE}..upstream/master"

if [[ "$CLASSIFY_ONLY" == "1" ]]; then
  echo "[sync-upstream] --classify-only: no changes made (briefs at reports/upstream-sync/adaptations/briefs)"
  exit 0
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "[sync-upstream] error: working tree is not clean; commit or stash first" >&2
  exit 1
fi

STAMP="$(date +%Y-%m-%d)"
BRANCH="sync/deepseek-${STAMP}"
echo "[sync-upstream] creating sync branch ${BRANCH}"
git checkout -b "$BRANCH"

echo "[sync-upstream] merging upstream/master"
if ! git merge upstream/master --no-edit; then
  echo "[sync-upstream] merge conflicts — resolve them on ${BRANCH}, then run:"
  echo "  node scripts/rebrand-upstream.mjs"
  echo "  node scripts/upstream-sync/validate.mjs"
  exit 1
fi

echo "[sync-upstream] applying deterministic rebrand (Level 1)"
node scripts/rebrand-upstream.mjs

echo "[sync-upstream] validating Nulu invariants"
if ! node scripts/upstream-sync/validate.mjs; then
  echo "[sync-upstream] FAILED validation — Nulu invariants were violated by the sync" >&2
  echo "[sync-upstream] do not merge ${BRANCH} until every FAIL is resolved" >&2
  exit 1
fi

echo "[sync-upstream] generating report"
node scripts/upstream-sync/report.mjs "${BASE}..upstream/master"

echo
echo "[sync-upstream] done. Review the report and the branch, then approve:"
echo "  git diff main...${BRANCH}"
echo "  git checkout main && git merge --no-ff ${BRANCH}"
