#!/bin/sh
# Source this file. Share download stores, never installed dependencies.
CI_CACHE_DIR="${CI_CACHE_DIR:-$HOME/.cache/animu-ci}"
export CI_CACHE_DIR
export COREPACK_HOME="$CI_CACHE_DIR/corepack"
export npm_config_cache="$CI_CACHE_DIR/npm"
export npm_config_store_dir="$CI_CACHE_DIR/pnpm"
export YARN_GLOBAL_FOLDER="$CI_CACHE_DIR/yarn"
export XDG_CACHE_HOME="$CI_CACHE_DIR/tools"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
mkdir -p "$COREPACK_HOME" "$npm_config_cache" "$npm_config_store_dir" "$YARN_GLOBAL_FOLDER" "$XDG_CACHE_HOME"
