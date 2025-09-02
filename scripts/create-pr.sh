#!/usr/bin/env bash
set -euo pipefail

# create-pr.sh — Push current branch and open a GitHub PR.

BASE_BRANCH="main"
PR_TITLE=""
PR_BODY_FILE=""
PR_BODY_TEXT=""
DRAFT=false
REMOTE="origin"

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]
  -B, --base <branch>    Base branch (default: main)
  -t, --title <title>    PR title (required)
  -d, --body-file <path> PR body from file
  -b, --body <text>      PR body text (ignored if --body-file is given)
      --draft            Create a draft PR
  -r, --remote <name>    Git remote name (default: origin)
  -h, --help             Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -B|--base) BASE_BRANCH="$2"; shift 2;;
    -t|--title) PR_TITLE="$2"; shift 2;;
    -d|--body-file) PR_BODY_FILE="$2"; shift 2;;
    -b|--body) PR_BODY_TEXT="$2"; shift 2;;
    --draft) DRAFT=true; shift;;
    -r|--remote) REMOTE="$2"; shift 2;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown arg: $1" >&2; usage; exit 1;;
  esac
done

if [[ -z "${PR_TITLE}" ]]; then
  PR_TITLE=$(git log -1 --pretty=%s || true)
fi
if [[ -z "${PR_TITLE}" ]]; then
  echo "ERROR: PR title is required (use -t)." >&2
  exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ -z "$CURRENT_BRANCH" ]]; then
  echo "ERROR: failed to determine current branch" >&2
  exit 1
fi

echo "Current branch: $CURRENT_BRANCH"

if ! git show-ref --verify --quiet "refs/heads/${BASE_BRANCH}"; then
  echo "Fetching base branch ${BASE_BRANCH}..."
  git fetch "$REMOTE" "$BASE_BRANCH:$BASE_BRANCH"
fi

echo "Pushing $CURRENT_BRANCH to $REMOTE..."
git push -u "$REMOTE" "$CURRENT_BRANCH"

if command -v gh >/dev/null 2>&1; then
  echo "Creating PR via gh CLI..."
  GH_ARGS=(pr create -B "$BASE_BRANCH" -H "$CURRENT_BRANCH" -t "$PR_TITLE")
  if [[ -n "$PR_BODY_FILE" ]]; then
    GH_ARGS+=( -F "$PR_BODY_FILE" )
  elif [[ -n "$PR_BODY_TEXT" ]]; then
    GH_ARGS+=( -b "$PR_BODY_TEXT" )
  fi
  if [[ "$DRAFT" == true ]]; then
    GH_ARGS+=( --draft )
  fi
  gh "${GH_ARGS[@]}" || { echo "gh failed" >&2; exit 1; }
  exit 0
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "ERROR: gh not found and GITHUB_TOKEN not set. Cannot create PR automatically." >&2
  echo "You can create it manually: https://github.com/<owner>/<repo>/compare/${BASE_BRANCH}...${CURRENT_BRANCH}?expand=1" >&2
  exit 2
fi

REMOTE_URL=$(git remote get-url "$REMOTE")
if [[ "$REMOTE_URL" =~ ^git@github.com:(.*)\.git$ ]]; then
  REPO_PATH="${BASH_REMATCH[1]}"
elif [[ "$REMOTE_URL" =~ ^https://github.com/(.*)\.git$ ]]; then
  REPO_PATH="${BASH_REMATCH[1]}"
else
  echo "ERROR: Unsupported remote URL: $REMOTE_URL" >&2
  exit 1
fi

API_URL="https://api.github.com/repos/${REPO_PATH}/pulls"
echo "Creating PR via GitHub API: ${API_URL}"

BODY_CONTENT=""
if [[ -n "$PR_BODY_FILE" ]]; then
  BODY_CONTENT=$(sed 's/"/\\"/g' "$PR_BODY_FILE" | awk '{printf "%s\\n", $0}')
elif [[ -n "$PR_BODY_TEXT" ]]; then
  BODY_CONTENT=$(printf "%s" "$PR_BODY_TEXT" | sed 's/"/\\"/g')
fi

DRAFT_BOOL=false
if [[ "$DRAFT" == true ]]; then DRAFT_BOOL=true; fi

JSON=$(cat <<EOF
{
  "title": "${PR_TITLE}",
  "head": "${CURRENT_BRANCH}",
  "base": "${BASE_BRANCH}",
  "body": "${BODY_CONTENT}",
  "draft": ${DRAFT_BOOL}
}
EOF
)

HTTP_STATUS=$(curl -sS -o /tmp/create-pr.out -w "%{http_code}" \
  -H "Authorization: token ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -X POST "$API_URL" \
  -d "$JSON")

if [[ "$HTTP_STATUS" != 2* && "$HTTP_STATUS" != 201 ]]; then
  echo "ERROR: PR creation failed (HTTP $HTTP_STATUS)" >&2
  cat /tmp/create-pr.out >&2 || true
  exit 1
fi

echo "PR created successfully:"
cat /tmp/create-pr.out | sed -n 's/.*"html_url": "\(https:\\/\\/github.com\\/[^\"]*\)".*/\1/p'

