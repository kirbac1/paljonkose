#!/bin/bash
# Automated SSH key setup for server deployment

SERVER_USER="kirbac.fi_8idtpygek3v"
SERVER_HOST="135.125.233.39"
PUBLIC_KEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIL0E/lc5wVlSzS08Tx1w6wmzheULZpgAakp23+gBRUix github-actions-deploy"

echo "📝 Setting up SSH key authentication on server..."
echo ""

# Send commands to server
ssh "$SERVER_USER@$SERVER_HOST" bash << 'EOF'
set -e

echo "✅ Creating .ssh directory..."
mkdir -p ~/.ssh
chmod 700 ~/.ssh

echo "✅ Adding public key to authorized_keys..."
cat >> ~/.ssh/authorized_keys << 'KEY'
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIL0E/lc5wVlSzS08Tx1w6wmzheULZpgAakp23+gBRUix github-actions-deploy
KEY

echo "✅ Setting permissions..."
chmod 600 ~/.ssh/authorized_keys

echo ""
echo "✅ SSH setup complete! Your public key:"
cat ~/.ssh/authorized_keys
EOF

echo ""
echo "✅ Server setup complete!"
echo ""
echo "Now test SSH key access:"
echo "  ssh -i deploy_key $SERVER_USER@$SERVER_HOST"
