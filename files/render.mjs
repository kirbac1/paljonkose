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

export function combo(data, itemId, unitId, cost = null) {
  const item = data.items.find(i => i.id === itemId);
  const unit = data.units.find(u => u.id === unitId);
  if (!item || !unit) return null;

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
    asukas:   ASUKAS[item.scope] || "jokaista asukasta",
    per: (item.amount / (item.vakiluku ?? data.vakiluku))
           .toLocaleString("fi-FI", { maximumFractionDigits: 0 }) + " €",
    tuleva: !!item.tuleva,
    arki: !!item.arki,
    /* Saman päätöksen sisäinen vertailu. Tässä raha oli oikeasti
       vaihtoehtoista: hankkeet kilpailevat samasta määrärahasta.
       Tämä on rehellisempi vertailu kuin hävittäjä vs. päiväkoti. */
    kilpailijat: item.paatos
      ? data.items
          .filter(x => x.paatos === item.paatos && x.id !== item.id)
          .map(x => ({ id:x.id, label:x.label, amount:x.amount,
                       kerta: x.amount ? item.amount / x.amount : null }))
          .sort((a,b) => b.amount - a.amount)
      : [],
    /* Arkiostoksen "sinun osuutesi" olisi absurdi (kuudesmiljoonasosa
       hampurilaisesta). Tilalle silta valtion kokoluokkaan: sama ostos
       kertaa koko maan väkiluku. */
    silta: item.arki ? {
      vakiluku: data.vakiluku,
      summa: item.amount * data.vakiluku
    } : null,
    ennuste: (item.tuleva && data.ylityshistoria)
      ? {
          kerroin: data.ylityshistoria.mediaani,
          otos:    data.ylityshistoria.otos,
          hinta:   item.amount * data.ylityshistoria.mediaani,
          maara:   Math.floor((item.amount * data.ylityshistoria.mediaani) / usedCost)
        }
      : null,
    slug: `${item.id}-${unit.id}` + (edited ? `-${Math.round(usedCost)}` : ""),
    title: `${eur(item.amount)} = ${fmt(Math.floor(item.amount / usedCost))} ${unit.label}`
  };
}

/* ── jakokuva ─────────────────────────────────────────────────────────── */

export function ogSvg(c) {
  const cut   = (s, n) => s.length > n ? s.slice(0, n - 1) + "…" : s;
  const num   = fmt(c.count);
  const base  = num.length > 9 ? 112 : num.length > 6 ? 140 : 168;
  const size  = c.edited ? base - 30 : base;   // tee tilaa muokkausmerkinnälle
  const flag  = c.edited
    ? `<text x="104" y="196" font-family="sans-serif" font-size="24" font-weight="700" fill="#FF4A6E">Lukijan muuttama yksikköhinta: ${esc(fmt(c.cost))} €</text>`
    : "";
  const top   = c.edited ? 38 : 0;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#FFD84D"/>
  <rect x="56" y="56" width="1088" height="518" rx="40" fill="#FFFFFF"/>
  <text x="104" y="152" font-family="sans-serif" font-size="30" font-weight="600" fill="#17123A" opacity="0.55">${esc(cut(eur(c.item.amount) + " — " + c.item.label, 46))}</text>
  ${flag}
  <text x="104" y="${152 + top + size}" font-family="sans-serif" font-size="${size}" font-weight="bold" fill="#FF4A6E" letter-spacing="-4">${esc(num)}</text>
  <text x="104" y="${208 + top + size}" font-family="sans-serif" font-size="46" font-weight="bold" fill="#17123A">${esc(cut(c.unit.label, 38))}</text>
  <rect x="104" y="${242 + top + size}" width="${Math.min(940, 420 + c.per.length * 22)}" height="72" rx="20" fill="#0FBF95"/>
  <text x="130" y="${290 + top + size}" font-family="sans-serif" font-size="32" font-weight="600" fill="#FFFFFF">Sinun osuutesi: ${esc(c.per)}</text>
  <text x="104" y="544" font-family="sans-serif" font-size="26" font-weight="600" fill="#17123A" opacity="0.5">sillasais.fi · laskutoimitus ja lähteet sivulla</text>
</svg>`;
}

/* ── sivu ─────────────────────────────────────────────────────────────── */

export function pageHtml(c, data, { site, also = [], ogUrl = null }) {
  const url    = `${site}/p/${c.slug}/`;
  const imgUrl = ogUrl || `${url}og.png`;
  const desc   = `${c.item.label}: ${fmt(c.item.amount)} € jaettuna yksikköhinnalla ${fmt(c.cost)} €. Sinun osuutesi ${c.per}. Laskutoimitus ja lähteet näkyvissä.`;
  const badge  = (status) => `<span class="badge b-${status}">${STATUS[status] || status}</span>`;

  const alsoHtml = also.map(x =>
    `<a href="${site}/p/${x.slug}/">${fmt(x.count)} ${esc(x.unit.label)}</a>`).join("\n    ");

  return `<!DOCTYPE html>
<html lang="fi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.title)} — Mitä sillä sais?</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
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
  <a class="back" href="${site}/">← Mitä sillä sais?</a>

  <div class="card">
    <p class="amount">${esc(eur(c.item.amount))} — ${esc(c.item.label)} on</p>
    <p class="count">${fmt(c.count)}</p>
    <p class="what">${esc(c.unit.label)}</p>
    ${c.silta ? `<p class="share-line">Jos jokainen suomalainen ostaisi tämän kerran:
      <strong>${eur(c.silta.summa)}</strong></p>` : `<p class="share-line">Sinun osuutesi: ${esc(c.per)}${c.item.scope !== "valtio" ? ` (${esc(c.asukas.replace("jokaista ", ""))} kohti)` : ""}</p>`}
    ${c.kilpailijat && c.kilpailijat.length ? `<p class="rival">
      <strong>Tässä vertailu on aito.</strong>
      Samasta ratarahasta kilpailevat myös:
      ${c.kilpailijat.map(k => `<a href="/p/${k.id}-${c.unit.id}/">${esc(k.label)}</a>
        (${eur(k.amount)})`).join(", ")}.
      Näiden välillä valinta on todellinen — toisin kuin vertailussa
      kokonaan eri hallinnonalojen välillä.</p>` : ""}
    ${c.ennuste ? `<p class="ennuste"><strong>Tämä on arvio, ei toteutunut hinta.</strong>
      Viisi vertailukelpoista suomalaista suurhanketta maksoi lopulta mediaanissa
      ${c.ennuste.kerroin.toLocaleString("fi-FI",{minimumFractionDigits:2,maximumFractionDigits:2})}× arvionsa. Jos sama toistuu, hinta olisi
      ${eur(c.ennuste.hinta)} — eli ${fmt(c.ennuste.maara)} ${esc(c.unit.label)}.
      Yksi hankkeista alitti budjettinsa, joten tämä ei ole luonnonlaki.</p>` : ""}
    ${c.edited ? `<p class="warn">Huom: yksikköhintaa on muutettu. Alkuperäinen arvio oli ${fmt(c.unit.cost)} €, tässä on käytetty ${fmt(c.cost)} €.</p>` : ""}

    <div class="sum"><span>${fmt(c.item.amount)} €</span>   <span class="from">${esc(c.item.label)}</span>
<span class="op">÷</span> <span>${fmt(c.cost)} €</span>   <span class="from">${esc(c.unit.label)} (yksikköhinta)</span>
────────────────────
<span class="res">= ${fmt(c.count)}</span>   <span class="from">${esc(c.unit.label)}</span>${c.jaa > 0 ? `
<span class="from">jää yli ${fmt(Math.round(c.jaa))} €</span>` : ""}

<span>${fmt(c.item.amount)} €</span>
<span class="op">÷</span> <span>${fmt(c.vakiluku)}</span>   <span class="from">asukasta (${esc(c.item.scope === "valtio" ? "koko maa" : c.item.scope)})</span>
────────────────────
<span class="res">= ${esc(c.per)}</span>   <span class="from">${esc(c.asukas)} kohden</span></div>

    <p class="note"><strong>Osoittaja.</strong> ${badge(c.item.status)}${esc(c.item.source?.name || "")}${c.item.note ? " — " + esc(c.item.note) : ""}${c.item.source?.retrieved ? " · haettu " + new Date(c.item.source.retrieved).toLocaleDateString("fi-FI") : ""}</p>
    <p class="note"><strong>Nimittäjä.</strong> ${badge(c.edited ? "muokattu" : c.unit.status)}${c.edited ? `alkuperäinen lähde: ${esc(c.unit.source?.name || "")}` : esc(c.unit.source?.name || "")}${c.unit.note ? " — " + esc(c.unit.note) : ""}</p>
    <p class="note"><strong>Mitä tämä ei kerro.</strong> ${c.item.scope === "valtio"
      ? `Jakolasku olettaa että euro on euro. Oikeasti raha on sidottu momenttiin ja hallinnonalaan, eikä ${esc(c.unit.label.replace(/^(uutta |kilometriä )/, ""))} makseta samasta pussista. Luku kertoo mittasuhteen, ei toteutettavaa vaihtoehtoa.`
      : `Tämä on kaupungin omaa rahaa, joten vertailu on lähempänä aitoa vaihtoehtoa kuin valtion menoissa — päiväkodit ja koulut maksetaan samasta budjetista. Silti: investointi ja käyttötalous ovat eri momentteja, iso hanke rahoitetaan yleensä lainalla ja jaksotetaan vuosille, eikä sote-palveluita enää makseta kaupungin kassasta vaan hyvinvointialueelta.`}</p>

    <div class="acts">
      <button id="copy">Kopioi linkki</button>
      <a class="alt" href="${imgUrl}" download="${esc(c.slug)}.png">Lataa kuva</a>
    </div>
  </div>

  <div class="also">
    <h2>Sama summa toisin mitattuna</h2>
    ${alsoHtml}
  </div>
</div>
<script>
document.getElementById("copy").addEventListener("click", async function(){
  var t = ${JSON.stringify(`${c.title}. Sinun osuutesi ${c.per}. ${url}`)};
  try { await navigator.clipboard.writeText(t); this.textContent = "Kopioitu ✓"; }
  catch(e) { this.textContent = "Kopiointi ei onnistunut"; }
  var self = this; setTimeout(function(){ self.textContent = "Kopioi linkki"; }, 2000);
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
      note: pl.note || "",
      osuus: pl.amount / kokoBudjetti,
      euroa: valtionvero * pl.amount / kokoBudjetti
    })).sort((a, b) => b.euroa - a.euroa)
  };
}

/* ── Yhteinen kehys aputyökalujen sivuille ─────────────────────────── */
export function shell({ title, desc, site, body, path = "/" }) {
  return `<!DOCTYPE html>
<html lang="fi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Mitä sillä sais?</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${site}${path}">
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
 .pop{color:var(--pop);font-weight:700}
 .sub{font-size:13px;color:var(--mut);display:block;font-weight:400}
 .note{background:#F6F6F6;border-radius:12px;padding:13px 15px;font-size:14px;
   color:#3a3a3a;margin:16px 0 0}
 .note strong{display:block;margin-bottom:3px}
 a{color:inherit}
 .back{display:inline-block;margin-bottom:18px;font-size:14px;font-weight:600}
 input{font:inherit;padding:11px 13px;border:2px solid var(--ink);border-radius:11px;
   background:#fff;width:100%;max-width:220px;font-variant-numeric:tabular-nums}
 button{font:inherit;font-weight:600;padding:11px 20px;border:0;border-radius:11px;
   background:var(--ink);color:#fff;cursor:pointer}
 .bar{height:7px;background:#EDEDED;border-radius:4px;overflow:hidden;margin-top:5px}
 .bar i{display:block;height:100%;background:var(--pop)}
</style></head>
<body><div class="wrap">
<a class="back" href="/">← Mitä sillä sais?</a>
${body}
</div></body></html>`;
}

/* ── Ylitysrekisteri ───────────────────────────────────────────────── */
export function ylityksetHtml(data, { site }) {
  const rivit = data.items
    .filter(i => i.arvio && !i.tuleva && !i.johdettu && i.arvio > 0)
    .map(i => ({ ...i, suhde: i.amount / i.arvio, ero: i.amount - i.arvio }))
    .sort((a, b) => b.suhde - a.suhde);

  const h = data.ylityshistoria;
  const body = `
<h1>Arvio vs. toteutunut</h1>
<p class="lede">Suomalaisten suurhankkeiden alkuperäiset kustannusarviot ja lopulliset
hinnat. Kaikki hankkeet, joista molemmat luvut ovat saatavilla — myös ne, jotka
alittivat budjettinsa.</p>
<div class="card">
<table><thead><tr>
  <th>Hanke</th><th>Arvio</th><th>Toteutunut</th><th>Erotus</th><th>Kerroin</th>
</tr></thead><tbody>
${rivit.map(r => `<tr>
  <td>${esc(r.label)}<span class="sub">${esc(r.note || "")}</span></td>
  <td class="num">${eur(r.arvio)}</td>
  <td class="num">${eur(r.amount)}</td>
  <td class="num ${r.ero > 0 ? "pop" : ""}">${r.ero > 0 ? "+" : "−"}${eur(Math.abs(r.ero))}</td>
  <td class="num ${r.suhde > 1 ? "pop" : ""}">${r.suhde.toLocaleString("fi-FI",
      { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×</td>
</tr>`).join("")}
</tbody></table>
</div>
${h ? `<div class="card"><strong>Mediaani ${h.mediaani.toLocaleString("fi-FI",
  { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×</strong> (${h.otos} hanketta).
  Mediaani eikä keskiarvo, jottei yksi karkaava hanke vääristä kuvaa.</div>` : ""}
<p class="note"><strong>Mitä tämä ei kerro.</strong>
Vertailukelpoisuus on tulkinnanvaraista: hankkeen sisältö, laajuus ja hintataso
muuttuvat suunnittelun aikana, eikä jokainen ylitys ole virhe. Osa eroista selittyy
inflaatiolla, osa laajennuksilla, joista on päätetty erikseen. Alkuperäisen arvion
vuosi on merkitty jokaisen hankkeen kohdalle. Otos on pieni.</p>`;

  return shell({ title: "Arvio vs. toteutunut", path: "/ylitykset/", site, body,
    desc: `Suomalaisten suurhankkeiden kustannusarviot ja toteutuneet hinnat. ${rivit.length} hanketta.` });
}

/* ── Verokuitti ────────────────────────────────────────────────────── */
export function kuittiHtml(data, ansio, { site }) {
  const k = ansio ? verokuitti(data, ansio) : null;
  const body = `
<h1>Verokuitti</h1>
<p class="lede">Syötä vuosiansiosi, niin näet arvion maksamastasi verosta ja siitä,
mihin valtion osuus siitä jakautuu. Karkea suuruusluokka-arvio — ei veroneuvo.</p>
<div class="card">
  <form method="get" action="/kuitti/" onsubmit="event.preventDefault();
    const v=this.ansio.value.replace(/\\D/g,''); if(v) location.href='/kuitti/'+v+'/';">
    <label style="font-size:14px;font-weight:600;display:block;margin-bottom:7px">
      Vuosiansio, brutto</label>
    <div style="display:flex;gap:9px;flex-wrap:wrap">
      <input name="ansio" inputmode="numeric" placeholder="45000"
        value="${k ? k.tulo : ""}"><button>Laske</button>
    </div>
  </form>
</div>
${k ? `
<div class="card">
  <table><tbody>
    <tr><td>Valtion tulovero</td><td class="num">${fmt(k.valtionvero)} €</td></tr>
    <tr><td>Kunnallisvero <span class="sub">${k.kuntavero} % — vaihtelee kunnittain</span></td>
        <td class="num">${fmt(k.kunnallisvero)} €</td></tr>
    <tr><td>Eläke- ja työttömyysvakuutusmaksut <span class="sub">ei veroa, mutta palkasta</span></td>
        <td class="num">${fmt(k.maksut)} €</td></tr>
    <tr><td><strong>Yhteensä</strong></td>
        <td class="num pop">${fmt(k.yhteensa)} € (${k.aste.toLocaleString("fi-FI",
          { maximumFractionDigits: 1 })} %)</td></tr>
  </tbody></table>
</div>
<h2 style="font-family:'Bricolage Grotesque',serif;font-size:22px;margin:26px 0 10px">
  Mihin valtion tuloverosi meni</h2>
<div class="card">
<table><thead><tr><th>Pääluokka</th><th>Osuus</th><th>Sinun euroistasi</th></tr></thead>
<tbody>
${k.rivit.map(r => `<tr>
  <td>${esc(r.label)}${r.note ? `<span class="sub">${esc(r.note)}</span>` : ""}
    <div class="bar"><i style="width:${(r.osuus * 100).toFixed(1)}%"></i></div></td>
  <td class="num">${(r.osuus * 100).toLocaleString("fi-FI", { maximumFractionDigits: 1 })} %</td>
  <td class="num pop">${fmt(Math.round(r.euroa))} €</td>
</tr>`).join("")}
</tbody></table>
</div>
<p class="note"><strong>Mitä tämä ei kerro.</strong>
Laskelma käyttää valtion tuloveroasteikkoa ja ${k.kuntavero} %:n kunnallisveroa,
eikä huomioi vähennyksiä, pääomatuloja, kirkollisveroa tai kotikuntasi todellista
veroprosenttia — todellinen veroprosenttisi poikkeaa tästä. Jako pääluokkiin on
laskennallinen: verot menevät yhteiseen kassaan, eikä yksittäistä euroa voi
jäljittää tiettyyn menoon. Kunnallisveroa ei ole jaettu tässä lainkaan.</p>`
: ""}`;

  return shell({ title: k ? `Verokuitti ${fmt(k.tulo)} €` : "Verokuitti",
    path: k ? `/kuitti/${k.tulo}/` : "/kuitti/", site, body,
    desc: k ? `Vuosiansiolla ${fmt(k.tulo)} € maksat noin ${fmt(k.yhteensa)} € veroja ja maksuja.`
            : "Mihin sinun verosi menevät? Syötä vuosiansiosi." });
}

/* ── Vapaa summa ───────────────────────────────────────────────────── */
export function summaHtml(data, summa, { site }) {
  const s = Math.max(0, Math.round(summa));
  const yks = data.units.filter(u => !!u.arki === (s < 10_000));
  const rivit = yks.map(u => ({ u, n: Math.floor(s / u.cost) })).filter(r => r.n > 0);
  const body = `
<h1>${fmt(s)} €</h1>
<p class="lede">Mitä tällä summalla saisi? Syötä mikä tahansa luku — vaikka uutisesta
poimittu.</p>
<div class="card">
  <form onsubmit="event.preventDefault();
    const v=this.summa.value.replace(/[^\\d]/g,''); if(v) location.href='/summa/'+v+'/';">
    <div style="display:flex;gap:9px;flex-wrap:wrap">
      <input name="summa" inputmode="numeric" placeholder="340000000" value="${s || ""}">
      <button>Laske</button>
    </div>
  </form>
</div>
${rivit.length ? `<div class="card"><table><tbody>
${rivit.map(r => `<tr><td>${esc(r.u.label)}<span class="sub">à ${fmt(r.u.cost)} €${
  r.u.note ? " — " + esc(r.u.note) : ""}</span></td>
  <td class="num pop">${fmt(r.n)}</td></tr>`).join("")}
</tbody></table></div>` : `<div class="card">Syötä summa yllä.</div>`}
${s > 0 ? `<div class="card">Koko maan mitassa tämä on
  <strong>${(s / data.vakiluku).toLocaleString("fi-FI",
    { maximumFractionDigits: 2 })} €</strong> jokaista suomalaista kohden.</div>` : ""}
<p class="note"><strong>Mitä tämä ei kerro.</strong>
Jakolasku ei ole päätös. Yksikköhinnat ovat keskiarvoja, ja oikeassa hankkeessa
hinta riippuu paikasta, laajuudesta ja ajankohdasta. Raha ei myöskään ole vapaasti
siirrettävissä menokohteesta toiseen.</p>`;

  return shell({ title: s ? `Mitä ${fmt(s)} eurolla sais?` : "Mitä sillä sais?",
    path: s ? `/summa/${s}/` : "/summa/", site, body,
    desc: s ? `${fmt(s)} € muutettuna arkisiksi yksiköiksi.` : "Syötä summa." });
}
