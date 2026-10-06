#!/usr/bin/env bash
# Check out the exact revisions recorded by the parent repository.
# Both libraries are public; checkout needs no extra credential.
set -euo pipefail
cd "$(dirname "$0")/.."
git submodule sync --recursive
git submodule update --init --recursive
# Reused Jenkins workspaces can retain shallow submodules from old jobs.
# Fetch complete remote history without moving any local branch or gitlink.
for repo in . packages/animu-api packages/react-native-anything-player; do
  if [ "$(git -C "$repo" rev-parse --is-shallow-repository)" = true ]; then
    git -C "$repo" fetch --unshallow origin
  fi
  git -C "$repo" fetch origin '+refs/heads/*:refs/remotes/origin/*'
done
for name in animu-api react-native-anything-player; do
  test -f "packages/$name/package.json" || { echo "$name submodule missing" >&2; exit 1; }
done
