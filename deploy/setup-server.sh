#!/usr/bin/env bash
#
# setup-server.sh — one-time server preparation. Run once, as your normal
# SSH user (it uses sudo where it needs to).
#
#   scp -r deploy/ user@server:~/deploy-kit
#   ssh user@server
#   bash ~/deploy-kit/setup-server.sh
#
# Idempotent: safe to re-run after you edit the hook or the nginx config.

set -euo pipefail

APP_NAME="sillasais"
APP_ROOT="/srv/${APP_NAME}"
KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_USER="${USER}"

say()  { printf '\033[0;36m→ %s\033[0m\n' "$*"; }
ok()   { printf '\033[0;32m✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[0;33m! %s\033[0m\n' "$*"; }

# ------------------------------------------------------- prerequisites ---

say "Checking prerequisites"

missing=()
command -v git   >/dev/null 2>&1 || missing+=("git")
command -v nginx >/dev/null 2>&1 || missing+=("nginx")
command -v node  >/dev/null 2>&1 || missing+=("nodejs")

if [ ${#missing[@]} -gt 0 ]; then
  warn "Missing: ${missing[*]}"
  say "Installing…"
  sudo apt-get update -qq
  # NodeSource gives a current Node; Debian/Ubuntu's own package is often
  # too old for modern build tooling.
  if printf '%s\n' "${missing[@]}" | grep -qx nodejs; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  fi
  sudo apt-get install -y "${missing[@]}"
fi

ok "git $(git --version | awk '{print $3}'), node $(node -v), nginx present"

# ------------------------------------------------------------- layout ---

say "Creating ${APP_ROOT}"

sudo mkdir -p "${APP_ROOT}/releases"
sudo chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_ROOT}"

# --------------------------------------------------------- bare repo ---

if [ ! -d "${APP_ROOT}/repo" ]; then
  say "Initialising bare repo"
  git init --bare "${APP_ROOT}/repo"
else
  ok "Bare repo already exists"
fi

say "Installing post-receive hook"
install -m 755 "${KIT_DIR}/post-receive" "${APP_ROOT}/repo/hooks/post-receive"

# ----------------------------------------------------- placeholder page ---

# So nginx has something to serve before the first push, rather than 404ing
# and making you wonder which half is broken.
if [ ! -e "${APP_ROOT}/current" ]; then
  say "Creating placeholder document root"
  mkdir -p "${APP_ROOT}/releases/000000-placeholder/dist"
  cat > "${APP_ROOT}/releases/000000-placeholder/dist/index.html" <<'HTML'
<!doctype html>
<meta charset="utf-8">
<title>Waiting for first deploy</title>
<body style="font:16px system-ui;max-width:32rem;margin:20vh auto;padding:0 1rem">
<h1>Server is up.</h1>
<p>nginx is serving correctly. Push to <code>production main</code> to replace this page.</p>
</body>
HTML
  ln -sfn "${APP_ROOT}/releases/000000-placeholder/dist" "${APP_ROOT}/current"
fi

# --------------------------------------------------------------- nginx ---

say "Installing nginx site"

sudo cp "${KIT_DIR}/nginx-site.conf" "/etc/nginx/sites-available/${APP_NAME}"
sudo ln -sfn "/etc/nginx/sites-available/${APP_NAME}" "/etc/nginx/sites-enabled/${APP_NAME}"

# The default site owns the catch-all on a fresh box and will shadow ours.
if [ -e /etc/nginx/sites-enabled/default ]; then
  say "Disabling nginx default site"
  sudo rm -f /etc/nginx/sites-enabled/default
fi

# nginx workers run as www-data and must be able to traverse into /srv.
sudo chmod o+x /srv "${APP_ROOT}"

say "Testing nginx config"
sudo nginx -t
sudo systemctl reload nginx

ok "nginx reloaded"

# ------------------------------------------------------------ firewall ---

if command -v ufw >/dev/null 2>&1 && sudo ufw status | grep -q "Status: active"; then
  say "Opening HTTP/HTTPS in ufw"
  sudo ufw allow 'Nginx Full' >/dev/null
fi

# ----------------------------------------------------------------- done ---

IP="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"

cat <<EOF

$(ok "Server ready.")

Next, on your Mac, from the project folder:

    git remote add production ${DEPLOY_USER}@${IP}:${APP_ROOT}/repo
    git push production main

Then open:  http://${IP}

Once the domain is settled:
  1. Point its A record at ${IP}
  2. sudo certbot --nginx -d YOURDOMAIN.fi -d www.YOURDOMAIN.fi
  3. Set SITE_URL in ${APP_ROOT}/repo/hooks/post-receive
  4. git commit --allow-empty -m "rebuild" && git push production main

EOF
