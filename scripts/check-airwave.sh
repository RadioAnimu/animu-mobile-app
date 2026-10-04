#!/usr/bin/env bash
# Typecheck + unit tests of the react-native-airwave submodule, at the pinned
# commit — the player counterpart of `check:animu-api`.
#
# Airwave is a Yarn project with its own toolchain (Jest, the React Native
# preset, an example app), so it gets its own install inside the submodule.
# That install is removed on exit: it holds another react-native, which the
# app's Metro / TypeScript resolution must never see (Metro also blocks it).
set -euo pipefail

cd "$(dirname "$0")/../packages/react-native-airwave"
test -f package.json || {
  echo "react-native-airwave submodule missing: git submodule update --init --recursive" >&2
  exit 1
}

trap 'rm -rf node_modules example/node_modules .yarn/install-state.gz' EXIT

export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack yarn install --immutable
corepack yarn typecheck
corepack yarn test
