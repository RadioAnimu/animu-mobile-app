#!/usr/bin/env bash
# Pinned checkouts, with read-only authentication scoped to the private library.
set -euo pipefail
cd "$(dirname "$0")/.."
git submodule sync --recursive
if [ -n "${AIRWAVE_SSH_KEY:-}${AIRWAVE_SSH_KEY_FILE:-}" ]; then
  task_key_dir=$(mktemp -d)
  trap 'rm -rf "$task_key_dir"' EXIT
  chmod 700 "$task_key_dir"
  if [ -n "${AIRWAVE_SSH_KEY_FILE:-}" ]; then
    cp "$AIRWAVE_SSH_KEY_FILE" "$task_key_dir/key"
  else
    printf '%s\n' "$AIRWAVE_SSH_KEY" > "$task_key_dir/key"
  fi
  chmod 600 "$task_key_dir/key"
  export GIT_SSH_COMMAND="ssh -i '$task_key_dir/key' -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile='$PWD/scripts/github-known-hosts'"
  git -c url.git@github.com:rmotafreitas/react-native-airwave.git.insteadOf=https://github.com/rmotafreitas/react-native-airwave.git \
    submodule update --init --recursive
elif [ -n "${AIRWAVE_READ_TOKEN:-}" ]; then
  git -c credential.helper= \
    -c 'credential.helper=!f() { echo username=x-access-token; echo "password=${AIRWAVE_READ_TOKEN}"; }; f' \
    submodule update --init --recursive
else
  git submodule update --init --recursive
fi
for name in animu-api react-native-airwave; do
  test -f "packages/$name/package.json" || { echo "$name submodule missing" >&2; exit 1; }
done
