#!/usr/bin/env bash
# Checks out the git submodules: packages/animu-api (public) and
# packages/react-native-airwave (a private repository).
#
# CI sets AIRWAVE_READ_TOKEN (a read-only token for the Airwave repository):
# git then authenticates through a one-shot credential helper, so the token
# never lands in a URL, the console log or .git/config. Without it, your own
# git credentials are used.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "${AIRWAVE_READ_TOKEN:-}" ]; then
  # The empty helper first clears any configured helper (keychain, store).
  # Single quotes: the helper's shell expands the variable, not this one.
  git -c credential.helper= \
    -c 'credential.helper=!f() { echo username=x-access-token; echo "password=${AIRWAVE_READ_TOKEN}"; }; f' \
    submodule update --init --recursive
else
  git submodule update --init --recursive
fi

test -f packages/animu-api/package.json || { echo "animu-api submodule missing" >&2; exit 1; }
test -f packages/react-native-airwave/package.json || { echo "react-native-airwave submodule missing" >&2; exit 1; }
