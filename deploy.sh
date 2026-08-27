#!/bin/bash
# Quick deployment helper script

set -euo pipefail

REPO_URL="https://github.com/kirbac1/paljonkose"
DEPLOY_HOST="135.125.233.39"
DEPLOY_USER="kirbac.fi_8idtpygek3v"
APP_ROOT="/srv/paljonkose"

echo "📋 Paljonkose Deployment Helper"
echo "================================"
echo ""
echo "1. Check deployment secrets setup"
echo "2. View deployment status"
echo "3. SSH to server"
echo "4. View app logs"
echo "5. Restart app"
echo ""

read -p "Choose an option (1-5): " choice

case $choice in
  1)
    echo "❓ Checking GitHub secrets..."
    echo ""
    echo "Run this in your repository settings:"
    echo "https://github.com/kirbac1/paljonkose/settings/secrets/actions"
    echo ""
    echo "Required secrets:"
    echo "  - DEPLOY_SSH_KEY (your private SSH key)"
    echo "  - DEPLOY_HOST (135.125.233.39)"
    echo "  - DEPLOY_USER (kirbac.fi_8idtpygek3v)"
    echo "  - DEPLOY_KNOWN_HOSTS (optional but recommended)"
    ;;
  2)
    echo "📊 Checking deployment status..."
    echo "View your GitHub Actions: https://github.com/kirbac1/paljonkose/actions"
    ;;
  3)
    echo "🔗 Connecting to server..."
    ssh "$DEPLOY_USER@$DEPLOY_HOST"
    ;;
  4)
    echo "📝 Showing app logs..."
    ssh "$DEPLOY_USER@$DEPLOY_HOST" "sudo journalctl -u paljonkose -f"
    ;;
  5)
    echo "♻️  Restarting app..."
    ssh "$DEPLOY_USER@$DEPLOY_HOST" "sudo systemctl restart paljonkose && echo '✅ App restarted'"
    ;;
  *)
    echo "❌ Invalid option"
    exit 1
    ;;
esac
