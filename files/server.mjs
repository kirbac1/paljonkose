#!/usr/bin/env node
/**
 * server.mjs — dynamic version, for your own server.
 *
 * What this adds over the static version:
 *   • any combination is rendered on the fly, including the reader's
 *     own edited unit price → /p/pma-hoit-52000/
 *   • the share image is generated for that exact URL → the link preview is correct
 *   • a lightweight share counter, so you can see which comparisons actually spread
 *
 * No database. Counters are written to a JSON file on disk.
 *
 *   npm install
 *   node fetch-data.mjs
 *   PORT=3000 SITE_URL=https://paljonkose.fi node server.mjs
 */

import express from "express";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { combo, ogSvg, pageHtml, fmt, eur, ylityksetHtml, kuittiHtml, summaHtml } from "./render.mjs";
import { PATHS, LANGS, DEFAULT_LANG } from "./i18n-ui.mjs";

/* Passenger doesn't guarantee a working directory, so every path is
   computed from this file's own location. A relative path works in
   development and silently breaks in production, since cwd can be anything. */
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const P = (...xs) => path.join(ROOT, ...xs);

/* Passenger passes only the variables configured in the Plesk panel, so a
   deploy could not carry its own settings. Loading .env here means config
   travels with the release. Node 20.12+ has this built in — no dependency.
   Absent or unreadable .env is fine; process.env still wins over it. */
try {
  process.loadEnvFile(P(".env"));
} catch {
  // no .env in this release, or it is not readable — fall through to defaults
}

const PORT  = process.env.PORT || 3000;
const STATS = process.env.STATS_FILE || "./stats.json";

/* SITE is baked into canonical links, og:url and og:image, so getting it
   wrong is not cosmetic: it tells search engines the wrong address and makes
   every shared link preview point somewhere that does not exist. Production
   ran for months without SITE_URL set, emitting http://localhost:3000 into
   every share page — hence the loud warning rather than a silent default. */
const SITE_URL_RAW = (process.env.SITE_URL || "").trim();
if (!SITE_URL_RAW) {
  console.warn(
    "SITE_URL is not set. Falling back to localhost — canonical URLs, " +
    "og:url and og:image will all be wrong outside local development."
  );
} else if (!/^https?:\/\//i.test(SITE_URL_RAW)) {
  console.warn(`SITE_URL=${SITE_URL_RAW} has no http(s):// scheme and will be ignored.`);
}

const SITE = (
  /^https?:\/\//i.test(SITE_URL_RAW) ? SITE_URL_RAW : `http://localhost:${PORT}`
).replace(/\/$/, "");

/* One address, so the site does not compete with itself in search results.
   Any other host that reaches this app is redirected to the canonical one. */
const CANONICAL_HOST = (() => {
  try {
    return new URL(SITE).host;
  } catch {
    return null;
  }
})();

/* ── data, reloadable without a restart ────────────────────────────── */
let DATA = JSON.parse(await fs.readFile(P("data.json"), "utf8"));
async function reload() {
  DATA = JSON.parse(await fs.readFile(P("data.json"), "utf8"));
  ogCache.clear();
  console.log("data.json reloaded:", DATA.generated);
}

/* ── fonts ────────────────────────────────────────────────────────────── */
let fontFiles = [];
if (existsSync("fonts")) {
  fontFiles = (await fs.readdir("fonts"))
    .filter(f => /\.(ttf|otf)$/i.test(f))
    .map(f => path.resolve("fonts", f));
}

/* ── image cache: the same URL is rendered once ────────────────────── */
const ogCache = new Map();
const OG_MAX  = 500;

function renderOg(c) {
  // language is part of the key, otherwise the English page would get the Finnish image
  const key = `${c.lang || DEFAULT_LANG}:${c.slug}`;
  if (ogCache.has(key)) return ogCache.get(key);
  const png = new Resvg(ogSvg(c), {
    font: { loadSystemFonts: true, fontFiles, defaultFontFamily: "DejaVu Sans" },
    fitTo: { mode: "width", value: 1200 }
  }).render().asPng();
  if (ogCache.size >= OG_MAX) ogCache.delete(ogCache.keys().next().value);
  ogCache.set(key, png);
  return png;
}

/* ── share counter ────────────────────────────────────────────────── */
let stats = {};
try { stats = JSON.parse(await fs.readFile(STATS, "utf8")); } catch {}
let dirty = false;
setInterval(async () => {
  if (!dirty) return;
  dirty = false;
  try { await fs.writeFile(STATS, JSON.stringify(stats), "utf8"); }
  catch (e) { console.warn("writing stats failed:", e.message); }
}, 30_000);

const bump = (slug, key) => {
  stats[slug] ??= { views: 0, shares: 0 };
  stats[slug][key]++;
  dirty = true;
};

/* ── routes ───────────────────────────────────────────────────────────── */
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "4kb" }));

/* Redirect every other hostname to the canonical one, before any route runs.
   paljonkose.kirbac.fi and paljonkose.fi both reach this app and served
   identical content, which splits search ranking between two addresses.

   Localhost and bare IPs are left alone so development and the server's own
   health probe keep working, and /healthz is exempt for the same reason —
   a monitor hitting it by IP should get a body, not a 301. */
app.use((req, res, next) => {
  if (!CANONICAL_HOST || req.path === "/healthz") return next();

  const host = (req.headers.host || "").toLowerCase();
  const isLocal = !host || /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) ||
                  /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(host);

  if (isLocal || host === CANONICAL_HOST.toLowerCase()) return next();

  res.set("Cache-Control", "public, max-age=3600");
  return res.redirect(301, `${SITE}${req.originalUrl}`);
});

/** Slug: {item}-{unit} or {item}-{unit}-{own price}.
 *  The ids can themselves contain a hyphen (tre-ratikka), so instead of
 *  guessing the separator, match against known ids, longest match first. */
function parseSlug(slug, lang = DEFAULT_LANG) {
  let rest = String(slug), cost = null;

  const m = rest.match(/-(\d+)$/);
  if (m) {
    const withoutNum = rest.slice(0, -m[0].length);
    // the number is a price only if the remainder is valid without it
    if (matchIds(withoutNum)) { cost = Number(m[1]); rest = withoutNum; }
  }

  const ids = matchIds(rest);
  return ids ? combo(DATA, ids.itemId, ids.unitId, cost, lang) : null;
}

function matchIds(slug) {
  const items = DATA.items.map(i => i.id).sort((a, b) => b.length - a.length);
  const units = DATA.units.map(u => u.id).sort((a, b) => b.length - a.length);
  for (const itemId of items) {
    if (!slug.startsWith(itemId + "-")) continue;
    const tail = slug.slice(itemId.length + 1);
    for (const unitId of units) if (tail === unitId) return { itemId, unitId };
  }
  return null;
}

for (const lang of LANGS) {
  const B = PATHS[lang].root;

  app.get(`${B}/p/:slug/og.png`, (req, res) => {
    const c = parseSlug(req.params.slug, lang);
    if (!c) return res.status(404).end();
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(renderOg(c));
  });

  // Express treats /p/x and /p/x/ as the same route, so one handler is enough.
  app.get(`${B}/p/:slug`, (req, res) => {
    const c = parseSlug(req.params.slug, lang);
    if (!c) return res.status(404).send(
      lang === "en" ? "Unknown calculation" : "Tuntematon laskutoimitus");

    const also = DATA.units
      .filter(u => u.id !== c.unit.id)
      .map(u => combo(DATA, c.item.id, u.id, null, lang))
      .filter(Boolean)
      .sort((a, b) => (stats[b.slug]?.shares || 0) - (stats[a.slug]?.shares || 0))
      .slice(0, 4);

    bump(c.slug, "views");
    res.set("Cache-Control", "public, max-age=600");
    res.send(pageHtml(c, DATA, { site: SITE, also }));
  });
}

app.post("/api/share/:slug", (req, res) => {
  const c = parseSlug(req.params.slug);
  if (!c) return res.status(404).json({ ok: false });
  bump(c.slug, "shares");
  res.json({ ok: true, shares: stats[c.slug].shares });
});

/** Which comparison is spreading — use this to pick the day's entry. */
app.get("/api/top", (req, res) => {
  const top = Object.entries(stats)
    .map(([slug, s]) => ({ slug, ...s }))
    .sort((a, b) => b.shares - a.shares || b.views - a.views)
    .slice(0, 20);
  res.json({ generated: DATA.generated, top });
});

app.get("/api/data", (req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  /* `site` is the canonical address, so the browser can build share links
     that always point at it. Without this the frontend can only use
     location.origin, and a reader who arrived on an alternate hostname
     would copy links pointing back at that alternate. */
  res.json({ ...DATA, site: SITE });
});

/** Call this once fetch-data.mjs has run (cron / systemd timer). */
app.post("/api/reload", async (req, res) => {
  if (process.env.RELOAD_TOKEN &&
      req.get("x-token") !== process.env.RELOAD_TOKEN) {
    return res.status(403).json({ ok: false });
  }
  await reload();
  res.json({ ok: true, generated: DATA.generated });
});

app.get("/sitemap.xml", (req, res) => {
  const urls = [];
  for (const i of DATA.items)
    for (const u of DATA.units) {
      const c = combo(DATA, i.id, u.id);
      if (c) {
        const lm = DATA.generated.slice(0, 10);
        urls.push(`  <url><loc>${SITE}/p/${c.slug}/</loc><lastmod>${lm}</lastmod></url>`);
        urls.push(`  <url><loc>${SITE}/en/p/${c.slug}/</loc><lastmod>${lm}</lastmod></url>`);
      }
    }
  res.type("application/xml").send(
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc></url>
  <url><loc>${SITE}/ylitykset/</loc></url>
  <url><loc>${SITE}/kuitti/</loc></url>
  <url><loc>${SITE}/summa/</loc></url>
  <url><loc>${SITE}/en/</loc></url>
  <url><loc>${SITE}/en/overruns/</loc></url>
  <url><loc>${SITE}/en/tax-receipt/</loc></url>
  <url><loc>${SITE}/en/sum/</loc></url>
${urls.join("\n")}
</urlset>`);
});

/* Routes are built per language from the same handler. One definition,
   two languages — otherwise the paths would drift apart from each other. */
for (const lang of LANGS) {
  const p = PATHS[lang], B = p.root;

  app.get(`${B}/${p.overruns}/`, (req, res) =>
    res.type("html").send(ylityksetHtml(DATA, { site: SITE, lang })));

  const kuitti = (v, res) => {
    const a = parseInt(String(v || "").replace(/\D/g, ""), 10);
    res.type("html").send(kuittiHtml(DATA,
      Number.isFinite(a) && a > 0 ? Math.min(a, 5_000_000) : null, { site: SITE, lang }));
  };
  app.get(`${B}/${p.receipt}/`, (req, res) => kuitti(null, res));
  app.get(`${B}/${p.receipt}/:ansio/`, (req, res) => kuitti(req.params.ansio, res));

  const summa = (v, res) => {
    const n = parseInt(String(v || "").replace(/\D/g, ""), 10);
    res.type("html").send(summaHtml(DATA,
      Number.isFinite(n) ? Math.min(n, 1e12) : 0, { site: SITE, lang }));
  };
  app.get(`${B}/${p.sum}/`, (req, res) => summa(null, res));
  app.get(`${B}/${p.sum}/:summa/`, (req, res) => summa(req.params.summa, res));
}


app.get("/healthz", (req, res) => res.json({ ok: true, generated: DATA.generated }));

// the static homepage and other files
/* The homepage in both languages from the same file. The page reads the
   language from the path, so /en/ has to be a shareable address, not
   browser-internal state. */
app.get("/en/", (req, res) => res.sendFile(P("public", "index.html")));

app.use(express.static(P("public"), { extensions: ["html"], maxAge: "1h" }));

app.listen(PORT, () => {
  console.log(`Running: ${SITE} (port ${PORT})`);
  console.log(`Root: ${ROOT}`);
  console.log(`Data: ${DATA.items.length} items × ${DATA.units.length} units`);
});
