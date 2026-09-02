#!/usr/bin/env node
/**
 * fetch-data.mjs — fetches figures from open APIs and writes data.json.
 *
 * Run:  node fetch-data.mjs
 * Scheduled by: .github/workflows/update-data.yml (once a day)
 *
 * Why at build time, not in the browser:
 *   Government APIs don't guarantee CORS headers, so a direct call from
 *   the browser can fail. The fetch happens on the server; the page only
 *   ever reads its own data.json. The site stays static.
 *
 * VERIFY BEFORE PRODUCTION: table and budget-item codes marked TODO.
 */

import fs from "node:fs/promises";
import { ITEMS_EN, UNITS_EN, SCOPES_EN, PAALUOKAT_EN } from "./i18n-data.mjs";

const OUT = "data.json";
const now = new Date().toISOString();

/* ── Source registry ────────────────────────────────────────────────────
   Every figure carries its own origin. This same object drives both the
   fetch and the page's "where does this figure come from" info. One
   source of truth, not two lists.                                       */

const SOURCES = {
  vk_talous: {
    name: "Valtiokonttori — Valtion talous -API",
    api: "https://api.tutkihallintoa.fi/talous/v1/luvut",
    docs: "https://avoindata.tutkihallintoa.fi/apis",
    licence: "CC BY 4.0",
    kind: "api"
  },
  kuntien_avainluvut: {
    name: "Tilastokeskus — Kuntien avainluvut",
    api: "https://pxdata.stat.fi/PxWeb/api/v1/fi/Kuntien_avainluvut",
    docs: "https://stat.fi/fi/palvelut/tilastodatapalvelut/tilastotietokannat/kuntien-avainluvut",
    licence: "CC BY 4.0",
    kind: "api"
  },
  statfin: {
    name: "Tilastokeskus — StatFin (PxWeb API)",
    api: "https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin",
    docs: "https://stat.fi/fi/palvelut/tilastodatapalvelut/avoin-data-ja-rajapinnat/tietokantojen-rajapintakaytto",
    licence: "CC BY 4.0",
    kind: "api"
  },
  vk_kunta: {
    name: "Tilastokeskus — Kuntien ja kuntayhtymien raportoimat taloustiedot",
    // Its own PxWeb database on the same server. This has cities'
    // operating expenses and investments — TODO: the table id.
    api: "https://pxdata.stat.fi/PxWeb/api/v1/fi/Kuntien_talous",
    docs: "https://pxdata.stat.fi/PXWeb/pxweb/fi/",
    licence: "CC BY 4.0",
    kind: "api"
  },
  hanke: {
    name: "Hankepäätös, tilinpäätös tai VTV:n tarkastuskertomus",
    api: null,
    docs: null,
    licence: "julkinen asiakirja",
    kind: "manual"
  },
  plm: {
    name: "Puolustusministeriö — tiedotteet puolustustarvikeavusta",
    api: null,
    docs: "https://www.defmin.fi/",
    licence: "julkinen tiedote",
    kind: "manual"
  },
  um: {
    name: "Ulkoministeriö — Ukrainan tukitilastot",
    api: null,
    docs: "https://um.fi/",
    licence: "julkinen tiedote",
    kind: "manual"
  },
  arvio: {
    name: "Oma laskelma julkisista tilastoista",
    api: null,
    docs: null,
    licence: "suuruusluokka-arvio",
    kind: "estimate"
  }
};

/* ── Helpers ─────────────────────────────────────────────────────────── */

async function getJSON(url, opts = {}) {
  const res = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "paljonkose/1.0" },
    ...opts
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

/** A budget-item line from the state budget via Valtiokonttori's economy API.
 *  E.g. top-level category 27 = the Ministry of Defence's administrative branch.
 *  TODO: verify the fields against api.tutkihallintoa.fi/talous/v1's docs. */
async function haeMomentti({ paaluokka, momentti, vuosi }) {
  const url = `${SOURCES.vk_talous.api}?paaluokka=${paaluokka}&vuosi=${vuosi}`;
  const data = await getJSON(url);
  const rows = Array.isArray(data) ? data : (data.value ?? data.results ?? []);
  const hit = rows.find(r =>
    String(r.momentti ?? r.tunnus ?? "").startsWith(momentti)
  );
  if (!hit) throw new Error(`Budget item ${momentti} not found in top-level category ${paaluokka}`);
  const euros = Number(hit.maara ?? hit.summa ?? hit.arvo);
  if (!Number.isFinite(euros)) throw new Error(`Budget item ${momentti}'s value isn't a number`);
  return euros;
}

/**
 * Population figures for every municipality, from the Kuntien avainluvut database.
 *
 * A database change on 2026-06-08 shortened the ids and changed the
 * variable codes, so the codes aren't hardcoded here: the metadata is
 * fetched first, and the variables and values are looked up by name.
 * This survives the next such change too.
 */
const AVAINLUVUT_TAULU =
  "Kuntien_avainluvut__uusin/kuntien_avainluvut_viimeisin.px";

async function haeVakiluvut() {
  const base = SOURCES.kuntien_avainluvut.api;
  const url  = `${base}/${AVAINLUVUT_TAULU}`;

  // 1) metadata: which variables, and which codes
  const meta = await getJSON(url);
  const vars = meta.variables || [];

  const alue = vars.find(v => /alue/i.test(v.code) || /alue/i.test(v.text));
  const tied = vars.find(v => /tiedot/i.test(v.code) || /tiedot/i.test(v.text));
  if (!alue || !tied) throw new Error("Could not find the Region or Data variable");

  // "Väkiluku, 2025" ("Population, 2025") — picked by name, not by code
  const vi = tied.valueTexts.findIndex(t => /^väkiluku,/i.test(t.trim()));
  if (vi < 0) throw new Error("Could not find a population value in the Data variable");

  // 2) data for every region
  const data = await getJSON(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: [
        { code: alue.code, selection: { filter: "all",  values: ["*"] } },
        { code: tied.code, selection: { filter: "item", values: [tied.values[vi]] } }
      ],
      response: { format: "json-stat2" }
    })
  });

  // 3) json-stat2 → { municipality name: population }
  const dim    = data.dimension?.[alue.code] ?? data.dimension?.[Object.keys(data.dimension)[0]];
  const labels = dim?.category?.label || {};
  const index  = dim?.category?.index || {};
  const out    = {};
  for (const [code, pos] of Object.entries(index)) {
    const v = data.value[pos];
    if (Number.isFinite(v)) out[labels[code] || code] = v;
  }
  if (!Object.keys(out).length) throw new Error("Could not parse any population figures");
  return out;
}

/** A single figure from a PxWeb table in JSON-stat2 format. */
async function haeStatFin({ taulu, query }) {
  const url = `${SOURCES.statfin.api}/${taulu}`;
  const data = await getJSON(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, response: { format: "json-stat2" } })
  });
  const v = data?.value?.find(x => x != null);
  if (!Number.isFinite(v)) throw new Error(`StatFin ${taulu}: no numeric value`);
  return v;
}

/* ── What gets fetched ─────────────────────────────────────────────── */

/* Scopes. vakiluku (population) is the divisor for the per-capita figure:
   state spending is divided across the whole country, a city's spending
   only across its own residents. */
const SCOPES = {
  valtio:   { id:"valtio",   label:"Valtio",    vakiluku: 5_600_000 },
  helsinki: { id:"helsinki", label:"Helsinki",  vakiluku:   680_000 },
  tampere:  { id:"tampere",  label:"Tampere",   vakiluku:   260_000 },
  turku:    { id:"turku",    label:"Turku",     vakiluku:   200_000 },
  oulu:     { id:"oulu",     label:"Oulu",      vakiluku:   215_000 },
  tuleva:   { id:"tuleva",   label:"Suunnitteilla", vakiluku: 5_600_000 },
  uusimaa:  { id:"uusimaa",  label:"Uusimaa",       vakiluku: 1_750_000 }
};

const PLAN = {
  items: [
    { id:"pma",  label:"Ukraina: aseapu",       source:"plm",
      fallback: 3_400_000_000, note:"kertymä 2022–5/2026, 33 pakettia" },
    { id:"hum",  label:"Ukraina: siviiliapu",   source:"um",
      fallback: 1_200_000_000, note:"kertymä, sis. vastaanottokuluja" },
    { id:"f35",  label:"hävittäjät",            source:"vk_talous",
      fetch: () => haeMomentti({ paaluokka:27, momentti:"27.10.19", vuosi:2026 }), // TODO
      fallback: 1_400_000_000, note:"talousarvio 2026" },
    { id:"pmh",  label:"puolustushankinnat",    source:"vk_talous",
      fetch: () => haeMomentti({ paaluokka:27, momentti:"27.10.18", vuosi:2026 }), // TODO
      fallback: 1_500_000_000, note:"talousarvio 2026" },
    { id:"pvtm", label:"Puolustusvoimat",       source:"vk_talous",
      fetch: () => haeMomentti({ paaluokka:27, momentti:"27.10.01", vuosi:2026 }), // TODO
      fallback: 2_600_000_000, note:"toimintamenot 2026" },
    { id:"koko", label:"koko valtion budjetti", source:"vk_talous",
      fallback: 91_300_000_000, note:"talousarvio 2026" },

    /* ── Cities and projects ──────────────────────────────────────────
       arvio = the original cost estimate, amount/fallback = the actual
       cost. If arvio is given, the script automatically creates its own
       "budget overrun" spending item from the difference. */

    { id:"hki-budjetti", scope:"helsinki", label:"Helsingin budjetti", source:"vk_kunta",
      fallback: 6_000_000_000, note:"käyttötalous — TARKISTA vuosi ja luku" },
    { id:"hki-lansimetro", scope:"helsinki", label:"Länsimetro, 1. vaihe", source:"hanke",
      fallback: 1_186_000_000, arvio: 714_000_000,
      note:"Ruoholahti–Matinkylä; valtuustojen hyväksymä arvio 2008 oli 714 M€" },
    { id:"hki-kruunusillat", scope:"helsinki", label:"Kruunusillat", source:"hanke",
      fallback: 800_000_000, arvio: 380_000_000,
      note:"raitiotieyhteys Laajasaloon; hinta kaksinkertaistui 2021" },
    { id:"hki-jokeri", scope:"helsinki", label:"Raide-Jokeri", source:"hanke",
      fallback: 386_000_000, arvio: 275_000_000,
      note:"Helsinki 268 M€ + Espoo 118 M€; arvio 2016 oli 275 M€" },
    { id:"hki-stadion", scope:"helsinki", label:"Olympiastadionin remontti", source:"hanke",
      fallback: 337_000_000, arvio: 197_000_000,
      note:"lopullinen hinta 337 M€, VTV:n mukaan arvio oli 197 M€" },
    { id:"hki-oodi", scope:"helsinki", label:"Oodi", source:"hanke",
      fallback: 98_000_000,
      note:"keskustakirjasto, valmistui 2018 — TARKISTA" },

    { id:"tre-budjetti", scope:"tampere", label:"Tampereen budjetti", source:"vk_kunta",
      fallback: 1_500_000_000, note:"käyttötalous — TARKISTA vuosi ja luku" },
    { id:"tre-ratikka", scope:"tampere", label:"Ratikka, osa 1", source:"hanke",
      fallback: 240_000_000,
      note:"Hervanta–keskusta–Tays; valtion osuus 71 M€" },
    { id:"tre-ratikka2", scope:"tampere", label:"Ratikka, osa 2", source:"hanke",
      fallback: 44_000_000, note:"keskusta–Hiedanranta–Lentävänniemi, arvio 2016" },
    { id:"tre-vaunut", scope:"tampere", label:"Ratikkavaunut", source:"hanke",
      fallback: 81_000_000, note:"kalustohankinta, arvio 2016" },
    { id:"tre-tunneli", scope:"tampere", label:"Rantatunneli", source:"hanke",
      fallback: 176_000_000, arvio: 180_000_000,
      note:"Suomen pisin maantietunneli; tavoitekustannus ALITTUI 4,1 M€:lla" },
    { id:"tre-areena", scope:"tampere", label:"Kansi ja Areena", source:"hanke",
      fallback: 550_000_000, note:"koko hanke, kaupungin osuus pienempi — TARKISTA" },

    { id:"tku-budjetti", scope:"turku", label:"Turun budjetti", source:"vk_kunta",
      fallback: 1_200_000_000, note:"käyttötalous — TARKISTA vuosi ja luku" },
    { id:"tku-ratikka", scope:"turku", label:"Turun raitiotie", source:"hanke",
      fallback: 300_000_000, note:"hankearvio — TARKISTA" },

    { id:"oul-budjetti", scope:"oulu", label:"Oulun budjetti", source:"vk_kunta",
      fallback: 1_300_000_000, note:"käyttötalous — TARKISTA vuosi ja luku" },

    /* Apotti — the patient record system for HUS and the municipalities
       of Uusimaa. The figures vary depending on what's counted in.
       Using HUS's audit committee's figure (625.6 M€, 229.5 M€ over
       estimate), since it's the audited figure and Apotti itself
       arrives at the same 58% increase. */
    { id:"apotti", scope:"uusimaa", label:"Apotti", source:"hanke",
      fallback: 626_000_000, arvio: 396_000_000,
      note:"HUSin tarkastuslautakunta 2022: 625,6 M€, 229,5 M€ yli alkuperäisen arvion; " +
           "suurin syy oli 41 % arvioitua suurempi käyttäjämäärä" },

    /* In the register only as a comparison point: NOT state or municipal
       money, but an investment by TVO and its owners. Hence vainRekisteri
       ("register-only") — this doesn't belong in budget comparisons or
       the per-capita calculation. */
    { id:"ol3", scope:"tuleva", vainRekisteri: true,
      label:"Olkiluoto 3", source:"hanke",
      fallback: 5_800_000_000, arvio: 3_200_000_000,
      note:"TVO:n investointi 5,8 mrd €; sopimushinta 2002 oli 3,2 mrd €. " +
           "Kokonaiskustannus laitostoimittajan tappiot mukaan lukien on arvioitu " +
           "n. 11 mrd €:ksi. EI julkista rahaa — mukana vain vertailukohtana" },

    /* ── Planned ────────────────────────────────────────────────────
       These are estimates, not actual costs. Planning is at different
       stages and the figures will be refined — marked tuleva: true. */

    { id:"lansirata", scope:"tuleva", tuleva:true, paatos:"ratahankkeet", label:"Länsirata (Turun tunnin juna)", source:"hanke",
      fallback: 3_400_000_000,
      note:"alustava arvio, v. 2022 hintataso; nimellisarvo 4,82 mrd €; hyöty-kustannussuhde 0,44" },
    { id:"lentorata", scope:"tuleva", tuleva:true, paatos:"ratahankkeet", label:"Lentorata", source:"hanke",
      fallback: 2_700_000_000,
      note:"30 km rataa, josta 28 km tunnelissa; Pasila–lentoasema–Kerava" },
    { id:"itarata", scope:"tuleva", tuleva:true, paatos:"ratahankkeet", label:"Itärata", source:"hanke",
      fallback: 1_800_000_000,
      note:"Helsinki–Porvoo–Kouvola; nimellisarvo 3,48 mrd €; esisuunnittelu kesken" },
    { id:"suomirata", scope:"tuleva", tuleva:true, paatos:"ratahankkeet", label:"Suomi-rata (suurnopeusvaihtoehto)", source:"hanke",
      fallback: 5_500_000_000,
      note:"lentorata + uusi suurnopeusrata; halvempi vaihtoehto 4,0 mrd €; suunnittelu keskeytetty" },
  ],
  /* The state budget's top-level categories. The tax receipt splits the
     paid state tax in these proportions. The figures are from the 2026
     budget and VERIFY before publishing — fetch-data will fetch them
     from the API once the budget-item codes are confirmed. */
  paaluokat: [
    { id:"33", label:"Sosiaali- ja terveysministeriö", fallback: 30_000_000_000,
      note:"sis. hyvinvointialueiden rahoituksen" },
    { id:"28", label:"Valtiovarainministeriö",         fallback: 22_500_000_000,
      note:"sis. kuntien valtionosuudet ja EU-maksut" },
    { id:"29", label:"Opetus- ja kulttuuriministeriö", fallback:  8_200_000_000 },
    { id:"27", label:"Puolustusministeriö",            fallback:  6_400_000_000 },
    { id:"32", label:"Työ- ja elinkeinoministeriö",    fallback:  3_600_000_000 },
    { id:"31", label:"Liikenne- ja viestintäministeriö", fallback: 3_500_000_000 },
    { id:"36", label:"Valtionvelan korot",             fallback:  3_500_000_000 },
    { id:"30", label:"Maa- ja metsätalousministeriö",  fallback:  2_700_000_000 },
    { id:"26", label:"Sisäministeriö",                 fallback:  1_900_000_000 },
    { id:"24", label:"Ulkoministeriö",                 fallback:  1_400_000_000,
      note:"sis. kehitysyhteistyön" },
    { id:"25", label:"Oikeusministeriö",               fallback:  1_100_000_000 },
    { id:"muu", label:"Muut pääluokat",                fallback:  6_500_000_000 }
  ],

  units: [
    { id:"ruoka",  label:"viikon ruokaostosta",         source:"arvio",   fallback:150,     note:"perhe, viikko" },
    { id:"lapsi",  label:"lapsilisää vuodeksi",         source:"arvio",   fallback:1500,    note:"yksi lapsi" },
    { id:"palkka", label:"kuukauden palkkaa",           source:"statfin",
      // TODO: verify the table id against StatFin's earnings-level statistics
      fetch: () => haeStatFin({ taulu:"pal/statfin_pal_pxt_11zt.px", query:[] }),
      fallback:3600, note:"mediaaniansio, brutto" },
    { id:"opp",    label:"oppilasvuotta peruskoulussa", source:"arvio",   fallback:10000,   note:"per oppilas" },
    { id:"hoit",   label:"hoitajan vuosipalkkaa",       source:"arvio",   fallback:48000,   note:"palkka + työnantajakulut" },
    { id:"tie",    label:"kilometriä tienkorjausta",    source:"arvio",   fallback:400000,  note:"päällystetty tie" },
    { id:"pk",     label:"uutta päiväkotia",            source:"arvio",   fallback:6000000, note:"n. 100 paikkaa" },
    { id:"oodi",   label:"Oodia",                       source:"arvio",   fallback:98000000,note:"toteutunut rakennuskustannus" }
  ],
  vakiluku: {
    source:"statfin",
    // TODO: verify the population-table id
    fetch: () => haeStatFin({ taulu:"vaerak/statfin_vaerak_pxt_11ra.px", query:[] }),
    fallback: 5_600_000
  }
};

/* ── Execution ──────────────────────────────────────────────────────── */

async function resolve(entry) {
  const src = SOURCES[entry.source];
  const base = {
    id: entry.id,
    scope: entry.scope || "valtio",
    arvio: entry.arvio || null,
    tuleva: !!entry.tuleva,
    paatos: entry.paatos || null,
    vainRekisteri: !!entry.vainRekisteri,
    label: entry.label,
    note: entry.note,
    source: { ...src, retrieved: null }
  };

  if (!entry.fetch) {
    return { ...base, value: entry.fallback, status: src.kind === "estimate" ? "arvio" : "kasin" };
  }
  try {
    const value = await entry.fetch();
    console.log(`  ✓ ${entry.id.padEnd(8)} ${value}`);
    return { ...base, value, status: "rajapinta", source: { ...src, retrieved: now } };
  } catch (err) {
    console.warn(`  ! ${entry.id.padEnd(8)} fetch failed (${err.message}) — using the fallback value`);
    return { ...base, value: entry.fallback, status: "varaluku", error: err.message };
  }
}

console.log("Fetching municipal population figures…");
try {
  const vak = await haeVakiluvut();
  let osui = 0;
  for (const sc of Object.values(SCOPES)) {
    if (sc.id === "valtio") {
      if (vak["KOKO MAA"]) { sc.vakiluku = vak["KOKO MAA"]; osui++; }
      continue;
    }
    const nimi = sc.label;
    if (vak[nimi]) { sc.vakiluku = vak[nimi]; osui++; }
    else console.warn(`  ! ${nimi}: population figure not found, using the fallback value`);
  }
  SOURCES.kuntien_avainluvut.retrieved = now;
  console.log(`  ✓ ${osui}/${Object.keys(SCOPES).length} scopes from the API ` +
              `(${Object.keys(vak).length} municipalities available)`);
} catch (err) {
  console.warn(`  ! fetching population figures failed (${err.message}) — using fallback values`);
}

console.log("Fetching spending items…");
const items = [];
for (const e of PLAN.items) items.push(await resolve(e));

// A budget overrun as its own spending item. An under-run is marked separately.
const johdetut = [];
for (const it of items) {
  if (!it.arvio || it.tuleva || it.vainRekisteri) continue;
  const ero = it.value - it.arvio;
  if (Math.abs(ero) < 1_000_000) continue;
  johdetut.push({
    ...it,
    arvio: null,            // a derived entry isn't itself comparable
    johdettu: true,
    id: it.id + "-ylitys",
    label: it.label + (ero > 0 ? ": ylitys" : ": alitus"),
    value: Math.abs(ero),
    note: ero > 0
        ? `toteutunut ${Math.round(it.value/1e6)} M€, arvio oli ${Math.round(it.arvio/1e6)} M€`
        : `arvio oli ${Math.round(it.arvio/1e6)} M€, toteutunut ${Math.round(it.value/1e6)} M€ — hanke alitti budjettinsa`,
    status: it.status
  });
}
items.push(...johdetut);
console.log(`  → ${johdetut.length} derived overrun/under-run entries`);

console.log("Fetching unit prices…");
const units = [];
for (const e of PLAN.units) units.push(await resolve(e));

console.log("Fetching population…");
const vak = await resolve({ id:"vakiluku", label:"väkiluku", ...PLAN.vakiluku });

/* Historical overrun record. Used for planned projects: "if this behaves
   like previous ones, the cost is X". Median, not average, so one
   runaway project doesn't skew it. Under-runs are counted in. */
const suhteet = items
  .filter(i => i.arvio && !i.tuleva && i.arvio > 0)
  .map(i => ({ label: i.label, suhde: i.value / i.arvio }))
  .sort((a, b) => a.suhde - b.suhde);

const mediaani = suhteet.length
  ? suhteet[Math.floor(suhteet.length / 2)].suhde
  : null;

if (mediaani) {
  console.log(`\nHistorical overrun record (${suhteet.length} projects):`);
  for (const x of suhteet) console.log(`  ${x.suhde.toFixed(2)}×  ${x.label}`);
  console.log(`  median ${mediaani.toFixed(2)}×`);
}

const out = {
  generated: now,
  ylityshistoria: mediaani ? {
    mediaani,
    otos: suhteet.length,
    hankkeet: suhteet.map(x => ({ label: x.label, suhde: Number(x.suhde.toFixed(3)) }))
  } : null,
  vakiluku: vak.value,
  vakilukuSource: vak.source,
  scopes: Object.fromEntries(Object.entries(SCOPES).map(([k, v]) =>
    [k, { ...v, label_en: SCOPES_EN[k] || v.label }])),
  vakilukuLahde: SOURCES.kuntien_avainluvut,
  items: items.map(i => ({
    id:i.id, scope:i.scope, label:i.label, amount:i.value, arvio:i.arvio || null, tuleva:!!i.tuleva, paatos:i.paatos||null, vainRekisteri:!!i.vainRekisteri,
    label_en: (ITEMS_EN[i.id] || [])[0] || i.label,
    note_en:  (ITEMS_EN[i.id] || [])[1] ?? i.note,
    vakiluku: SCOPES[i.scope]?.vakiluku ?? vak.value,
    note:i.note, status:i.status, source:i.source
  })),
  paaluokat: PLAN.paaluokat.map(p => ({
    id:p.id, label:p.label, amount:p.fallback, note:p.note || "", status:"kasin",
    label_en: (PAALUOKAT_EN[p.id] || [])[0] || p.label,
    note_en:  (PAALUOKAT_EN[p.id] || [])[1] ?? (p.note || "")
  })),
  units: units.map(u => ({ id:u.id, label:u.label, cost:u.value,  note:u.note, status:u.status, source:u.source,
    label_en: (UNITS_EN[u.id] || [])[0] || u.label,
    note_en:  (UNITS_EN[u.id] || [])[1] ?? u.note }))
};

await fs.writeFile(OUT, JSON.stringify(out, null, 2), "utf8");

const live = [...items, ...units].filter(x => x.status === "rajapinta").length;
console.log(`\nWrote ${OUT} — ${live} figures from the API, ${items.length + units.length - live} from elsewhere.`);
