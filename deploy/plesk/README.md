# Deploying on an OVH VPS with Plesk

Plesk owns the web server config and the vhost directory layout. Fighting it
is a losing game — panel updates and config regeneration will undo hand-edits.
So this setup works *with* Plesk: its Git extension receives the push, and a
versioned script does the build and publish.

**Read this instead of `../README.md`.** That one targets a bare VPS where
you own `/etc/nginx` and run `certbot` yourself. See [What changed](#what-changed-from-the-bare-vps-version)
at the bottom for what carried over and what to ignore.

---

## The shape

```
git push  ──►  Plesk Git repo  ──►  /var/www/vhosts/DOMAIN/src/   (checkout)
                                             │
                                    deploy action runs
                                             │
                                    releases/TIMESTAMP-sha/       (build here)
                                             │  npm ci → build → checks
                                             ▼
                                    httpdocs/                      (rsync, only if build passed)
```

**The critical detail: Plesk's deployment path must NOT be `httpdocs`.**

Plesk copies files to the deployment path *first*, then runs your deployment
actions. Point it at `httpdocs` and a repo that fails to build has already
overwritten your live site before the build error appears. Pointing it at
`src/` keeps the docroot untouched until a build has actually succeeded.

That single choice is what preserves the build gate — the property worth
keeping from the original design.

---

## Setup

### 1. Add the domain in Plesk

Websites & Domains → Add Domain. Use the real domain if you've settled on
one; otherwise add any domain you control and rename later, or use the
server's default `vhost` entry to work on the IP.

### 2. Enable SSH for the subscription user

Websites & Domains → *your domain* → **Web Hosting Access** → set
**Access to the server over SSH** to `/bin/bash`.

Not optional. With SSH forbidden, Plesk runs deployment actions **chrooted**
to the subscription home, so the script cannot reach anything above
`httpdocs` — which breaks the whole `src/` + `releases/` layout. This is the
second-most-common reason these setups fail.

### 3. Install the Node.js extension

Extensions → search "Node.js" → install. This puts node under
`/opt/plesk/node/<version>/bin/`, which is where the deploy script looks.

Check what you have:

```bash
ls -1 /opt/plesk/node/
```

### 4. Make sure rsync exists

```bash
sudo apt-get install -y rsync
```

Often already present. The script checks up front rather than discovering
it's missing after a three-minute build.

### 5. Create the Git repository in Plesk

Websites & Domains → *your domain* → **Git** → Add Repository.

| Field | Value |
|---|---|
| Repository type | Local (you push to Plesk) |
| Repository name | `sillasais` |
| Deployment mode | Automatic |
| **Deployment path** | **`/src`** ← not httpdocs |

Plesk shows you a push URL like
`ssh://user@server:/var/www/vhosts/DOMAIN/git/sillasais.git`.

### 6. Set the deployment action

Same screen → enable **Additional deployment actions**, and enter one line:

```bash
SITE_URL="https://YOURDOMAIN.fi" bash /var/www/vhosts/YOURDOMAIN.fi/src/deploy/plesk/plesk-deploy.sh
```

Keeping the logic in a versioned script rather than pasting a shell blob into
the panel textarea means deploy changes are reviewable in git history, and
you're not editing production behaviour through a web form with no undo.

### 7. Push

```bash
cd ~/Desktop/Projects/paljonkose
git remote add plesk ssh://user@server:/var/www/vhosts/YOURDOMAIN.fi/git/sillasais.git
git push plesk main
```

The deploy log is in the panel under Git → the repository → **Logs**. Read it
on the first push; that's where a missing node or a bad path shows up.

### 8. nginx directives

Domains → *your domain* → Hosting & DNS → **Apache & nginx Settings**:

- Turn **Serve static files directly by nginx** ON. Without it, requests go
  through Apache and the location blocks below never run.
- Paste [`nginx-directives.conf`](nginx-directives.conf) into
  **Additional nginx directives**.

Plesk writes these to `/var/www/vhosts/system/DOMAIN/conf/vhost_nginx.conf`
and reloads nginx itself. Don't edit that file directly — the panel is the
source of truth and will regenerate it.

### 9. TLS

Extensions → **SSL It!** → select the domain → issue a Let's Encrypt
certificate, and enable redirect-to-HTTPS plus "Keep websites secured".

**Do not run `certbot` on a Plesk server.** It writes config Plesk doesn't
know about, and Plesk's renewal and certbot's will fight. The panel extension
does the same job and survives updates.

---

## Daily use

```bash
git add . && git commit -m "27.8. Ukraina-tuki hoitajien palkkoina"
git push plesk main
```

Pushing to GitHub as well? Same dual-remote trick as before:

```bash
git remote set-url --add --push origin git@github.com:YOU/sillasais.git
git remote set-url --add --push origin ssh://user@server:/var/www/vhosts/YOURDOMAIN.fi/git/sillasais.git
```

Then a plain `git push` backs up and deploys.

---

## Rollback

```bash
ssh you@server
bash /var/www/vhosts/YOURDOMAIN.fi/src/deploy/plesk/plesk-rollback.sh
```

Lists the last five releases and rsyncs the one you pick back into `httpdocs`.
No rebuild, so it works when npm or an upstream open-data API is down.

Temporary: the next push redeploys from source. Revert the commit to make it
stick.

---

## One honest trade-off

The bare-VPS version pointed the docroot at a symlink and swapped it — a
single `rename(2)`, genuinely atomic. Under Plesk that fights two things: the
docroot must live inside the webspace and is panel-managed, and Plesk
restricts following symlinks whose owner differs from the link (plus Apache's
`FollowSymLinks` is a per-domain toggle that can be off).

So this version rsyncs into `httpdocs` instead. rsync writes each file to a
temp name and renames it into place, so no individual file is ever served
half-written, but the directory as a whole is briefly inconsistent — a
visitor landing mid-deploy could get new HTML with an old asset. For a static
site this size that window is well under a second.

I judged that worth it to avoid fighting the panel. If you'd rather have true
atomicity, it's possible: set the document root to `current` in Hosting
Settings, make `current` a symlink inside the webspace (owned by the
subscription user, so Plesk's symlink restriction is satisfied), and swap it
instead of rsyncing. Tell me and I'll rework the script — it's a ten-line
change, but it's the kind of thing that breaks on a Plesk upgrade, which is
why it isn't the default.

The property that actually matters — a failed build never reaches the live
site — is unaffected either way.

---

## When it breaks

**`npm: command not found` in the deploy log.**
Plesk doesn't put node on the PATH for deployment actions; the domain's
system user has its own environment. The script prepends
`/opt/plesk/node/<newest>/bin`. If it still fails, the Node.js extension
isn't installed — check `ls /opt/plesk/node/`, or set `PLESK_NODE_BIN`
explicitly in the deploy action.

**Deploy action can't find `/var/www/vhosts/...`, or paths look truncated.**
SSH is still forbidden for the subscription user, so the action is running
chrooted and `/var/www/vhosts/DOMAIN` appears as `/`. Step 2.

**Site is unchanged after a successful-looking push.**
Check the deploy log in the panel. Also confirm the deployment path is `/src`
and not `/httpdocs` — if it's the latter, Plesk is overwriting your docroot
directly and the script is publishing on top of that.

**403 Forbidden, or clean URLs 404.**
"Serve static files directly by nginx" is off, so Apache is handling requests
and the `try_files` block is bypassed. Step 8.

**Everything works over HTTP, breaks on HTTPS.**
Plesk keeps separate nginx directives for the SSL vhost in some versions.
Re-check that the directives field applied to both, and that SSL It! finished
without errors.

---

## What changed from the bare-VPS version

| File | Status |
|---|---|
| `plesk/plesk-deploy.sh` | **New** — the deploy action |
| `plesk/plesk-rollback.sh` | **New** — Plesk-layout rollback |
| `plesk/nginx-directives.conf` | **New** — paste into the panel |
| `scripts/check-build.mjs` | **Unchanged**, still used |
| `github/` | **Unchanged** — GitHub as repo + CI still applies |
| `post-receive` | Obsolete — Plesk's Git extension replaces it |
| `setup-server.sh` | Obsolete — Plesk provisioned the server |
| `nginx-site.conf` | Obsolete — replaced by the panel directives |
| `rollback.sh` | Obsolete — superseded by `plesk-rollback.sh` |

The obsolete files are left in the repo rather than deleted, in case you ever
move to a plain VPS. If that's not on the cards, delete `deploy/post-receive`,
`deploy/setup-server.sh`, `deploy/nginx-site.conf` and `deploy/rollback.sh`
to keep the repo honest about what's actually in use.

Sources: [Plesk: additional deployment actions](https://www.plesk.com/kb/docs/using-remote-git-hosting-enable-additional-deployment-actions/),
[Plesk: custom Apache/nginx config for a domain](https://support.plesk.com/hc/en-us/articles/12377861295895-How-to-add-custom-Apache-nginx-configuration-for-a-domain-in-Plesk),
[Plesk: Apache & nginx settings](https://docs.plesk.com/en-US/obsidian/administrator-guide/website-management/websites-and-domains/hosting-settings/web-server-settings/apache-and-nginx-settings.72320),
[Running npm in Plesk deployment actions](https://jackwhitworth.com/blog/run-npm-composer-in-git-deployment-actions/)
