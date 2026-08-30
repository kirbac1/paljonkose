#!/usr/bin/env node
/**
 * server.mjs — dynaaminen versio omalle palvelimelle.
 *
 * Mitä tämä lisää staattiseen versioon:
 *   • mikä tahansa kombinaatio renderöidään lennossa, myös lukijan
 *     itse muuttamalla yksikköhinnalla → /p/pma-hoit-52000/
 *   • jakokuva generoidaan samalle URLille → linkkiesikatselu on oikein
 *   • kevyt jakolaskuri, jonka avulla näet mikä vertailu oikeasti leviää
 *
 * Ei tietokantaa. Laskurit kirjoitetaan levylle JSON-tiedostoon.
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

/* Passenger ei takaa työhakemistoa, joten kaikki polut lasketaan tämän
   tiedoston sijainnista. Suhteellinen polku toimii kehityksessä ja
   hajoaa tuotannossa — hiljaa, koska cwd voi olla mikä tahansa. */
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const P = (...xs) => path.join(ROOT, ...xs);

const PORT  = process.env.PORT || 3000;
const SITE  = (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const STATS = process.env.STATS_FILE || "./stats.json";

/* ── data, uudelleenladattava ilman uudelleenkäynnistystä ─────────────── */
let DATA = JSON.parse(await fs.readFile(P("data.json"), "utf8"));
async function reload() {
  DATA = JSON.parse(await fs.readFile(P("data.json"), "utf8"));
  ogCache.clear();
  console.log("data.json ladattu uudelleen:", DATA.generated);
}

/* ── fontit ───────────────────────────────────────────────────────────── */
let fontFiles = [];
if (existsSync("fonts")) {
  fontFiles = (await fs.readdir("fonts"))
    .filter(f => /\.(ttf|otf)$/i.test(f))
    .map(f => path.resolve("fonts", f));
}

/* ── kuvavälimuisti: sama URL renderöidään kerran ─────────────────────── */
const ogCache = new Map();
const OG_MAX  = 500;

function renderOg(c) {
  // avaimessa on kieli, muuten englanninkielinen sivu saisi suomenkielisen kuvan
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

/* ── jakolaskuri ──────────────────────────────────────────────────────── */
let stats = {};
try { stats = JSON.parse(await fs.readFile(STATS, "utf8")); } catch {}
let dirty = false;
setInterval(async () => {
  if (!dirty) return;
  dirty = false;
  try { await fs.writeFile(STATS, JSON.stringify(stats), "utf8"); }
  catch (e) { console.warn("stats-kirjoitus epäonnistui:", e.message); }
}, 30_000);

const bump = (slug, key) => {
  stats[slug] ??= { views: 0, shares: 0 };
  stats[slug][key]++;
  dirty = true;
};

/* ── reitit ───────────────────────────────────────────────────────────── */
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "4kb" }));

/** Slug: {item}-{unit} tai {item}-{unit}-{oma hinta}.
 *  Tunnukset voivat itse sisältää väliviivan (tre-ratikka), joten
 *  ei arvata erotinta vaan sovitetaan tunnettuihin tunnuksiin,
 *  pisin osuma ensin. */
function parseSlug(slug, lang = DEFAULT_LANG) {
  let rest = String(slug), cost = null;

  const m = rest.match(/-(\d+)$/);
  if (m) {
    const withoutNum = rest.slice(0, -m[0].length);
    // luku on hinta vain jos loppuosa on kelvollinen ilman sitä
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

  // Express kohtelee /p/x ja /p/x/ samana reittinä, joten yksi käsittelijä riittää.
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

/** Mikä vertailu leviää — käytä tätä päivän merkinnän valintaan. */
app.get("/api/top", (req, res) => {
  const top = Object.entries(stats)
    .map(([slug, s]) => ({ slug, ...s }))
    .sort((a, b) => b.shares - a.shares || b.views - a.views)
    .slice(0, 20);
  res.json({ generated: DATA.generated, top });
});

app.get("/api/data", (req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json(DATA);
});

/** Kutsu tätä kun fetch-data.mjs on ajettu (cron / systemd timer). */
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

/* Reitit rakennetaan kielittäin samasta käsittelijästä. Yksi määrittely,
   kaksi kieltä — muuten polut ehtivät erkaantua toisistaan. */
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

// staattinen etusivu ja muut tiedostot
/* Etusivu molemmilla kielillä samasta tiedostosta. Sivu lukee kielen
   polusta, joten /en/ on jaettava osoite eikä selaimen sisäinen tila. */
app.get("/en/", (req, res) => res.sendFile(P("public", "index.html")));

app.use(express.static(P("public"), { extensions: ["html"], maxAge: "1h" }));

app.listen(PORT, () => {
  console.log(`Käynnissä: ${SITE} (portti ${PORT})`);
  console.log(`Juuri: ${ROOT}`);
  console.log(`Data: ${DATA.items.length} menoerää × ${DATA.units.length} yksikköä`);
});
