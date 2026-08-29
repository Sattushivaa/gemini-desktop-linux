#!/usr/bin/env bash
# Installs Rust (via rustup, user-local) and a user-local copy of the
# WebKitGTK/GTK dev packages required to build Tauri on Debian/Ubuntu.
#
# This is only needed on systems where the -dev packages cannot be installed
# system-wide (e.g. no sudo). On machines with sudo, prefer installing the
# official prerequisites listed in the README instead.
#
# Usage: scripts/setup-linux-deps.sh
set -euo pipefail

PREFIX="$HOME/.local/opt/tadev"
PACKAGES=(
  libwebkit2gtk-4.1-dev
  libgtk-3-dev
  libsoup-3.0-dev
  javascriptcoregtk-4.1-dev
  librsvg2-dev
)

# 1. Rust toolchain
if ! command -v rustc >/dev/null 2>&1 && [ ! -x "$HOME/.cargo/bin/rustc" ]; then
  echo ">> Installing Rust via rustup..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
fi
export PATH="$HOME/.cargo/bin:$PATH"
rustc --version

# 2. Dev-headers, downloaded as .debs and extracted into a user-local prefix.
echo ">> Downloading -dev packages alongside their dependency closure..."
apt-get install --simulate "${PACKAGES[@]}" \
  | grep -E '^Inst ' | awk '{print $2}' > /tmp/tauri-deps.txt
mkdir -p /tmp/tauri-debs
cd /tmp/tauri-debs
apt-get download $(cat /tmp/tauri-deps.txt)
mkdir -p "$PREFIX"
for f in *.deb; do dpkg-deb -x "$f" "$PREFIX"; done

# Merge the ./usr subtree up so headers land under $PREFIX/include etc.
if [ -d "$PREFIX/usr" ]; then cp -a "$PREFIX/usr/." "$PREFIX"; rm -rf "$PREFIX/usr"; fi

# 3. Rewrite .pc includedir to local prefix while keeping runtime libdir/exec_prefix under /usr
find "$PREFIX" -name '*.pc' -print0 | xargs -0 sed -i "s|includedir=/usr|includedir=$PREFIX|g"
find "$PREFIX" -name '*.pc' -print0 | xargs -0 sed -i "s|prefix=/usr|prefix=$PREFIX|g"
find "$PREFIX" -name '*.pc' -print0 | xargs -0 sed -i "s|exec_prefix=$PREFIX|exec_prefix=/usr|g"
find "$PREFIX" -name '*.pc' -print0 | xargs -0 sed -i "s|libdir=$PREFIX|libdir=/usr|g"

# 4. Point dangling .so symlinks at the system runtime libraries.
SYS=/usr/lib/x86_64-linux-gnu
find "$PREFIX" -name '*.so' -type l | while read -r l; do
  if [ ! -e "$l" ]; then
    base=$(basename "$(readlink "$l")")
    rl=$(readlink -f "$SYS/$base" 2>/dev/null || true)
    [ -n "$rl" ] && ln -sfn "$rl" "$l"
  fi
done

echo ">> Done. Dev headers installed under $PREFIX."
echo ">> Source environment with: source scripts/tauri-env.sh"