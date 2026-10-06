#!/usr/bin/env bash
# Check out the exact revisions recorded by the parent repository.
# Both libraries are public; checkout needs no extra credential.
set -euo pipefail
cd "$(dirname "$0")/.."
git submodule sync --recursive
git submodule update --init --recursive
for name in animu-api react-native-anything-player; do
  test -f "packages/$name/package.json" || { echo "$name submodule missing" >&2; exit 1; }
done
