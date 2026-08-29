#!/usr/bin/env bash
# Runs a command inside the toolchain environment.
# Usage: scripts/within-env.sh pnpm install
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$DIR/tauri-env.sh"
"$@"