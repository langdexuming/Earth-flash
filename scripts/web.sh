#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if ! command -v node >/dev/null 2>&1 && [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  set +u
  source "$HOME/.nvm/nvm.sh"
  set -u
fi
if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js is required; activate your installed Node version and retry.' >&2
  exit 127
fi
exec node "$ROOT/scripts/local-web.mjs" "$@"
