#!/usr/bin/env bash
#
# plesk-deploy.sh — build and publish, run by Plesk's Git deployment action.
#
# Plesk's Git extension checks out your repo and then runs "additional
# deployment actions". This script is that action. Configure it as a single
# line in the panel:
#
#   bash /var/www/vhosts/DOMAIN/src/deploy/plesk/plesk-deploy.sh
#
# Keeping the logic in a versioned file rather than pasting a blob into the
# panel textarea means deploy changes are reviewable in git history, and you
# are not editing production behaviour through a web form.
#
# ── Why this exists instead of just letting Plesk deploy to httpdocs ──────
#
# Plesk's Git deploy copies files to the deployment path and *then* runs the
# actions. If you point it straight at httpdocs, a repo that fails to build
# has already overwritten your live site by the time the build errors out.
# So: Plesk deploys to a src/ directory that is NOT the docroot, this script
# builds from there, and httpdocs is only touched once the build succeeds.

set -euo pipefail

# ---------------------------------------------------------------- config ---

# Webspace root. Override if the script lives somewhere unusual.
# Default: two levels up from src/deploy/plesk/ → /var/www/vhosts/DOMAIN
VHOST_ROOT="${VHOST_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"

SRC_DIR="${SRC_DIR:-${VHOST_ROOT}/src}"
RELEASES_DIR="${RELEASES_DIR:-${VHOST_ROOT}/releases}"
DOCROOT="${DOCROOT:-${VHOST_ROOT}/httpdocs}"

BUILD_OUTPUT="${BUILD_OUTPUT:-dist}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

# Absolute URL baked into og:/canonical tags at build time.
export SITE_URL="${SITE_URL:-https://REPLACE-ME}"

# ------------------------------------------------------------- utilities ---

say()  { printf '→ %s\n' "$*"; }
ok()   { printf '✓ %s\n' "$*"; }
fail() { printf '✗ %s\n' "$*" >&2; }

# Plesk does not put node on the PATH for deployment actions — the domain's
# system user has its own environment, and node lives under the Plesk Node.js
# extension rather than in /usr/bin. This is the single most common reason a
# Plesk deploy action fails with "npm: command not found" while npm works
# fine when you SSH in as root.
#
# Picks the highest installed version unless PLESK_NODE_BIN is set.
load_node() {
  if [ -n "${PLESK_NODE_BIN:-}" ]; then
    PATH="${PLESK_NODE_BIN}:$PATH"
    export PATH
  elif compgen -G "/opt/plesk/node/*/bin" >/dev/null 2>&1; then
    local newest
    newest="$(find /opt/plesk/node -maxdepth 2 -type d -name bin 2>/dev/null \
      | sort -V | tail -1)"
    PATH="${newest}:$PATH"
    export PATH
  fi

  if ! command -v node >/dev/null 2>&1; then
    fail "node not found."
    fail "Installed Plesk node versions:"
    ls -1 /opt/plesk/node 2>/dev/null | sed 's/^/    /' >&2 || echo "    (none)" >&2
    fail "Install the Node.js extension in Plesk, or set PLESK_NODE_BIN."
    return 1
  fi
  return 0
}

# ------------------------------------------------------------ preflight ---

say "Webspace: ${VHOST_ROOT}"

if [ ! -d "$SRC_DIR" ]; then
  fail "Source directory ${SRC_DIR} does not exist."
  fail "Set the Plesk Git deployment path to '/src' (not httpdocs)."
  exit 1
fi

if [ ! -f "${SRC_DIR}/package.json" ]; then
  fail "No package.json in ${SRC_DIR} — nothing to build."
  exit 1
fi

if [ "$SITE_URL" = "https://REPLACE-ME" ]; then
  fail "SITE_URL is still the placeholder."
  fail "Set it at the top of this script, or export it in the Plesk deploy action."
  exit 1
fi

load_node || exit 1
say "node $(node -v), npm $(npm -v)"

# Checked up front rather than at publish time: discovering rsync is missing
# after a three-minute build, with the live site already half-considered, is
# a worse place to find out.
if ! command -v rsync >/dev/null 2>&1; then
  fail "rsync not found. Install it on the server: sudo apt-get install -y rsync"
  exit 1
fi

mkdir -p "$RELEASES_DIR"

# -------------------------------------------------------------- build ---

REV="$(cd "$SRC_DIR" && git rev-parse --short HEAD 2>/dev/null || echo nogit)"
RELEASE="${RELEASES_DIR}/$(date -u +%Y%m%d-%H%M%S)-${REV}"

say "Building ${REV} → ${RELEASE##*/}"

mkdir -p "$RELEASE"

# Copy the checkout rather than building inside it, so a half-finished build
# never leaves artefacts in the directory Plesk will overwrite next deploy.
tar -C "$SRC_DIR" \
    --exclude=.git \
    --exclude=node_modules \
    --exclude="$BUILD_OUTPUT" \
    -cf - . | tar -C "$RELEASE" -xf -

cd "$RELEASE"

# Every fallible step is checked explicitly. Do not rely on `set -e` alone
# here — if this script is ever sourced or called from a conditional, errexit
# is suppressed and a failed build would sail through to the rsync.
if [ -f package-lock.json ]; then
  if ! npm ci --no-audit --no-fund; then
    fail "npm ci failed — live site untouched."
    rm -rf "$RELEASE"; exit 1
  fi
else
  say "No package-lock.json — using npm install. Commit your lockfile."
  if ! npm install --no-audit --no-fund; then
    fail "npm install failed — live site untouched."
    rm -rf "$RELEASE"; exit 1
  fi
fi

if ! npm run build; then
  fail "Build failed — live site untouched."
  rm -rf "$RELEASE"; exit 1
fi

if [ ! -d "$BUILD_OUTPUT" ] || [ -z "$(ls -A "$BUILD_OUTPUT" 2>/dev/null)" ]; then
  fail "${BUILD_OUTPUT}/ missing or empty after build — live site untouched."
  rm -rf "$RELEASE"; exit 1
fi

# Optional: the shareability checks (absolute og: URLs, no localhost leak).
if [ -f scripts/check-build.mjs ]; then
  if ! node scripts/check-build.mjs "$BUILD_OUTPUT"; then
    fail "Build checks failed — live site untouched."
    rm -rf "$RELEASE"; exit 1
  fi
fi

# node_modules is large and useless now the build is done; dropping it keeps
# five kept releases cheap.
rm -rf node_modules

ok "Build succeeded."

# ------------------------------------------------------------ publish ---

# Why rsync into httpdocs rather than swapping a symlink:
#
# The bare-VPS version of this pointed the docroot at a symlink and swapped
# it — one rename(2), perfectly atomic. Under Plesk that fights two things:
# the docroot must sit inside the webspace and is managed by the panel, and
# Plesk restricts following symlinks whose owner differs from the link
# (and Apache's FollowSymLinks can be disabled per-domain in the UI).
#
# rsync --delete is not atomic across the whole directory, but it writes each
# file to a temp name and renames it into place, so individual files never
# appear half-written. For a static site this size the inconsistent window is
# well under a second, and it costs no fights with the panel.
#
# The build gate above is the property that actually matters, and it is
# preserved: nothing below runs unless the build succeeded.

say "Publishing to ${DOCROOT}"

mkdir -p "$DOCROOT"

# --delete removes files that no longer exist in the build. Excludes protect
# Plesk's own bits that live in httpdocs and are not yours to remove.
rsync -a --delete \
  --exclude='.well-known/' \
  --exclude='.htaccess' \
  "${RELEASE}/${BUILD_OUTPUT}/" "${DOCROOT}/"

# Record which release is live, so rollback and debugging have a source of
# truth that does not depend on comparing file trees.
echo "${RELEASE##*/}" > "${VHOST_ROOT}/.current-release"

ok "Live: ${RELEASE##*/}"

# ------------------------------------------------------------- prune ---

# Prune by NAME, not mtime: release dirs are YYYYmmdd-HHMMSS-sha, so reverse
# lexicographic order is reverse chronological. mtime ties arbitrarily when
# two releases land in the same second.
cd "$RELEASES_DIR"
live="$(cat "${VHOST_ROOT}/.current-release" 2>/dev/null || echo "")"

ls -1d -- */ 2>/dev/null | sort -r | tail -n +$((KEEP_RELEASES + 1)) | while read -r d; do
  # Never delete the release that is currently published.
  if [ "${d%/}" = "$live" ]; then continue; fi
  rm -rf -- "$d"
done

say "Keeping the last ${KEEP_RELEASES} releases."
ok "Deploy complete."
