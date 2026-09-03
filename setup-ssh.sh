#!/bin/bash
# Automated SSH key setup for server deployment

set -euo pipefail

# Server details and the key to install both come from outside the repo.
# PUBLIC_KEY_FILE must point at the .pub half of the key CI currently uses --
# hardcoding one here is how a rotated-out key gets reinstalled by accident.
SERVER_USER="${SERVER_USER:?set SERVER_USER to the SSH user}"
SERVER_HOST="${SERVER_HOST:?set SERVER_HOST to the server address}"
PUBLIC_KEY_FILE="${PUBLIC_KEY_FILE:?point PUBLIC_KEY_FILE at the deploy key .pub file}"
PUBLIC_KEY="$(cat "$PUBLIC_KEY_FILE")"

echo "📝 Setting up SSH key authentication on server..."
echo ""

# Unquoted heredoc: $PUBLIC_KEY is expanded here, so the remote side never has
# to re-quote a value containing spaces. ~ is left for the remote shell.
ssh "$SERVER_USER@$SERVER_HOST" bash <<EOF
set -e

echo "✅ Creating .ssh directory..."
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Appending the same key twice is harmless but makes authorized_keys hard to
# audit, which is exactly when you want it readable.
if grep -qxF '$PUBLIC_KEY' ~/.ssh/authorized_keys 2>/dev/null; then
  echo "ℹ️  Key already present, leaving authorized_keys alone"
else
  echo "✅ Adding public key to authorized_keys..."
  printf '%s\n' '$PUBLIC_KEY' >> ~/.ssh/authorized_keys
fi

echo "✅ Setting permissions..."
chmod 600 ~/.ssh/authorized_keys

echo ""
echo "✅ Keys now authorized on this account:"
ssh-keygen -lf ~/.ssh/authorized_keys
EOF

echo ""
echo "✅ Server setup complete!"
echo ""
echo "Now test SSH key access:"
echo "  ssh -i \"${PUBLIC_KEY_FILE%.pub}\" $SERVER_USER@$SERVER_HOST"
