#!/usr/bin/env bash
#
# plesk-rollback.sh — republish an earlier release.
#
#   ssh you@server
#   bash /var/www/vhosts/DOMAIN/src/deploy/plesk/plesk-rollback.sh
#   bash .../plesk-rollback.sh 20260827-104233-a1b2c3d
#
# Every release under releases/ is a complete built tree, so this is just an
# rsync — no rebuild, no npm, works when the registry or an upstream open-data
# API is down.

set -euo pipefail

VHOST_ROOT="${VHOST_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
RELEASES_DIR="${RELEASES_DIR:-${VHOST_ROOT}/releases}"
DOCROOT="${DOCROOT:-${VHOST_ROOT}/httpdocs}"
BUILD_OUTPUT="${BUILD_OUTPUT:-dist}"

live="$(cat "${VHOST_ROOT}/.current-release" 2>/dev/null || echo "")"

if [ ! -d "$RELEASES_DIR" ]; then
  echo "✗ No releases directory at ${RELEASES_DIR}" >&2
  exit 1
fi

activate() {
  local target="$1"
  local dist="${RELEASES_DIR}/${target}/${BUILD_OUTPUT}"

  if [ ! -d "$dist" ]; then
    echo "✗ No built output at ${dist}" >&2
    exit 1
  fi

  rsync -a --delete \
    --exclude='.well-known/' \
    --exclude='.htaccess' \
    "${dist}/" "${DOCROOT}/"

  echo "$target" > "${VHOST_ROOT}/.current-release"
  echo "✓ Now live: ${target}"
  echo
  echo "Note: the next git push redeploys from source and supersedes this."
  echo "Revert the commit if you want the rollback to stick."
}

if [ $# -ge 1 ]; then
  activate "$1"
  exit 0
fi

echo "Releases (newest first, → is live):"
echo
cd "$RELEASES_DIR"
mapfile -t rels < <(ls -1d -- */ 2>/dev/null | sort -r | sed 's#/$##')

if [ "${#rels[@]}" -eq 0 ]; then
  echo "  (none)"
  exit 1
fi

for i in "${!rels[@]}"; do
  marker="  "
  [ "${rels[$i]}" = "$live" ] && marker="→ "
  printf '%s%2d) %s\n' "$marker" "$((i + 1))" "${rels[$i]}"
done

echo
read -r -p "Number to activate (Enter to cancel): " choice
[ -z "${choice:-}" ] && { echo "Cancelled."; exit 0; }

idx=$((choice - 1))
if [ "$idx" -lt 0 ] || [ "$idx" -ge "${#rels[@]}" ]; then
  echo "✗ No such release." >&2
  exit 1
fi

activate "${rels[$idx]}"
