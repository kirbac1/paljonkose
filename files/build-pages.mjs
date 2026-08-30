#!/usr/bin/env node
/**
 * build-pages.mjs — static version: writes every calculation to disk.
 * Uses the same render.mjs module as server.mjs, so the static and
 * dynamic pages are identical.
 *
 *   SITE_URL=https://paljonkose.fi node build-pages.mjs
 */

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { combo, ogSvg, pageHtml, fmt, eur, esc } from "./render.mjs";

const SITE = (process.env.SITE_URL || "https://paljonkose.fi").replace(/\/$/, "");
const OUT  = process.env.OUT_DIR || "dist";
const data = JSON.parse(await fs.readFile("data.json", "utf8"));

let fontFiles = [];
if (existsSync("fonts")) {
  fontFiles = (await fs.readdir("fonts"))
    .filter(f => /\.(ttf|otf)$/i.test(f))
    .map(f => path.resolve("fonts", f));
}
console.log(fontFiles.length ? `Fonts: ${fontFiles.length} custom` : "Fonts: system fonts");

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(`${OUT}/p`, { recursive: true });

const built = [];
for (const item of data.items) {
  for (const unit of data.units) {
    const c = combo(data, item.id, unit.id);
    if (c) built.push(c);
  }
}

for (const c of built) {
  const dir = `${OUT}/p/${c.slug}`;
  await fs.mkdir(dir, { recursive: true });

  const also = built
    .filter(x => x.item.id === c.item.id && x.slug !== c.slug)
    .slice(0, 4);

  await fs.writeFile(`${dir}/index.html`, pageHtml(c, data, { site: SITE, also }), "utf8");
  await fs.writeFile(`${dir}/og.png`, new Resvg(ogSvg(c), {
    font: { loadSystemFonts: true, fontFiles, defaultFontFamily: "DejaVu Sans" },
    fitTo: { mode: "width", value: 1200 }
  }).render().asPng());
}

const groups = data.items.map(it => {
  const rows = built.filter(b => b.item.id === it.id)
    .map(b => `<a href="${SITE}/p/${b.slug}/"><b>${fmt(b.count)}</b> ${esc(b.unit.label)}</a>`).join("\n");
  return `<section><h2>${esc(it.label)} — ${esc(eur(it.amount))}</h2>\n${rows}</section>`;
}).join("\n");

await fs.writeFile(`${OUT}/p/index.html`, `<!DOCTYPE html>
<html lang="fi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kaikki laskutoimitukset — Paljonko se on?</title>
<meta name="description" content="Jokainen laskutoimitus omalla sivullaan: summa, yksikkö, lähde ja jakolasku näkyvissä.">
<style>
body{background:#FFD84D;color:#17123A;font-family:system-ui,sans-serif;margin:0}
.w{max-width:620px;margin:0 auto;padding:24px 18px 60px}
h1{font-size:34px;margin:0 0 6px}p.s{color:rgba(23,18,58,.6);margin:0 0 26px}
section{background:#fff;border-radius:22px;padding:18px;margin-bottom:14px}
h2{font-size:15px;text-transform:uppercase;letter-spacing:.04em;margin:0 0 10px}
a{display:block;padding:9px 0;color:#17123A;text-decoration:none;border-bottom:1px solid rgba(23,18,58,.09);font-size:15px}
a:last-child{border:0}a:hover{color:#FF4A6E}b{color:#FF4A6E}
</style></head><body><div class="w">
<h1>Kaikki laskutoimitukset</h1>
<p class="s">${built.length} sivua. Jokaisella oma osoite, oma jakokuva ja näkyvät lähteet.</p>
${groups}
</div></body></html>`, "utf8");

await fs.writeFile(`${OUT}/sitemap.xml`,
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc></url>
  <url><loc>${SITE}/p/</loc></url>
${built.map(b => `  <url><loc>${SITE}/p/${b.slug}/</loc><lastmod>${data.generated.slice(0,10)}</lastmod></url>`).join("\n")}
</urlset>`, "utf8");

console.log(`\nDone: ${built.length} pages + images → ${OUT}/`);
