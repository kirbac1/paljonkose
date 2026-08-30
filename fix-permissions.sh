#!/bin/bash
# Fix deployment permissions after rsync

set -e

APP_ROOT=~/paljonkose/current

echo "🔧 Fixing deployment permissions..."
echo ""

# Make directories readable/executable
find "$APP_ROOT" -type d -exec chmod 755 {} \;
echo "✅ Directories: 755"

# Make files readable
find "$APP_ROOT" -type f -exec chmod 644 {} \;
echo "✅ Files: 644"

# Make executable scripts executable
chmod 755 "$APP_ROOT"/*.sh 2>/dev/null || true
chmod 755 "$APP_ROOT"/files/*.sh 2>/dev/null || true
echo "✅ Scripts: 755"

# Node app entry points should be executable
chmod 755 "$APP_ROOT/app.js" 2>/dev/null || true
chmod 755 "$APP_ROOT/server.mjs" 2>/dev/null || true
echo "✅ Server files: 755"

echo ""
echo "📋 Final permissions:"
ls -ld "$APP_ROOT"
echo ""
echo "Public folder:"
ls -la "$APP_ROOT/public/" 2>/dev/null | head -5 || echo "✅ Public folder ready"
echo ""
echo "✅ Permissions fixed!"
