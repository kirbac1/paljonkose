# Paljonko se on? ("What would that buy?")

Finland's state and municipal spending translated into everyday units.
Neutral by design: every budget line is visible, unit prices are
editable by the reader, and caveats are shown rather than hidden.

Production: **paljonkose.fi**

---

## Structure

- [`files/`](files/README.md) — Express server: `/api/data`, shareable
  `/p/…` pages, `/ylitykset/`, `/kuitti/`, `/summa/`. Also serves the
  homepage (`files/public/`), which is built from `web/` at deploy time
  — `files/public/` no longer has any source of its own. The old
  vanilla-JS homepage has been removed from the repo entirely.
- [`web/`](web/README.md) — React + TypeScript, **the production
  implementation of the homepage**. `npm run build` writes into
  `files/public/`; `deploy.yml` runs this before every release.
- [`deploy/`](deploy/) — GitHub Actions deploy workflow.
- [`DEPLOYMENT.md`](DEPLOYMENT.md), [`READY-TO-DEPLOY.md`](READY-TO-DEPLOY.md) —
  setup and status of the SSH-based automatic deployment.

---

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. See [`files/README.md`](files/README.md)
for what pages exist and how to edit the data.

---

## Testing

```bash
cd files && npm test          # Vitest — render.mjs's calculation functions
cd files && npm run test:e2e  # Playwright — the built React homepage in a real browser
cd web   && npm test          # Vitest — React components and calculation logic
```

Detailed coverage of each test suite:
[`files/README.md`](files/README.md#testing) and
[`web/README.md`](web/README.md#local-testing).

---

## CI/CD

[`.github/workflows/`](.github/workflows/) runs the tests (`test.yml`,
called from both `ci.yml` and `deploy.yml`) on every push and PR.
Pushing to `main`, `deploy.yml` builds `web/` (into `files/public/`),
rsyncs the `files/` directory to the Plesk server, installs dependencies
there, and restarts the app via Passenger.

> **Why you don't see a `web/` directory on the server.** `web/` is
> compiled in the GitHub Actions run (`npm run build` writes into
> `files/public/`), and only `files/` is rsynced to the server —
> `web/`'s source code, its `node_modules`, and its TypeScript files
> never end up there. The server doesn't need Node/npm/Vite to compile
> React, it just serves the already-compiled files from `files/public/`
> (`index.html` + `assets/*.js/css`). Check with:
> `ls ~/paljonkose/current/files/public/` on the server.

## Production

Automatic: push to `main`, check the `Actions` tab. Manual option and
setup instructions: [`DEPLOYMENT.md`](DEPLOYMENT.md). For running via
Docker: [`files/README.md`](files/README.md#production).
