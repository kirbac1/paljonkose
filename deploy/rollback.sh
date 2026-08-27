#!/usr/bin/env bash
#
# rollback.sh — point the site back at an earlier release.
#
# Run on the server:
#   bash /srv/sillasais/rollback.sh          # list releases, pick interactively
#   bash /srv/sillasais/rollback.sh 20260827-104233-a1b2c3d
#
# Because every release is a complete built tree, rolling back is just a
# symlink swap — no rebuild, no network, works when npm is down.

set -euo pipefail

APP_NAME="sillasais"
APP_ROOT="/srv/${APP_NAME}"
RELEASES_DIR="${APP_ROOT}/releases"
CURRENT_LINK="${APP_ROOT}/current"
BUILD_OUTPUT="dist"

current_target="$(readlink -f "$CURRENT_LINK" 2>/dev/null || echo "none")"

list_releases() {
  local n=0
  for dir in $(ls -1dt "${RELEASES_DIR}"/*/ 2>/dev/null); do
    n=$((n + 1))
    local name marker
    name="$(basename "$dir")"
    marker="  "
    [ "$(readlink -f "${dir}${BUILD_OUTPUT}")" = "$current_target" ] && marker="→ "
    printf '%s%2d) %s\n' "$marker" "$n" "$name"
  done
  [ "$n" -eq 0 ] && { echo "No releases found in ${RELEASES_DIR}"; exit 1; }
}

activate() {
  local target="$1"
  local dist="${RELEASES_DIR}/${target}/${BUILD_OUTPUT}"

  if [ ! -d "$dist" ]; then
    echo "✗ No built output at ${dist}" >&2
    exit 1
  fi

  ln -sfn "$dist" "${CURRENT_LINK}.tmp"
  mv -Tf "${CURRENT_LINK}.tmp" "$CURRENT_LINK"
  printf '\033[0;32m✓ Now live: %s\033[0m\n' "$target"
  echo
  echo "Note: the next push to production will deploy that commit and"
  echo "supersede this rollback. Revert the commit in git if you want the"
  echo "rollback to stick."
}

if [ $# -ge 1 ]; then
  activate "$1"
  exit 0
fi

echo "Releases (newest first, → is live):"
echo
list_releases
echo
read -r -p "Number to activate (Enter to cancel): " choice
[ -z "${choice:-}" ] && { echo "Cancelled."; exit 0; }

selected="$(ls -1dt "${RELEASES_DIR}"/*/ | sed -n "${choice}p")"
[ -z "$selected" ] && { echo "✗ No such release." >&2; exit 1; }

activate "$(basename "$selected")"
