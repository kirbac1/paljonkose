# GitHub Actions Deployment Setup

> **This is now live.** [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
> runs the test suite, then rsyncs `files/` to the server, runs `npm ci`
> there, flips the `current` symlink, and touches `files/tmp/restart.txt`
> to make Passenger pick up the new code — on every push to `main`. The
> rest of this document is the original manual setup guide; it's still
> useful for understanding the release layout and for troubleshooting,
> but you no longer need to run these steps by hand.

This project uses GitHub Actions to automatically deploy to your production server on every push to `main`.

**Deployment Directory:** `~/paljonkose/` (in your home directory - no sudo needed!)

## 📋 Setup Steps

The commands below refer to the server as `$DEPLOY_USER@$DEPLOY_HOST`. The
address and username are deliberately not written down in this public repo —
export them first, from the same values you put in the GitHub secrets:

```bash
export DEPLOY_HOST=... DEPLOY_USER=...
```

### Step 1: Generate SSH Deployment Key

On your **local machine**, generate a dedicated SSH key for GitHub Actions:

```bash
ssh-keygen -t ed25519 -f deploy_key -N "" -C "github-actions-deploy"
```

This creates two files:
- `deploy_key` (private key - for GitHub)
- `deploy_key.pub` (public key - for your server)

> ⚠️ The private key must never be committed. `.gitignore` covers `deploy_key`,
> but generate it outside the working tree if you can — an earlier version of
> this repo did commit one, and a public repo's history keeps it forever.

### Step 2: Add Public Key to Server

SSH into your production server and add the public key to authorize GitHub Actions:

```bash
ssh $DEPLOY_USER@$DEPLOY_HOST

# On the server:
mkdir -p ~/.ssh
cat >> ~/.ssh/authorized_keys << 'EOF'
# Paste the contents of deploy_key.pub here
EOF

chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

### Step 3: Get Server's Host Key

Get your server's SSH host key (needed to prevent man-in-the-middle attacks):

```bash
ssh-keyscan -H "$DEPLOY_HOST" 2>/dev/null
```

Copy the output - you'll need this in the next step.

### Step 4: Add GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** and add these secrets:

| Secret Name | Value |
|------------|-------|
| `DEPLOY_SSH_KEY` | Contents of `deploy_key` (private key) |
| `DEPLOY_HOST` | the server address |
| `DEPLOY_USER` | the SSH user |
| `DEPLOY_KNOWN_HOSTS` | Output from ssh-keyscan (optional but recommended) |

### Step 5: Set Up Server Directory Structure

On your production server, the directories were created in your home directory:
```bash
~/paljonkose/
  ├── releases/     (contains all releases)
  ├── shared/       (shared data between releases)
  └── current       (symlink to active release)
```

✅ **Already done!** The directories are ready.

## 🚀 Running Your App

### Option A: Manual Start (Simple)

SSH to your server and run:

```bash
cd ~/paljonkose/current
PORT=3001 SITE_URL=https://your-domain.com node files/server.mjs
```

### Option B: Run in Background with Screen

Keep your app running even after you disconnect:

```bash
ssh $DEPLOY_USER@$DEPLOY_HOST

# Start in a detachable session
screen -S paljonkose
cd ~/paljonkose/current
PORT=3001 SITE_URL=https://your-domain.com NODE_ENV=production node files/server.mjs

# Press Ctrl+A then D to detach (app keeps running)

# Later, to reattach:
screen -r paljonkose

# To stop: Ctrl+C inside the screen session
```

### Option C: Use the Startup Script

Deploy the provided startup script:

```bash
ssh $DEPLOY_USER@$DEPLOY_HOST
mkdir -p ~/bin
# Then copy start-app.sh to ~/bin/start-app.sh via SCP or manually
chmod +x ~/bin/start-app.sh

# Run it:
~/bin/start-app.sh
```

### Option D: Auto-Start on Server Reboot (crontab)

For hands-off operation, run on startup via crontab:

```bash
ssh $DEPLOY_USER@$DEPLOY_HOST
crontab -e

# Add this line:
@reboot cd ~/paljonkose/current && PORT=3001 SITE_URL=https://your-domain.com NODE_ENV=production nohup node files/server.mjs >> ~/paljonkose/app.log 2>&1
```

## 🚀 How Deployment Works

1. **You push to `main` branch** on GitHub
2. **GitHub Actions triggers** (see `.github/workflows/deploy.yml`)
3. **Build runs**:
   - Checks out code
   - Installs dependencies (`npm ci`)
   - Validates the app
4. **Deploy runs**:
   - Creates a new release directory: `~/paljonkose/releases/YYYYMMDD-HHMMSS-sha/`
   - Copies entire app to the release directory via rsync
   - Atomically switches the `current` symlink to new release
   - Cleans up old releases (keeps last 5)
5. **Your app starts** (you manually run start-app.sh or via cron @reboot)

## ✅ Verify Deployment

After your first commit to `main`:

1. Check GitHub Actions: Go to repo → **Actions** tab → see the deploy workflow run
2. Check deployed files on server:
   ```bash
   ssh -i deploy_key $DEPLOY_USER@$DEPLOY_HOST
   ls ~/paljonkose/releases/
   ls -la ~/paljonkose/current/
   ```
3. Start the app:
   ```bash
   cd ~/paljonkose/current
   PORT=3001 SITE_URL=https://your-domain.com node files/server.mjs
   ```
4. Test it: `curl http://localhost:3001`

## 🔄 Rollback (Manual)

If something goes wrong, switch back to a previous release:

```bash
ssh -i deploy_key $DEPLOY_USER@$DEPLOY_HOST

# List available releases
ls ~/paljonkose/releases/

# Switch to a previous release (replace DATE-TIME-SHA)
ln -sfn ~/paljonkose/releases/20260827-123456-abc1234 ~/paljonkose/current.tmp
mv -Tf ~/paljonkose/current.tmp ~/paljonkose/current

# Restart app manually (see "Running Your App" section above)
```

## 📝 Environment Variables

Set these when running your app:

```bash
# Port to listen on (default: 3000)
PORT=3001

# Full URL to your site (used for OG images and links)
SITE_URL=https://your-domain.com

# Node environment (development or production)
NODE_ENV=production

# Path to stats file (for share counters)
STATS_FILE=./stats.json
```

**Example full startup command:**

```bash
cd ~/paljonkose/current
PORT=3001 SITE_URL=https://your-domain.com NODE_ENV=production node files/server.mjs
```

## 🐛 Troubleshooting

**App won't start:**
- Check logs: `tail -f ~/paljonkose/app.log`
- Check if port is available: `netstat -tuln | grep 3001`
- Check dependencies: `cd ~/paljonkose/current && npm ci`

**Files aren't updating after push:**
- Verify GitHub Actions workflow succeeded: `https://github.com/kirbac1/paljonkose/actions`
- Check deployed files: `ls -la ~/paljonkose/releases/`
- Check current symlink: `readlink ~/paljonkose/current`

**Need to restart after deploy:**
- Find and kill old process: `pkill -f "node files/server.mjs"`
- Start new process: `cd ~/paljonkose/current && node files/server.mjs`
