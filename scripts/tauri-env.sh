#!/usr/bin/env bash
# Configures the environment for building/running the Tauri (Rust) side
# when the WebKitGTK -dev packages are not installed system-wide.
#
# This project ships a user-local copy of the required -dev headers/libs in
# $HOME/.local/opt/tadev (see scripts/setup-linux-deps.sh). Source this file
# (or run commands through scripts/within-env.sh) so cargo/link can find them.
#
# Usage:
#   source scripts/tauri-env.sh
#   pnpm tauri dev

PREFIX="$HOME/.local/opt/tadev"

if [ -d "$PREFIX/lib/x86_64-linux-gnu/pkgconfig" ]; then
  export PKG_CONFIG_PATH="$PREFIX/lib/x86_64-linux-gnu/pkgconfig${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"
fi
if [ -d "$PREFIX/include" ]; then
  export C_INCLUDE_PATH="$PREFIX/include${C_INCLUDE_PATH:+:$C_INCLUDE_PATH}"
  export CPLUS_INCLUDE_PATH="$PREFIX/include${CPLUS_INCLUDE_PATH:+:$CPLUS_INCLUDE_PATH}"
fi
if [ -d "$PREFIX/lib/x86_64-linux-gnu" ]; then
  export LIBRARY_PATH="$PREFIX/lib/x86_64-linux-gnu${LIBRARY_PATH:+:$LIBRARY_PATH}"
  export LD_LIBRARY_PATH="$PREFIX/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi

export PATH="$HOME/.cargo/bin:$PATH"