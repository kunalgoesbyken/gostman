#!/usr/bin/env bash
set -euo pipefail

version="${1:?usage: update-package-repos.sh <version> <homebrew-tap-dir> <scoop-dir>}"
tap="${2:?}"
scoop="${3:?}"
repo="${GITHUB_REPOSITORY:-kunalgoesbyken/gostman}"
base="https://github.com/$repo/releases/download/v$version"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

digest() {
  curl -fsSL "$base/$1" | sha256sum | cut -d' ' -f1
}

set_hash() {
  awk -v asset="$2" -v hash="$3" '
    index($0, asset) { armed = 1; print; next }
    armed && /"?(sha256|hash)"?[ :]/ { sub(/[0-9a-f]{64}/, hash); armed = 0 }
    { print }
  ' "$1" > "$work/out"
  cp "$work/out" "$1"
}

set_version() {
  sed -E -i \
    -e "s/^(  version \")[^\"]*/\1$version/" \
    -e "s/^(    \"version\": \")[^\"]*/\1$version/" \
    -e "s#(releases/download/v)[0-9][^/]*#\1$version#" \
    "$1"
}

update() {
  file="$1"
  shift
  set_version "$file"
  for asset in "$@"; do
    set_hash "$file" "$asset" "$(digest "$asset")"
  done
}

update "$tap/Casks/gostman.rb" Gostman-darwin-universal.dmg
update "$tap/Formula/gostman-cli.rb" gostman-cli-darwin-arm64.tar.gz gostman-cli-darwin-amd64.tar.gz gostman-cli-linux-amd64.tar.gz
update "$scoop/bucket/gostman.json" Gostman-windows-amd64-portable.exe
update "$scoop/bucket/gostman-cli.json" gostman-cli-windows-amd64.zip

if [ "${DRY_RUN:-}" = 1 ]; then
  git -C "$tap" diff --stat
  git -C "$scoop" diff --stat
  exit 0
fi

for dir in "$tap" "$scoop"; do
  if git -C "$dir" diff --quiet; then
    echo "$dir already at v$version"
    continue
  fi
  git -C "$dir" -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" commit -qam "gostman $version"
  git -C "$dir" push -q
done
