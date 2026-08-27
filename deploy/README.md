# Push-to-deploy for sillasais.fi

`git push production main` → the server builds the commit and swaps the live
site to it. No GitHub, no CI service, no secrets stored anywhere but your
own SSH key.

---

## How it works

The server holds a **bare git repo** at `/srv/sillasais/repo`. It has no
working tree — it exists only to receive pushes. Git runs its
`hooks/post-receive` script after every accepted push, and that script does
the deploy.

```
your Mac                          server
────────                          ──────
git push production main   ──►    /srv/sillasais/repo          (bare repo)
                                         │
                                    post-receive fires
                                         │
                                         ▼
                                  releases/20260827-104233-a1b2c3d/
                                         │  git archive → npm ci → npm run build
                                         ▼
                                  current ──► that release's dist/
                                         ▲
                                  nginx serves this symlink
```

Two properties worth understanding, because they are why this shape was
chosen over "ssh in and git pull":

**The build gates the swap.** `current` only moves after the build exits 0
*and* `dist/` is non-empty. A commit that fails to build makes `git push`
report an error and leaves yesterday's site untouched. You cannot break the
live site by pushing bad code — only fail to update it.

**The swap is atomic.** `current` is a symlink, replaced with
`ln` + `mv -T`, which is a single `rename(2)` syscall. There is no instant
where a visitor sees a half-copied site. Compare this to rsyncing into the
live directory, where a visitor mid-deploy gets new HTML referencing CSS
that has not landed yet.

---

## One-time setup

### 1. On the server

```bash
scp -r deploy/ user@YOUR_SERVER_IP:~/deploy-kit
ssh user@YOUR_SERVER_IP
bash ~/deploy-kit/setup-server.sh
```

The script installs git/node/nginx if missing, creates the layout, installs
the hook and the nginx site, and serves a placeholder page so you can
confirm nginx works before involving the build at all.

Visit `http://YOUR_SERVER_IP`. You should see "Server is up." If you do not,
fix that before going further — it is a much easier problem to debug alone.

### 2. Install the rollback helper

```bash
cp ~/deploy-kit/rollback.sh /srv/sillasais/rollback.sh
chmod +x /srv/sillasais/rollback.sh
```

### 3. On your Mac

```bash
cd /path/to/sillasais
git remote add production user@YOUR_SERVER_IP:/srv/sillasais/repo
git push production main
```

Watch the output. The build runs server-side and its log streams back over
the SSH connection, so you see `npm run build` happening in your terminal.

---

## Daily use

```bash
# write today's entry
git add . && git commit -m "27.8. Ukraina-tuki hoitajien palkkoina"
git push production main
```

That is the whole workflow. Roughly 20–60 seconds depending on how much
`npm ci` has to do.

If you also push to GitHub for backup, make `git push` do both:

```bash
git remote set-url --add --push origin git@github.com:you/sillasais.git
git remote set-url --add --push origin user@YOUR_SERVER_IP:/srv/sillasais/repo
```

Now a plain `git push` goes to GitHub *and* deploys.

---

## Attaching the domain later

Nothing above depends on the domain, which is deliberate — you can run the
site on the bare IP for as long as you like.

When you settle on the name:

```bash
# 1. A record: YOURDOMAIN.fi → YOUR_SERVER_IP  (and www, if you want it)
# 2. wait for propagation:  dig +short YOURDOMAIN.fi

# 3. on the server:
sudo certbot --nginx -d YOURDOMAIN.fi -d www.YOURDOMAIN.fi
```

certbot edits the nginx config in place, adds the 443 block, and sets up
auto-renewal. Do not pre-write TLS config by hand.

```bash
# 4. update the absolute URL used in og:/canonical tags
sudo nano /srv/sillasais/repo/hooks/post-receive     # SITE_URL=...

# 5. rebuild so the tags pick it up
git commit --allow-empty -m "rebuild for domain" && git push production main
```

Then re-check one entry page in a card validator. Broken previews after a
domain switch are silent — nothing errors, the share just looks wrong.

---

## Rollback

```bash
ssh user@YOUR_SERVER_IP
bash /srv/sillasais/rollback.sh
```

Lists the last five releases and swaps to the one you pick. Instant, since
every release is a complete built tree.

A rollback is temporary: the next push supersedes it. To make it permanent,
revert the commit in git and push.

---

## When it breaks

**`node: command not found` during the hook, but node works when you SSH in.**
The classic one. Git hooks get a stripped environment with no login shell,
so nvm/fnm/asdf are never loaded. The hook tries to source them anyway, but
the reliable fix is a system-wide Node (which `setup-server.sh` installs via
NodeSource) rather than a per-user version manager.

**Push succeeds, site does not change.**
Check you pushed `main` — the hook ignores every other branch and says so in
the output. Also confirm with `readlink /srv/sillasais/current`.

**403 Forbidden from nginx.**
The worker (`www-data`) cannot traverse into `/srv/sillasais`. `setup-server.sh`
does `chmod o+x` on both, but a restrictive umask on release dirs can
reintroduce it: `chmod -R o+rX /srv/sillasais/releases`.

**Disk filling up.**
`KEEP_RELEASES=5` in the hook, and `node_modules` is deleted after each
build. If it still grows, something in your build writes outside `dist/`.

**Build hangs on push.**
It is running server-side with your terminal attached — Ctrl-C aborts the
push cleanly and the old release stays live. Check for a build step waiting
on interactive input, or an API call to Valtiokonttori/Tilastokeskus with no
timeout. Give those fetches a timeout: a hung open-data endpoint should fail
the build, not hold your terminal for an hour.

---

## GitHub

See [`github/README.md`](github/README.md). Short version: GitHub is the repo
and the CI safety net, the server hook stays the deployer, and one `git push`
reaches both.

There is also an Actions-deploys-via-rsync workflow in there, disabled by
default, for if you later want deploys from a machine that isn't your Mac.
It writes into the same `releases/` + symlink layout, so `rollback.sh` keeps
working either way. Do not run both at once — two things racing to write the
same document root means you can't tell which commit is live.
