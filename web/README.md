# Paljonko se on? — user interface

React + TypeScript implementation of the calculator — **the production
implementation of the homepage**. `npm run build` writes into
`../files/public/`, which `deploy.yml` runs on every release. The old
vanilla-JS homepage has been removed from the repo entirely. The server
(`server.mjs`) stays as-is and serves the data at `/api/data` plus the
shareable pages at `/p/…`, `/ylitykset/`, and `/kuitti/`.

## Commands

```bash
npm install
npm run dev        # Vite, port 5173, /api proxied to port 3000
npm test           # Vitest — 24 tests
npm run typecheck  # tsc --noEmit, strict
npm run build      # types + production build
npm run fallback   # writes ../data.json into fallback data
```

`npm run dev` assumes the Express server is running on port 3000.

## Local testing

Two servers run side by side in development — Vite serves this React
app, Express serves the data and the shareable pages.

1. Start the Express server in another terminal, from the project's
   `files/` directory:

   ```bash
   cd ../files
   npm run dev        # port 3000
   ```

2. Start this directory's Vite dev server:

   ```bash
   npm run dev        # port 5173, /api, /p, /ylitykset, /kuitti → :3000
   ```

3. Open <http://localhost:5173>. If port 3000 doesn't respond, the app
   doesn't crash — it shows `data/fallback.ts`'s placeholder figures and
   tells the reader so (the `useData` hook's `stale` state).

Unit tests don't need either server running — they run isolated in jsdom:

```bash
npm test           # lib/calc.test.ts + App.test.tsx, 24 tests
```

## Structure

```
src/
  types.ts              data model — the contract with the server
  i18n.ts               copy and labels, fi/en
  lib/calc.ts           calculation, pure functions
  lib/format.ts         numbers and currency by language
  hooks/useData.ts      data fetching, falls back if the API doesn't respond
  hooks/useLang.ts      language from the path or a query parameter
  components/           presentation, no logic
    SiteLinks.tsx       links to server-rendered pages
  data/fallback.ts      GENERATED — do not edit
```

## Why it's built this way

**Calculation is separate from React.** `lib/calc.ts` doesn't know about
components, so it can be tested without rendering. Ten tests run in 8
milliseconds, which keeps them in active use.

**Empty data is handled explicitly.** `noUncheckedIndexedAccess` is on,
so `items[0]` is `Item | undefined`. The app shows a loading message
instead of crashing on a `!` operator — a runtime bug would otherwise
have shown up in the wrong place.

**Fallback figures are generated.** `data/fallback.ts` is compiled from
`data.json`. A hand-maintained copy would drift, and the gap would only
show up once the API was already down.

**The price field keeps its own string.** Without that, the field can't
be cleared: an empty value would be read as zero, the price would
revert to the unit's own, and the number would reappear mid-keystroke.
A test found this, not a reading of the code.

**Server pages have a test.** `/ylitykset/` and `/kuitti/` aren't React
routes, so nothing crashes if the links disappear in a rewrite. That
happened once — now `App.test.tsx` pins the addresses, and
`../files/tests/e2e/calculator.spec.mjs` actually clicks them open
against the built page. (The `/nostot/` link was removed entirely — it
never had a matching server route.)

**Switching language doesn't reload the page.** An earlier version
navigated straight to `/en/`, which only worked on the server; on a
static host the reader landed on a 404 and the toggle appeared to vanish.

## What the tests cover

- `lib/calc.test.ts` — the division, the fraction shown when a sum is
  smaller than the unit, detecting an edited price, invalid input, the
  per-capita share using an item's own population figure, filtering out
  news items, competing projects, and the `/p/…` link built for a given
  calculation (`comboPath`)
- `App.test.tsx` — renders, reports a failed load, switches language
  both ways, region filtering, the reader's own sum, a small sum gets a
  sensible unit, an edited price resets when the item changes, links to
  server pages and their language-specific addresses

## Still to do

- The `/ylitykset/` and `/kuitti/` routes are still rendered by the
  server. They work, but share logic with `render.mjs`
- No error aggregation, no metrics
