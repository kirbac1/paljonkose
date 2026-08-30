#!/bin/bash
# Complete deployment helper with permission fixes

set -e

DEPLOY_USER="kirbac.fi_8idtpygek3v"
DEPLOY_HOST="135.125.233.39"
DEPLOY_KEY="deploy_key"
APP_ROOT="~/paljonkose"

if [ ! -f "$DEPLOY_KEY" ]; then
  echo "❌ Error: $DEPLOY_KEY not found"
  exit 1
fi

echo "🚀 Complete Deployment Script"
echo "============================="
echo ""

# Step 1: Sync files
echo "📦 Step 1: Syncing files..."
RELEASE="$(date -u +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)"

ssh -i "$DEPLOY_KEY" "$DEPLOY_USER@$DEPLOY_HOST" "mkdir -p $APP_ROOT/releases/$RELEASE"

rsync -az web/ \
  -e "ssh -i $DEPLOY_KEY" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='package-lock.json' \
  "$DEPLOY_USER@$DEPLOY_HOST:$APP_ROOT/releases/$RELEASE/"

echo "✅ Files synced"

# Step 2: Update symlink
echo ""
echo "🔗 Step 2: Updating symlink..."
ssh -i "$DEPLOY_KEY" "$DEPLOY_USER@$DEPLOY_HOST" \
  "cd $APP_ROOT && ln -sfn releases/$RELEASE current.tmp && mv -Tf current.tmp current"
echo "✅ Symlink updated"

# Step 3: Fix permissions
echo ""
echo "🔧 Step 3: Fixing permissions..."
ssh -i "$DEPLOY_KEY" "$DEPLOY_USER@$DEPLOY_HOST" << 'PERMS'
find ~/paljonkose/current -type d -exec chmod 755 {} \;
find ~/paljonkose/current -type f -exec chmod 644 {} \;
chmod 755 ~/paljonkose/current/*.sh 2>/dev/null || true
chmod 755 ~/paljonkose/current/app.js ~/paljonkose/current/server.mjs 2>/dev/null || true
PERMS
echo "✅ Permissions fixed"

# Step 4: Install dependencies
echo ""
echo "📚 Step 4: Installing dependencies..."
ssh -i "$DEPLOY_KEY" "$DEPLOY_USER@$DEPLOY_HOST" << 'DEPS'
cd ~/paljonkose/current
npm install --production 2>&1 | tail -3
DEPS
echo "✅ Dependencies installed"

# Step 5: Verify
echo ""
echo "✅ Step 5: Verification"
ssh -i "$DEPLOY_KEY" "$DEPLOY_USER@$DEPLOY_HOST" << 'VERIFY'
echo "Release directory: $(readlink ~/paljonkose/current | xargs basename)"
echo ""
echo "Key files:"
ls -lh ~/paljonkose/current/ | grep -E 'server.mjs|app.js|package.json|public'
echo ""
echo "Public folder contents:"
ls -1 ~/paljonkose/current/public/ | head -5
VERIFY

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "To start the app:"
echo "  ssh -i $DEPLOY_KEY $DEPLOY_USER@$DEPLOY_HOST"
echo "  cd ~/paljonkose/current"
echo "  PORT=3001 SITE_URL=https://your-domain.com NODE_ENV=production node app.js"
