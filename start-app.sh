#!/bin/bash
# Start the Paljonkose app from home directory
# This can be run manually or via cron @reboot

set -e

APP_DIR="$HOME/paljonkose/current"
PORT="${PORT:-3001}"
SITE_URL="${SITE_URL:-http://localhost:3001}"
NODE_ENV="${NODE_ENV:-production}"

echo "Starting Paljonkose from $APP_DIR..."
echo "Port: $PORT"
echo "Site URL: $SITE_URL"

cd "$APP_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm ci --production
fi

# Start the server
export PORT=$PORT
export SITE_URL=$SITE_URL
export NODE_ENV=$NODE_ENV

exec node files/server.mjs
