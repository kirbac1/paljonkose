import { t as T, paths as P, DEFAULT_LANG } from "./i18n-ui.mjs";
import { ASUKAS_EN } from "./i18n-data.mjs";

/* Kielikohtainen nimike. Puuttuva käännös putoaa takaisin suomeen —
   näkyvä suomenkielinen sana on parempi kuin tyhjä kohta. */
const L  = (o, lang) => (lang === "en" && o.label_en) ? o.label_en : o.label;
const N  = (o, lang) => (lang === "en" && o.note_en  != null) ? o.note_en : (o.note || "");
const fmtL = (n, lang) => new Intl.NumberFormat(T(lang).locale).format(n);
const eurL = (a, lang) => a >= 1e9
  ? (a / 1e9).toLocaleString(T(lang).locale, { maximumFractionDigits: 1 }) + (lang === "en" ? " bn €" : " mrd €")
  : (a / 1e6).toLocaleString(T(lang).locale, { maximumFractionDigits: 0 }) + (lang === "en" ? " M€" : " M€");
const base = (lang) => P(lang).root;

/**
 * render.mjs — yhteinen renderöinti.
 * Sekä build-pages.mjs (staattinen) että server.mjs (dynaaminen) käyttävät tätä,
 * joten esirenderöity ja lennossa tehty sivu ovat aina identtiset.
 */

export const fmt = n => new Intl.NumberFormat("fi-FI").format(n);

export const eur = a => a >= 1e9
  ? (a / 1e9).toLocaleString("fi-FI", { maximumFractionDigits: 1 }) + " mrd €"
  : (a / 1e6).toLocaleString("fi-FI", { maximumFractionDigits: 0 }) + " M€";

export const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const STATUS = {
  rajapinta: "haettu rajapinnasta",
  kasin:     "kirjattu käsin tiedotteesta",
  arvio:     "oma suuruusluokka-arvio",
  varaluku:  "varaluku",
  muokattu:  "lukijan muuttama"
};

/** Laskee yhden kombinaation. cost voi olla lukijan oma arvo. */
const ASUKAS = {
  valtio:   "jokaista suomalaista",
  helsinki: "jokaista helsinkiläistä",
  tampere:  "jokaista tamperelaista",
  turku:    "jokaista turkulaista",
  oulu:     "jokaista oululaista"
};

export function combo(data, itemId, unitId, cost = null, lang = DEFAULT_LANG) {
  const item = data.items.find(i => i.id === itemId);
  const unit = data.units.find(u => u.id === unitId);
  if (!item || !unit) return null;
  // rekisteriin lisätty vertailukohta ei ole budjettimeno — ei omaa sivua
  if (item.vainRekisteri) return null;

  const usedCost = cost && cost > 0 ? cost : unit.cost;
  const edited   = Math.abs(usedCost - unit.cost) > 0.001;
  const count    = Math.floor(item.amount / usedCost);
  if (count < 1) return null;

  return {
    item, unit,
    cost: usedCost,
    edited,
    count,
    jaa: item.amount - count * usedCost,
    vakiluku: item.vakiluku ?? data.vakiluku,
    lang,
    asukas: lang === "en"
      ? (ASUKAS_EN[item.scope] || "every resident")
      : (ASUKAS[item.scope] || "jokaista asukasta"),
    per: (item.amount / (item.vakiluku ?? data.vakiluku))
           .toLocaleString(T(lang).locale, { maximumFractionDigits: 0 }) + " €",
    tuleva: !!item.tuleva,
    /* Saman päätöksen sisäinen vertailu. Tässä raha oli oikeasti
       vaihtoehtoista: hankkeet kilpailevat samasta määrärahasta.
       Tämä on rehellisempi vertailu kuin hävittäjä vs. päiväkoti. */
    kilpailijat: item.paatos
      ? data.items
          .filter(x => x.paatos === item.paatos && x.id !== item.id)
          .map(x => ({ id:x.id, label:x.label, label_en:x.label_en, amount:x.amount,
                       kerta: x.amount ? item.amount / x.amount : null }))
          .sort((a,b) => b.amount - a.amount)
      : [],
    ennuste: (item.tuleva && data.ylityshistoria)
      ? {
          kerroin: data.ylityshistoria.mediaani,
          otos:    data.ylityshistoria.otos,
          hinta:   item.amount * data.ylityshistoria.mediaani,
          maara:   Math.floor((item.amount * data.ylityshistoria.mediaani) / usedCost)
        }
      : null,
    slug: `${item.id}-${unit.id}` + (edited ? `-${Math.round(usedCost)}` : ""),
    title: `${eurL(item.amount, lang)} = ${fmtL(Math.floor(item.amount / usedCost), lang)} ${L(unit, lang)}`
  };
}

/* ── jakokuva ─────────────────────────────────────────────────────────── */

export function ogSvg(c) {
  const lang = c.lang || DEFAULT_LANG;
  const tr   = T(lang);
  const cut   = (s, n) => s.length > n ? s.slice(0, n - 1) + "…" : s;
  const num   = fmt(c.count);
  const base  = num.length > 9 ? 112 : num.length > 6 ? 140 : 168;
  const size  = c.edited ? base - 30 : base;   // tee tilaa muokkausmerkinnälle
  const flag  = c.edited
    ? `<text x="104" y="196" font-family="sans-serif" font-size="24" font-weight="700" fill="#FF4A6E">${esc(lang === "en" ? "Unit price changed by reader" : "Lukijan muuttama yksikköhinta")}: ${esc(fmtL(c.cost, lang))} €</text>`
    : "";
  const top   = c.edited ? 38 : 0;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#FFD84D"/>
  <rect x="56" y="56" width="1088" height="518" rx="40" fill="#FFFFFF"/>
  <text x="104" y="152" font-family="sans-serif" font-size="30" font-weight="600" fill="#17123A" opacity="0.55">${esc(cut(eurL(c.item.amount, lang) + " — " + L(c.item, lang), 46))}</text>
  ${flag}
  <text x="104" y="${152 + top + size}" font-family="sans-serif" font-size="${size}" font-weight="bold" fill="#FF4A6E" letter-spacing="-4">${esc(num)}</text>
  <text x="104" y="${208 + top + size}" font-family="sans-serif" font-size="46" font-weight="bold" fill="#17123A">${esc(cut(L(c.unit, lang), 38))}</text>
  <rect x="104" y="${242 + top + size}" width="${Math.min(940, 420 + c.per.length * 22)}" height="72" rx="20" fill="#0FBF95"/>
  <text x="130" y="${290 + top + size}" font-family="sans-serif" font-size="32" font-weight="600" fill="#FFFFFF">${esc(tr.yourShare)} ${esc(c.per)}</text>
  <text x="104" y="544" font-family="sans-serif" font-size="26" font-weight="600" fill="#17123A" opacity="0.5">paljonkose.fi · ${esc(lang === "en" ? "calculation and sources on the page" : "laskutoimitus ja lähteet sivulla")}</text>
</svg>`;
}

/* ── sivu ─────────────────────────────────────────────────────────────── */

export function pageHtml(c, data, { site, also = [], ogUrl = null }) {
  const lang = c.lang || DEFAULT_LANG;
  const tr   = T(lang);
  const B    = base(lang);
  const fm   = n => fmtL(n, lang);
  const er   = a => eurL(a, lang);
  const url    = `${site}${B}/p/${c.slug}/`;
  const imgUrl = ogUrl || `${url}og.png`;
  const desc = lang === "en"
    ? `${L(c.item, lang)}: ${fm(c.item.amount)} € divided by a unit price of ${fm(c.cost)} €. Your share ${c.per}. Calculation and sources shown.`
    : `${c.item.label}: ${fm(c.item.amount)} € jaettuna yksikköhinnalla ${fm(c.cost)} €. Sinun osuutesi ${c.per}. Laskutoimitus ja lähteet näkyvissä.`;
  const badge  = (status) => `<span class="badge b-${status}">${STATUS[status] || status}</span>`;

  const alsoHtml = also.map(x =>
    `<a href="${site}${B}/p/${x.slug}/">${fm(x.count)} ${esc(L(x.unit, lang))}</a>`).join("\n    ");

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.title)} — ${esc(tr.siteName)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="fi" href="${site}/p/${c.slug}/">
<link rel="alternate" hreflang="en" href="${site}/en/p/${c.slug}/">
<link rel="alternate" hreflang="x-default" href="${site}/p/${c.slug}/">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(c.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${imgUrl}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(c.title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${imgUrl}">
<meta name="theme-color" content="#FFD84D">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400;12..96,75..100,800&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<script type="application/ld+json">
${JSON.stringify({
  "@context": "https://schema.org", "@type": "Dataset",
  name: c.title, description: desc, url,
  license: "https://creativecommons.org/licenses/by/4.0/",
  dateModified: data.generated,
  isBasedOn: [c.item.source?.docs, c.unit.source?.docs].filter(Boolean)
})}
</script>
<style>
  :root{--bg:#FFD84D;--ink:#17123A;--pop:#FF4A6E;--mint:#0FBF95;--soft:rgba(23,18,58,.55)}
  *{box-sizing:border-box}html,body{margin:0}
  body{background:var(--bg);color:var(--ink);font-family:"Instrument Sans",system-ui,sans-serif;font-size:17px;line-height:1.45;-webkit-font-smoothing:antialiased}
  .wrap{max-width:560px;margin:0 auto;padding:22px 18px 60px}
  a.back{display:inline-block;font-weight:600;font-size:14px;color:var(--ink);text-decoration:none;background:rgba(23,18,58,.09);border-radius:100px;padding:8px 15px;margin-bottom:20px}
  .card{background:#fff;border-radius:26px;padding:24px 22px 26px;box-shadow:0 10px 0 rgba(23,18,58,.12)}
  .amount{font-weight:600;font-size:15px;color:var(--soft);margin:0 0 2px}
  .count{font-family:"Bricolage Grotesque",sans-serif;font-weight:800;font-variation-settings:"wdth" 88;font-size:clamp(52px,17vw,86px);line-height:.88;letter-spacing:-.045em;margin:0;color:var(--pop)}
  .what{font-family:"Bricolage Grotesque",sans-serif;font-weight:800;font-size:clamp(17px,4.8vw,23px);margin:8px 0 0}
  .share-line{background:var(--mint);color:#fff;border-radius:14px;padding:11px 14px;font-weight:600;font-size:15px;margin:18px 0 0}
  .rival{background:#F0F4FF;border-left:4px solid #3B5BDB;border-radius:12px;
    padding:12px 14px;font-size:14px;margin:14px 0 0;line-height:1.5}
  .rival strong{display:block;margin-bottom:3px}
  .ennuste{background:#FFF3C4;border-left:4px solid #C99A00;border-radius:12px;padding:12px 14px;font-size:14px;margin:14px 0 0;line-height:1.5}
  .ennuste strong{display:block;margin-bottom:3px}
  .warn{background:var(--pop);color:#fff;border-radius:14px;padding:10px 14px;font-weight:600;font-size:14px;margin:12px 0 0}
  .sum{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13.5px;line-height:1.75;background:rgba(23,18,58,.05);border-radius:14px;padding:14px 15px;overflow-x:auto;white-space:pre;margin:18px 0 0}
  .op{color:var(--pop);font-weight:700}.res{font-weight:700}.from{color:var(--soft)}
  .note{font-size:13.5px;color:var(--soft);margin:12px 0 0}.note strong{color:var(--ink)}
  .badge{display:inline-block;border-radius:100px;padding:2px 9px;font-size:11px;font-weight:700;color:#fff;margin-right:6px}
  .b-rajapinta{background:var(--mint)}.b-kasin{background:#7A6FB0}.b-arvio{background:#C99A00}
  .b-varaluku,.b-muokattu{background:var(--pop)}
  .acts{display:flex;gap:8px;flex-wrap:wrap;margin:22px 0 0}
  .acts a,.acts button{flex:1 1 auto;text-align:center;font:inherit;font-weight:700;font-size:16px;background:var(--ink);color:#fff;border:0;border-radius:100px;padding:14px 18px;cursor:pointer;text-decoration:none}
  .acts a.alt{background:transparent;color:var(--ink);box-shadow:inset 0 0 0 2px var(--ink)}
  .also{margin-top:34px}
  .also h2{font-family:"Bricolage Grotesque",sans-serif;font-weight:800;font-size:15px;text-transform:uppercase;letter-spacing:.04em;margin:0 0 10px}
  .also a{display:block;background:rgba(23,18,58,.07);border-radius:14px;padding:11px 14px;margin-bottom:7px;color:var(--ink);text-decoration:none;font-size:15px;font-weight:600}
  .also a:hover{background:var(--ink);color:var(--bg)}
</style>
</head>
<body>
<div class="wrap">
  <a class="back" href="${site}/">← Paljonko se on?</a>

  <div class="card">
    <p class="amount">${esc(eur(c.item.amount))} — ${esc(c.item.label)} on</p>
    <p class="count">${fmt(c.count)}</p>
    <p class="what">${esc(L(c.unit, lang))}</p>
    ${`<p class="share-line">${esc(tr.yourShare)} ${esc(c.per)}${c.item.scope !== "valtio" ? ` (${esc(tr.perPerson(c.asukas.replace("jokaista ", "")))})` : ""}</p>`}
    ${c.kilpailijat && c.kilpailijat.length ? `<p class="rival">
      <strong>${esc(tr.rivalTitle)}</strong>
      ${esc(tr.rivalBody)}
      ${c.kilpailijat.map(k => `<a href="${B}/p/${k.id}-${c.unit.id}/">${esc(k.label_en && lang === "en" ? k.label_en : k.label)}</a>
        (${er(k.amount)})`).join(", ")}.
      ${esc(tr.rivalTail)}</p>` : ""}
    ${c.ennuste ? `<p class="ennuste"><strong>${esc(tr.forecastTitle)}</strong>
      ${tr.forecastBody(c.ennuste.otos,
          c.ennuste.kerroin.toLocaleString(tr.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          er(c.ennuste.hinta), fm(c.ennuste.maara), esc(L(c.unit, lang)))}
      ${esc(tr.forecastTail)}</p>` : ""}
    ${c.edited ? `<p class="warn">${esc(tr.edited(fm(c.unit.cost), fm(c.cost)))}</p>` : ""}

    <div class="sum"><span>${fm(c.item.amount)} €</span>   <span class="from">${esc(L(c.item, lang))}</span>
<span class="op">÷</span> <span>${fm(c.cost)} €</span>   <span class="from">${esc(L(c.unit, lang))} (${esc(tr.unitPrice)})</span>
────────────────────
<span class="res">= ${fm(c.count)}</span>   <span class="from">${esc(L(c.unit, lang))}</span>${c.jaa > 0 ? `
<span class="from">${esc(tr.leftOver(fm(Math.round(c.jaa))))}</span>` : ""}

<span>${fm(c.item.amount)} €</span>
<span class="op">÷</span> <span>${fm(c.vakiluku)}</span>   <span class="from">${esc(tr.residents(c.item.scope === "valtio" ? tr.wholeCountry : c.item.scope))}</span>
────────────────────
<span class="res">= ${esc(c.per)}</span>   <span class="from">${esc(tr.perPerson(c.asukas))}</span></div>

    <p class="note"><strong>${esc(tr.numerator)}</strong> ${badge(c.item.status)}${esc(c.item.source?.name || "")}${N(c.item, lang) ? " — " + esc(N(c.item, lang)) : ""}${c.item.source?.retrieved ? ` · ${esc(tr.retrieved)} ` + new Date(c.item.source.retrieved).toLocaleDateString(tr.locale) : ""}</p>
    <p class="note"><strong>${esc(tr.denominator)}</strong> ${badge(c.edited ? "muokattu" : c.unit.status)}${c.edited ? `${esc(tr.originalSource)} ${esc(c.unit.source?.name || "")}` : esc(c.unit.source?.name || "")}${N(c.unit, lang) ? " — " + esc(N(c.unit, lang)) : ""}</p>
    <p class="note"><strong>${esc(tr.caveatTitle)}</strong> ${c.item.scope === "valtio"
      ? esc(tr.caveatState(L(c.unit, lang).replace(/^(uutta |kilometriä |new |kilometres of )/, "")))
      : esc(tr.caveatCity)}</p>

    <div class="acts">
      <button id="copy">${esc(tr.copyLink)}</button>
      <a class="alt" href="${imgUrl}" download="${esc(c.slug)}.png">${esc(tr.downloadImage)}</a>
    </div>
  </div>

  <div class="also">
    <h2>${esc(tr.sameSum)}</h2>
    ${alsoHtml}
  </div>
</div>
<script>
document.getElementById("copy").addEventListener("click", async function(){
  var t = ${JSON.stringify(`${c.title}. ${T(c.lang || DEFAULT_LANG).yourShare} ${c.per}. ${url}`)};
  try { await navigator.clipboard.writeText(t); this.textContent = ${JSON.stringify(tr.copied)}; }
  catch(e) { this.textContent = ${JSON.stringify(tr.copyFailed)}; }
  var self = this; setTimeout(function(){ self.textContent = ${JSON.stringify(tr.copyLink)}; }, 2000);
});
</script>
</body>
</html>`;
}

/* ─────────────────────────────────────────────────────────────────────
   Verokuitti. Karkea malli, joka kertoo suuruusluokan — ei veroneuvo.
   Vero lasketaan v. 2026 valtion tuloveroasteikolla + kunnallisverolla,
   ja maksettu valtionvero jaetaan pääluokkien osuuksien suhteessa.
   TARKISTA asteikko ennen julkaisua.
   ───────────────────────────────────────────────────────────────────── */

const ASTEIKKO_2026 = [
  { raja:      0, vero:      0, pros: 12.64 },
  { raja:  21_200, vero:  2_679, pros: 19.00 },
  { raja:  31_500, vero:  4_636, pros: 30.25 },
  { raja:  52_100, vero: 10_867, pros: 34.00 },
  { raja:  88_200, vero: 23_141, pros: 41.75 },
  { raja: 150_000, vero: 48_943, pros: 44.25 }
];

export function verokuitti(data, vuosiansio, kuntavero = 7.5) {
  const tulo = Math.max(0, Math.round(vuosiansio));
  if (!tulo) return null;

  const p = [...ASTEIKKO_2026].reverse().find(x => tulo > x.raja) || ASTEIKKO_2026[0];
  const valtionvero = Math.max(0, p.vero + (tulo - p.raja) * p.pros / 100);
  const kunnallisvero = tulo * kuntavero / 100;

  // Palkansaajan omat vakuutusmaksut. Eivät ole veroa, mutta näkyvät palkassa.
  const maksut = tulo * (7.15 + 1.90 + 0.59) / 100;   // TyEL + työttömyys + sv

  const yhteensa = valtionvero + kunnallisvero + maksut;
  const kokoBudjetti = data.paaluokat.reduce((s, x) => s + x.amount, 0);

  return {
    tulo, kuntavero,
    valtionvero: Math.round(valtionvero),
    kunnallisvero: Math.round(kunnallisvero),
    maksut: Math.round(maksut),
    yhteensa: Math.round(yhteensa),
    aste: yhteensa / tulo * 100,
    rivit: data.paaluokat.map(pl => ({
      label: pl.label,
      label_en: pl.label_en,
      note_en: pl.note_en,
      note: pl.note || "",
      osuus: pl.amount / kokoBudjetti,
      euroa: valtionvero * pl.amount / kokoBudjetti
    })).sort((a, b) => b.euroa - a.euroa)
  };
}

/* ── Yhteinen kehys aputyökalujen sivuille ─────────────────────────── */
export function shell({ title, desc, site, body, path = "/", lang = DEFAULT_LANG, altPath = null }) {
  const tr = T(lang);
  return `<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — ${esc(tr.siteName)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${site}${path}">
${altPath ? `<link rel="alternate" hreflang="${lang === "en" ? "fi" : "en"}" href="${site}${altPath}">` : ""}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${site}/og-default.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#FFD84D">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
 :root{--bg:#FFD84D;--ink:#141414;--pop:#FF4A6E;--mut:#6B6B6B}
 *{box-sizing:border-box}
 body{margin:0;background:var(--bg);color:var(--ink);
   font-family:"Instrument Sans",system-ui,sans-serif;line-height:1.55;
   padding:24px 16px 64px}
 .wrap{max-width:760px;margin:0 auto}
 h1{font-family:"Bricolage Grotesque",serif;font-size:clamp(28px,6vw,46px);
   line-height:1.05;margin:0 0 8px;letter-spacing:-.02em}
 .lede{font-size:17px;color:#3a3a3a;margin:0 0 22px;max-width:56ch}
 .card{background:#fff;border-radius:20px;padding:22px;margin:0 0 18px;
   box-shadow:0 2px 0 rgba(0,0,0,.08)}
 table{width:100%;border-collapse:collapse;font-size:15px}
 th,td{padding:9px 6px;text-align:right;border-bottom:1px solid #EDEDED}
 th:first-child,td:first-child{text-align:left}
 th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);
   font-weight:600;border-bottom:2px solid var(--ink)}
 tbody tr:last-child td{border-bottom:none}
 .num{font-variant-numeric:tabular-nums;font-weight:600}
 .mark{font-size:11px;font-weight:700;background:#EDEDED;color:#555;
   padding:2px 7px;border-radius:99px;white-space:nowrap;vertical-align:middle}
 .pop{color:var(--pop);font-weight:700}
 .sub{font-size:13px;color:var(--mut);display:block;font-weight:400}
 .note{background:#F6F6F6;border-radius:12px;padding:13px 15px;font-size:14px;
   color:#3a3a3a;margin:16px 0 0}
 .note strong{display:block;margin-bottom:3px}
 a{color:inherit}
 .topbar{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:18px}
 .back{font-size:14px;font-weight:600}
 .lang{font-size:14px;font-weight:600;background:#fff;padding:6px 12px;border-radius:99px;
   text-decoration:none;box-shadow:0 1px 0 rgba(0,0,0,.08)}
 input{font:inherit;padding:11px 13px;border:2px solid var(--ink);border-radius:11px;
   background:#fff;width:100%;max-width:220px;font-variant-numeric:tabular-nums}
 button{font:inherit;font-weight:600;padding:11px 20px;border:0;border-radius:11px;
   background:var(--ink);color:#fff;cursor:pointer}
 .bar{height:7px;background:#EDEDED;border-radius:4px;overflow:hidden;margin-top:5px}
 .bar i{display:block;height:100%;background:var(--pop)}
</style></head>
<body><div class="wrap">
<div class="topbar">
  <a class="back" href="${base(lang)}/">← ${esc(tr.siteName)}</a>
  ${altPath ? `<a class="lang" href="${altPath}">${esc(tr.otherLangName)}</a>` : ""}
</div>
${body}
</div></body></html>`;
}

/* ── Ylitysrekisteri ───────────────────────────────────────────────── */
export function ylityksetHtml(data, { site, lang = DEFAULT_LANG }) {
  const tr = T(lang), pp = P(lang), B = base(lang);
  const fm = n => fmtL(n, lang), er = a => eurL(a, lang);
  const rivit = data.items
    .filter(i => i.arvio && (!i.tuleva || i.vainRekisteri) && !i.johdettu && i.arvio > 0)
    .map(i => ({ ...i, suhde: i.amount / i.arvio, ero: i.amount - i.arvio }))
    .sort((a, b) => b.suhde - a.suhde);

  const h = data.ylityshistoria;
  const body = `
<h1>${esc(tr.overrunsTitle)}</h1>
<p class="lede">${esc(tr.overrunsLede)}</p>
<div class="card">
<table><thead><tr>
  <th>${esc(tr.colProject)}</th><th>${esc(tr.colEstimate)}</th><th>${esc(tr.colActual)}</th><th>${esc(tr.colDiff)}</th><th>${esc(tr.colRatio)}</th>
</tr></thead><tbody>
${rivit.map(r => `<tr>
  <td>${esc(L(r, lang))}${r.vainRekisteri ? ` <span class="mark">${
    esc(lang === "en" ? "not public money" : "ei julkista rahaa")}</span>` : ""}<span class="sub">${esc(N(r, lang))}</span></td>
  <td class="num">${er(r.arvio)}</td>
  <td class="num">${er(r.amount)}</td>
  <td class="num ${r.ero > 0 ? "pop" : ""}">${r.ero > 0 ? "+" : "−"}${er(Math.abs(r.ero))}</td>
  <td class="num ${r.suhde > 1 ? "pop" : ""}">${r.suhde.toLocaleString(tr.locale,
      { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×</td>
</tr>`).join("")}
</tbody></table>
</div>
${h ? `<div class="card">${tr.medianLine(h.mediaani.toLocaleString(tr.locale,
  { minimumFractionDigits: 2, maximumFractionDigits: 2 }), h.otos)}</div>` : ""}
<p class="note"><strong>${esc(tr.caveatTitle)}</strong> ${esc(tr.overrunsCaveat)}</p>`;

  return shell({ title: tr.overrunsTitle, path: `${B}/${pp.overruns}/`, site, body, lang,
    altPath: lang === "en" ? "/ylitykset/" : "/en/overruns/",
    desc: lang === "en"
      ? `Cost estimates and final prices for Finnish megaprojects. ${rivit.length} projects.`
      : `Suomalaisten suurhankkeiden kustannusarviot ja toteutuneet hinnat. ${rivit.length} hanketta.` });
}

/* ── Verokuitti ────────────────────────────────────────────────────── */
export function kuittiHtml(data, ansio, { site, lang = DEFAULT_LANG }) {
  const tr = T(lang), pp = P(lang), B = base(lang);
  const fm = n => fmtL(n, lang);
  const k = ansio ? verokuitti(data, ansio) : null;
  const body = `
<h1>${esc(tr.receiptTitle)}</h1>
<p class="lede">${esc(tr.receiptLede)}</p>
<div class="card">
  <form onsubmit="event.preventDefault();
    const v=this.ansio.value.replace(/\\D/g,''); if(v) location.href='${B}/${pp.receipt}/'+v+'/';">
    <label style="font-size:14px;font-weight:600;display:block;margin-bottom:7px">
      ${esc(tr.grossIncome)}</label>
    <div style="display:flex;gap:9px;flex-wrap:wrap">
      <input name="ansio" inputmode="numeric" placeholder="45000"
        value="${k ? k.tulo : ""}"><button>${esc(tr.calculate)}</button>
    </div>
  </form>
</div>
${k ? `
<div class="card">
  <table><tbody>
    <tr><td>${esc(tr.stateTax)}</td><td class="num">${fm(k.valtionvero)} €</td></tr>
    <tr><td>${esc(tr.municipalTax)} <span class="sub">${esc(tr.municipalNote(k.kuntavero))}</span></td>
        <td class="num">${fm(k.kunnallisvero)} €</td></tr>
    <tr><td>${esc(tr.contributions)} <span class="sub">${esc(tr.contributionsNote)}</span></td>
        <td class="num">${fm(k.maksut)} €</td></tr>
    <tr><td><strong>${esc(tr.total)}</strong></td>
        <td class="num pop">${fm(k.yhteensa)} € (${k.aste.toLocaleString(tr.locale,
          { maximumFractionDigits: 1 })} %)</td></tr>
  </tbody></table>
</div>
<h2 style="font-family:'Bricolage Grotesque',serif;font-size:22px;margin:26px 0 10px">
  ${esc(tr.whereItWent)}</h2>
<div class="card">
<table><thead><tr><th>${esc(tr.colMainClass)}</th><th>${esc(tr.colShare)}</th><th>${esc(tr.colYourEuros)}</th></tr></thead>
<tbody>
${k.rivit.map(r => `<tr>
  <td>${esc(lang === "en" && r.label_en ? r.label_en : r.label)}${(lang === "en" ? r.note_en : r.note) ? `<span class="sub">${esc(lang === "en" ? r.note_en : r.note)}</span>` : ""}
    <div class="bar"><i style="width:${(r.osuus * 100).toFixed(1)}%"></i></div></td>
  <td class="num">${(r.osuus * 100).toLocaleString(tr.locale, { maximumFractionDigits: 1 })} %</td>
  <td class="num pop">${fm(Math.round(r.euroa))} €</td>
</tr>`).join("")}
</tbody></table>
</div>
<p class="note"><strong>${esc(tr.caveatTitle)}</strong> ${esc(tr.receiptCaveat(k.kuntavero))}</p>`
: ""}`;

  return shell({ title: k ? `${tr.receiptTitle} ${fm(k.tulo)} €` : tr.receiptTitle,
    path: k ? `${B}/${pp.receipt}/${k.tulo}/` : `${B}/${pp.receipt}/`, site, body, lang,
    altPath: lang === "en"
      ? (k ? `/kuitti/${k.tulo}/` : "/kuitti/")
      : (k ? `/en/tax-receipt/${k.tulo}/` : "/en/tax-receipt/"),
    desc: k
      ? (lang === "en"
          ? `On annual earnings of ${fm(k.tulo)} € you pay roughly ${fm(k.yhteensa)} € in tax and contributions.`
          : `Vuosiansiolla ${fm(k.tulo)} € maksat noin ${fm(k.yhteensa)} € veroja ja maksuja.`)
      : (lang === "en" ? "Where does your tax go? Enter your annual earnings."
                       : "Mihin sinun verosi menevät? Syötä vuosiansiosi.") });
}

/* ── Vapaa summa ───────────────────────────────────────────────────── */
export function summaHtml(data, summa, { site, lang = DEFAULT_LANG }) {
  const tr = T(lang), pp = P(lang), B = base(lang);
  const fm = n => fmtL(n, lang);
  const s = Math.max(0, Math.round(summa));
  const yks = data.units;
  const rivit = yks.map(u => ({ u, n: Math.floor(s / u.cost) })).filter(r => r.n > 0);
  const body = `
<h1>${fm(s)} €</h1>
<p class="lede">${esc(tr.sumLede)}</p>
<div class="card">
  <form onsubmit="event.preventDefault();
    const v=this.summa.value.replace(/[^\\d]/g,''); if(v) location.href='${B}/${pp.sum}/'+v+'/';">
    <div style="display:flex;gap:9px;flex-wrap:wrap">
      <input name="summa" inputmode="numeric" placeholder="340000000" value="${s || ""}">
      <button>${esc(tr.calculate)}</button>
    </div>
  </form>
</div>
${rivit.length ? `<div class="card"><table><tbody>
${rivit.map(r => `<tr><td>${esc(L(r.u, lang))}<span class="sub">à ${fm(r.u.cost)} €${
  N(r.u, lang) ? " — " + esc(N(r.u, lang)) : ""}</span></td>
  <td class="num pop">${fm(r.n)}</td></tr>`).join("")}
</tbody></table></div>` : `<div class="card">${esc(tr.sumEmpty)}</div>`}
${s > 0 ? `<div class="card">${tr.sumPerCapita((s / data.vakiluku).toLocaleString(tr.locale,
    { maximumFractionDigits: 2 }) + " €")}</div>` : ""}
<p class="note"><strong>${esc(tr.caveatTitle)}</strong> ${esc(tr.sumCaveat)}</p>`;

  return shell({ title: s ? `${fm(s)} €` : tr.sumTitle,
    path: s ? `${B}/${pp.sum}/${s}/` : `${B}/${pp.sum}/`, site, body, lang,
    altPath: lang === "en" ? (s ? `/summa/${s}/` : "/summa/") : (s ? `/en/sum/${s}/` : "/en/sum/"),
    desc: s
      ? (lang === "en" ? `${fm(s)} € translated into everyday units.`
                       : `${fm(s)} € muutettuna vertailukelpoisiksi yksiköiksi.`)
      : (lang === "en" ? "Enter a sum." : "Syötä summa.") });
}
