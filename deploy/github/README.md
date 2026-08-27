# Adding GitHub

GitHub joins the setup as **the repo and the safety net**, not as the
deployer. Your server's `post-receive` hook keeps doing the deploying.

```
                    ┌─────────────────────────────────┐
   git push  ──────►│ github.com/you/sillasais         │  code lives here
                    │  └─ Actions: build + check       │  breakage caught here
                    └─────────────────────────────────┘
        │
        └──────────►  server bare repo ──► build ──► live site
                      (post-receive hook)
```

One `git push` reaches both. GitHub tells you if the build is broken; the
server publishes it. If the build is broken, *both* complain — Actions goes
red and the server hook rejects the push — so you cannot end up with a green
badge over a stale site.

---

## Why bother, when the server already builds?

Three concrete reasons, in the order they'll matter to you:

**Off-site backup.** Right now the only copy of this project is your Mac and
a bare repo on a VPS you administer alone. That's one bad `rm -rf` from gone.

**Portfolio surface.** You're applying for software roles in ~6 weeks. A
public repo with real commit history, a green build badge, and a README
explaining the open-data pipeline is a much better artifact than a link to a
site — it's the thing an interviewer can actually read. The daily-entry
cadence shows up as a commit graph, which reads as consistency without you
having to claim it.

**Catching the failure you can't see.** The `check-build.mjs` script that
runs in CI validates that every page's `og:url` and `og:image` are absolute
URLs. That's the one class of bug this site is uniquely exposed to: every
entry is built to be shared, and a relative `og:image` produces a blank
preview card. Nothing errors. The page looks fine. The share just looks
dead — and you'd only find out by posting one and seeing it.

---

## Setup

### 1. Create the repo

```bash
cd /path/to/sillasais

gh repo create sillasais --public --source=. --remote=origin --push
```

No `gh`? Create it in the web UI, then:

```bash
git remote add origin git@github.com:YOU/sillasais.git
git push -u origin main
```

### 2. Copy in the workflow and the checker

From this kit, into your project:

```
.github/workflows/ci.yml     ← github/workflows/ci.yml
scripts/check-build.mjs      ← github/scripts/check-build.mjs
```

```bash
mkdir -p .github/workflows scripts
cp path/to/kit/github/workflows/ci.yml .github/workflows/
cp path/to/kit/github/scripts/check-build.mjs scripts/
git add .github scripts && git commit -m "CI: build check"
```

### 3. Make one push go to both places

```bash
git remote set-url --add --push origin git@github.com:YOU/sillasais.git
git remote set-url --add --push origin USER@SERVER_IP:/srv/sillasais/repo
```

A subtlety worth knowing: the moment you add the *first* push URL, git stops
using the fetch URL for pushes. So you must add **both** lines above, even
though the first one looks redundant. Verify:

```bash
git remote -v
# origin  git@github.com:YOU/sillasais.git       (fetch)
# origin  git@github.com:YOU/sillasais.git       (push)
# origin  USER@SERVER_IP:/srv/sillasais/repo     (push)
```

Now your daily workflow is unchanged from before, minus the extra remote name:

```bash
git add . && git commit -m "27.8. Ukraina-tuki hoitajien palkkoina"
git push
```

### 4. Set SITE_URL in the repo

So CI builds with the same URL the server does:

Settings → Secrets and variables → Actions → **Variables** → New variable

```
SITE_URL = http://YOUR_SERVER_IP        (for now)
SITE_URL = https://sillasais.fi         (once the domain is live)
```

Keep this in sync with `SITE_URL` in the server hook. If they drift, CI
validates URLs the real build never emits.

### 5. Badge for the README

```markdown
![build](https://github.com/YOU/sillasais/actions/workflows/ci.yml/badge.svg)
```

---

## Ordering, when a push fails

Git pushes to the two URLs in sequence. If the server hook rejects the push
because the build failed, **GitHub has already received the commit**. That's
fine and intentional — the commit is safely backed up, the site is untouched,
and Actions will show you the same failure with a readable log.

Fix, commit, push again. Nothing to clean up.

---

## `deploy.yml.disabled`

Also in this kit: a full Actions-deploys-via-rsync workflow. It's disabled
on purpose. Rename it to `deploy.yml` only if you're moving deploys *off*
the server hook — running both means two things race to write the same
document root, and you won't be able to tell which commit is live.

Switch over when you want deploys from a machine that isn't your Mac, or
tests gating the deploy. The header comment in the file has the three steps.
It writes into the same `releases/` + symlink layout, so `rollback.sh` keeps
working either way.

Secrets it needs, if you get there:

| Secret | Value |
|---|---|
| `DEPLOY_SSH_KEY` | Private key of a keypair whose public half is in the server user's `authorized_keys` |
| `DEPLOY_HOST` | Server IP or hostname |
| `DEPLOY_USER` | SSH user |
| `DEPLOY_KNOWN_HOSTS` | Output of `ssh-keyscan -H YOUR_SERVER_IP` |

Generate a deploy-only key rather than reusing your personal one:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/sillasais_deploy -N "" -C "gh-actions-deploy"
ssh-copy-id -i ~/.ssh/sillasais_deploy.pub USER@SERVER_IP
pbcopy < ~/.ssh/sillasais_deploy      # paste as DEPLOY_SSH_KEY
```

---

## A note on the open-data fetches

If your build calls Valtiokonttori / Tilastokeskus APIs at build time, CI
will hit them on every push — including from GitHub's IP ranges, which those
services have never seen from you.

Two things worth doing before that becomes a problem:

- **Give every fetch a timeout.** A hung endpoint should fail the build in
  30 seconds, not hold a runner for ten minutes (or your terminal, on the
  server hook).
- **Cache the fetched data into the repo.** Commit the raw API responses
  as JSON and have the build read those, with a separate `npm run refresh`
  that updates them. Your figures then come from a file you can diff — which
  also happens to satisfy the "readers can see where each number comes from"
  goal, since the provenance is in git history rather than in whatever the
  API returned at build time.

The second one is a bigger change than it sounds and worth doing on its own,
not bundled into the CI setup.
