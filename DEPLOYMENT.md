# GitHub Actions Deployment Setup

This project uses GitHub Actions to automatically deploy to your production server on every push to `main`.

**Deployment Directory:** `~/paljonkose/` (in your home directory - no sudo needed!)

## 📋 Setup Steps

### Step 1: Generate SSH Deployment Key

On your **local machine**, generate a dedicated SSH key for GitHub Actions:

```bash
ssh-keygen -t ed25519 -f deploy_key -N "" -C "github-actions-deploy"
```

This creates two files:
- `deploy_key` (private key - for GitHub)
- `deploy_key.pub` (public key - for your server)

### Step 2: Add Public Key to Server

SSH into your production server and add the public key to authorize GitHub Actions:

```bash
ssh kirbac.fi_8idtpygek3v@135.125.233.39

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
ssh-keyscan -H 135.125.233.39 2>/dev/null
```

Copy the output - you'll need this in the next step.

### Step 4: Add GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** and add these secrets:

| Secret Name | Value |
|------------|-------|
| `DEPLOY_SSH_KEY` | Contents of `deploy_key` (private key) |
| `DEPLOY_HOST` | `135.125.233.39` |
| `DEPLOY_USER` | `kirbac.fi_8idtpygek3v` |
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
ssh kirbac.fi_8idtpygek3v@135.125.233.39

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
ssh kirbac.fi_8idtpygek3v@135.125.233.39
mkdir -p ~/bin
# Then copy start-app.sh to ~/bin/start-app.sh via SCP or manually
chmod +x ~/bin/start-app.sh

# Run it:
~/bin/start-app.sh
```

### Option D: Auto-Start on Server Reboot (crontab)

For hands-off operation, run on startup via crontab:

```bash
ssh kirbac.fi_8idtpygek3v@135.125.233.39
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
   ssh -i deploy_key kirbac.fi_8idtpygek3v@135.125.233.39
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
ssh -i deploy_key kirbac.fi_8idtpygek3v@135.125.233.39

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
