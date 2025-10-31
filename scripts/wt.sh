#!/usr/bin/env bash
set -euo pipefail

# git worktree helper
# - start:  git worktree add for a task, using a repo-internal dir name
# - remove: git worktree remove by branch or path
# - list:   list existing worktrees
# - open:   print path to worktree by branch
#
# Usage:
#   scripts/wt.sh start <repo-dir> <branch> [--base <origin/main>] [--wt-base <../wt-<repo>>]
#   scripts/wt.sh remove <branch|path> [--force]
#   scripts/wt.sh list
#   scripts/wt.sh open <branch>
#
# Notes:
# - <repo-dir> is a directory inside this repo (e.g. packages/runtime-worker)
# - Worktree path default: "${WT_BASE:-../wt-<repo>}/<repo-dir>/<branch>"
# - Branch is created from <base> (default: origin/main if exists, otherwise main/master)

usage() {
  sed -n '1,60p' "$0" | sed -n '1,40p' | sed 's/^# \{0,1\}//'
}

die() { echo "Error: $*" >&2; exit 1; }

require_git_root() {
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not inside a git repo";
  # Ensure we run from repo root (has .git directory)
  if [ ! -d .git ]; then
    die "Run from the repository root (where .git exists)."
  fi
}

repo_name() {
  basename "$(pwd)"
}

default_base_branch() {
  if git show-ref --verify --quiet refs/remotes/origin/main; then echo "origin/main"; return; fi
  if git show-ref --verify --quiet refs/heads/main; then echo "main"; return; fi
  if git show-ref --verify --quiet refs/heads/master; then echo "master"; return; fi
  echo "HEAD"
}

sanitize_branch_for_path() { echo "$1" | sed -E 's#[^A-Za-z0-9._-]+#-#g'; }

ensure_dir_exists() { mkdir -p "$1"; }

wt_list_porcelain() {
  git worktree list --porcelain
}

wt_path_by_branch() {
  local br="$1"
  local path=""
  local in_entry=0
  local cur_path="" cur_branch=""
  while IFS= read -r line; do
    case "$line" in
      worktree\ *) cur_path="${line#worktree }"; in_entry=1 ;;
      branch\ *) cur_branch="${line#branch }" ;;
      *) ;;
    esac
    if [ -z "$line" ] && [ $in_entry -eq 1 ]; then
      # end of entry
      if [ "$cur_branch" = "refs/heads/$br" ] || [ "$cur_branch" = "$br" ]; then
        path="$cur_path"; echo "$path"; return 0
      fi
      in_entry=0; cur_path=""; cur_branch=""
    fi
  done < <(wt_list_porcelain; echo)
  return 1
}

cmd_start() {
  require_git_root
  local repo_dir="$1"; shift || true
  local branch="$1"; shift || true
  [ -n "${repo_dir:-}" ] || die "start: <repo-dir> is required"
  [ -n "${branch:-}" ] || die "start: <branch> is required"
  [ -d "$repo_dir" ] || die "Directory not found: $repo_dir"

  local base="$(default_base_branch)"
  local wt_base_default="../wt-$(repo_name)"
  local wt_base="$wt_base_default"

  while [ $# -gt 0 ]; do
    case "$1" in
      --base) shift; base="$1" ;;
      --wt-base) shift; wt_base="$1" ;;
      *) die "Unknown option: $1" ;;
    esac
    shift || true
  done

  local branch_path="$(sanitize_branch_for_path "$branch")"
  local wt_path="$wt_base/$repo_dir/$branch_path"

  ensure_dir_exists "$(dirname "$wt_path")"

  echo "[wt] base branch: $base"
  echo "[wt] worktree:    $wt_path"
  echo "[wt] repo dir:    $repo_dir"

  # Create new branch from base and add worktree
  git fetch --all --prune --quiet || true
  git worktree add -b "$branch" "$wt_path" "$base"

  # Write metadata for convenience (not committed)
  cat >"$wt_path/.worktree-meta.json" <<EOF
{
  "repo": "$(pwd)",
  "branch": "$branch",
  "base": "$base",
  "repoDir": "$repo_dir",
  "createdAt": "$(date -u +%FT%TZ)"
}
EOF

  echo "[wt] created. Next: cd '$wt_path'"
}

cmd_remove() {
  require_git_root
  local target="$1"; shift || true
  [ -n "${target:-}" ] || die "remove: <branch|path> is required"
  local path=""

  if [ -d "$target" ]; then
    path="$target"
  else
    path="$(wt_path_by_branch "$target" || true)"
  fi

  [ -n "${path:-}" ] || die "Could not resolve worktree path for '$target'"

  local force=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --force|-f) force=1 ;;
      *) die "Unknown option: $1" ;;
    esac
    shift || true
  done

  echo "[wt] removing: $path"
  if [ $force -eq 1 ]; then
    git worktree remove --force "$path"
  else
    git worktree remove "$path"
  fi
}

cmd_list() {
  require_git_root
  git worktree list
}

cmd_open() {
  require_git_root
  local br="$1"; shift || true
  [ -n "${br:-}" ] || die "open: <branch> is required"
  local path
  path="$(wt_path_by_branch "$br" || true)" || true
  [ -n "${path:-}" ] || die "No worktree found for branch '$br'"
  echo "$path"
}

main() {
  local cmd="${1:-}"; shift || true
  case "$cmd" in
    start) cmd_start "$@" ;;
    remove) cmd_remove "$@" ;;
    list) cmd_list ;;
    open) cmd_open "$@" ;;
    -h|--help|help|"") usage ;;
    *) die "Unknown command: $cmd" ;;
  esac
}

main "$@"

