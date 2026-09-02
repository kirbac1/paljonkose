# Paljonko se on? ("What would that buy?")

Finland's state and municipal spending translated into everyday units.
Neutral by design: every budget line is visible, unit prices are
editable by the reader, and caveats are shown rather than hidden.

Production: **paljonkose.fi**

> `public/` is now [`../web/`](../web/README.md)'s build output —
> `npm run build` there writes this directory, and its contents aren't
> edited by hand. The old vanilla-JS homepage has been removed from the
> repo entirely. This directory's Express server (`server.mjs`,
> `render.mjs`, `/api/data`) serves both the React build and these
> other routes.

---

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. That's it — `data.json` is already in the repo.

---

## What to look at

- `/` — homepage: pick a spending item and a unit, enter your own sum, watch the ticker
- `/ylitykset/` — estimate vs. actual, median overrun factor
- `/kuitti/45000/` — tax receipt: where your income tax actually goes
- `/summa/340000000/` — turn any sum into everyday units
- `/p/lansirata-pk/` — a page showing both the overrun forecast and competing projects
- `/p/ark-burgeri-pork/` — a everyday-purchase comparison and its ×5.6M bridge
- `/sitemap.xml` — all 282 pages

---

## Commands

- `npm run dev` — dev server on port 3000
- `npm run data` — fetches figures from the APIs, writes `data.json`
- `npm run pages` — builds static pages into `dist/`
- `npm run build` — `data` + `pages`
- `npm start` — production server (reads `PORT` and `SITE_URL` from the environment)

---

## Languages

The site is bilingual. English pages live under the `/en/` prefix and
use English-language paths, so the address itself is readable:

| Finnish | English |
|---|---|
| `/` | `/en/` |
| `/ylitykset/` | `/en/overruns/` |
| `/kuitti/45000/` | `/en/tax-receipt/45000/` |
| `/summa/340000000/` | `/en/sum/340000000/` |
| `/p/pma-hoit/` | `/en/p/pma-hoit/` |

Translations live in two files:

- `i18n-data.mjs` — labels for spending items, units, and top-level categories
- `i18n-ui.mjs` — UI copy and paths

The homepage is **one file** that reads the language from the path. Two
separate HTML files would drift apart after the first change to either.

When you add a spending item or a unit, add its translation to
`i18n-data.mjs`. A missing translation doesn't break anything — the
page falls back to the Finnish label, which is more noticeable than a
blank spot.

## Files

- `server.mjs` — Express server, all routes
- `render.mjs` — **shared rendering**; both the server and the static build use this, so pages are always identical
- `fetch-data.mjs` — fetches the data and writes `data.json`. **Every figure, unit price, and top-level category is defined here**
- `data.json` — generated, but committed, so the site works without the APIs
- `public/` — the homepage the server serves. Build output from `../web/`, no source of its own
- `build-pages.mjs` — static generator (optional)
- `Dockerfile`, `docker-compose.yml`, `nginx-paljonkose.conf` — production

---

## Editing the data

All figures live in `fetch-data.mjs`, not in `data.json`.

- Add a spending item → `PLAN.items`
- Add a unit → `PLAN.units`
- Give the original cost estimate → `arvio: <number>`. The script
  automatically creates an overrun entry and updates the median factor
- Mark projects competing for the same funding → same `paatos:` tag

After a change:

```bash
npm run data
```

The React homepage (`../web/`) has its own, separate fallback-data
mechanism — see [`web/README.md`](../web/README.md#structure)
(`data/fallback.ts`, `npm run fallback`). It isn't directly tied to
this data-editing step, but it's worth updating alongside if you change
`PLAN.items`/`PLAN.units`.

---

## Testing

Unit tests (Vitest) cover `render.mjs`'s calculation functions
(`combo`, `verokuitti`, `fmt`, `eur`, `esc`):

```bash
npm test
```

Browser tests (Playwright) start `server.mjs` and exercise the homepage
calculator — every spending item, region chips, entering your own sum,
editing the unit price, and the share button — in a real browser. These
run against the React build compiled into `public/`; run `npm run
build` in `../web/` first if you haven't yet:

```bash
npx playwright install --with-deps chromium   # once
npm run test:e2e
```

---

## Production

```bash
echo "RELOAD_TOKEN=$(openssl rand -hex 16)" > .env
docker compose up -d
curl localhost:3000/healthz
```

Then the reverse proxy and certificate:

```bash
sudo cp nginx-paljonkose.conf /etc/nginx/sites-available/paljonkose.fi
sudo ln -s /etc/nginx/sites-available/paljonkose.fi /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d paljonkose.fi -d www.paljonkose.fi
```

Compose brings up two containers:

- `web` — the server
- `updater` — fetches figures once a day and calls `/api/reload`.
  No restart, no downtime

---

## Before publishing

These are real blockers, not polish.

- [ ] **Run `npm run data` on the server and read the output.** It's
      the only place you'll see whether the figures came from the API
      or fell back to placeholder values. The network was blocked in
      the sandbox, so nothing has been tested against the real API
- [ ] **Check the tax bracket table in `render.mjs`'s `ASTEIKKO_2026`.**
      A wrong bracket is a worse error than a wrong daycare price,
      because the reader compares it to their own tax card and notices
      the difference immediately
- [ ] **Check every TARKISTA ("verify") marker** in `fetch-data.mjs` —
      city budgets, the Tampere arena, the Turku tram
- [ ] Confirm the West Metro's final cost (1,088 vs. 1,186 M€, litigation
      ongoing)
- [ ] Confirm Valtiokonttori's budget-item codes and StatFin's table IDs
- [ ] Find the municipal finance table for looking up city budgets
- [ ] Check the top-level category breakdown — currently entered by hand, sums to 91.3 bn €
- [ ] Add brand fonts to the `./fonts/` directory so share images match the page
- [ ] Set `RELOAD_TOKEN` in the `.env` file
- [ ] Have someone who knows tax law read the tax-receipt feature. It's
      the only place on the site that claims something about the
      reader's own money, and so the first thing that will be
      criticized

---

## Design principles

These aren't opinions — they're the reasons the code is the way it is.
Worth reading before changing them.

- **Every figure carries its provenance.** The page shows where a
  figure came from, when, and whether it's official or an estimate
- **Unit prices are editable.** The reader is allowed to disagree, and
  an edited price shows up all the way into the share image
- **Caveats are visible.** Fungibility especially: money isn't freely
  transferable between administrative branches. Comparing a fighter jet
  to a daycare center isn't a real choice, and the page says so itself
- **Real comparisons are set apart.** Four rail projects compete for
  the same funding — only in that box does it say the comparison is real
- **The overrun register includes under-runs.** The Rantatunneli tunnel
  (0.98×) sits alongside the Crown Bridges (2.11×). Without it, the
  whole register would be open to a charge of cherry-picking an agenda
- **Median, not average**, so one runaway project doesn't skew the picture
- **No personal-consumption comparisons.** Comparing everyday purchases
  ("a kilo of carrots instead of a burger") was tried and removed: it
  turns the site from examining public money into judging individual
  choices, which is a different kind of argument and costs the rest of
  the content its credibility
