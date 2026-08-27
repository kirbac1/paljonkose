#!/usr/bin/env node
/**
 * fetch-data.mjs — hakee luvut avoimista rajapinnoista ja kirjoittaa data.json.
 *
 * Aja:  node fetch-data.mjs
 * Ajastus: .github/workflows/update-data.yml (kerran vuorokaudessa)
 *
 * Miksi build-aikana eikä selaimessa:
 *   Valtion rajapinnat eivät takaa CORS-otsikoita, joten selaimesta tehty
 *   suora kutsu voi kaatua. Haku tehdään palvelimella, sivu lukee vain
 *   oman data.json-tiedostonsa. Sivusto pysyy staattisena.
 *
 * TARKISTA ENNEN TUOTANTOA: taulukko- ja momenttitunnukset merkitty TODO.
 */

import fs from "node:fs/promises";

const OUT = "data.json";
const now = new Date().toISOString();

/* ── Lähderekisteri ───────────────────────────────────────────────────────
   Jokainen luku kantaa oman alkuperänsä. Sama objekti ajaa sekä haun että
   sivun "Mistä tämä luku tulee" -tiedon. Yksi totuus, ei kahta listaa.   */

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
    // Oma PxWeb-kantansa samalla palvelimella. Tästä saa kaupunkien
    // toimintamenot ja investoinnit — TODO: taulun tunnus.
    api: "https://pxdata.stat.fi/PxWeb/api/v1/fi/Kuntien_talous",
    docs: "https://pxdata.stat.fi/PXWeb/pxweb/fi/",
    licence: "CC BY 4.0",
    kind: "api"
  },
  hinta: {
    name: "Kuluttajahinta — karkea keskiarvo",
    docs: "https://www.stat.fi/tilasto/khi",
    licence: "—",
    kind: "estimate",
    note: "Vaihtelee paikkakunnittain ja liikkeittäin. Muokkaa hintaa itse."
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

/* ── Apurit ──────────────────────────────────────────────────────────── */

async function getJSON(url, opts = {}) {
  const res = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "paljonkose/1.0" },
    ...opts
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

/** Valtion talousarvion momentti Valtiokonttorin talous-APIsta.
 *  Esim. pääluokka 27 = puolustusministeriön hallinnonala.
 *  TODO: varmista kentät api.tutkihallintoa.fi/talous/v1 dokumentaatiosta. */
async function haeMomentti({ paaluokka, momentti, vuosi }) {
  const url = `${SOURCES.vk_talous.api}?paaluokka=${paaluokka}&vuosi=${vuosi}`;
  const data = await getJSON(url);
  const rows = Array.isArray(data) ? data : (data.value ?? data.results ?? []);
  const hit = rows.find(r =>
    String(r.momentti ?? r.tunnus ?? "").startsWith(momentti)
  );
  if (!hit) throw new Error(`Momenttia ${momentti} ei löytynyt pääluokasta ${paaluokka}`);
  const euros = Number(hit.maara ?? hit.summa ?? hit.arvo);
  if (!Number.isFinite(euros)) throw new Error(`Momentin ${momentti} arvo ei ole luku`);
  return euros;
}

/**
 * Väkiluvut kaikille kunnille Kuntien avainluvut -kannasta.
 *
 * 8.6.2026 tietokantamuutos lyhensi tunnuksia ja muutti muuttujakoodeja,
 * joten koodeja ei kovakoodata: haetaan ensin metatiedot ja etsitään
 * muuttujat ja arvot nimen perusteella. Kestää seuraavankin muutoksen.
 */
const AVAINLUVUT_TAULU =
  "Kuntien_avainluvut__uusin/kuntien_avainluvut_viimeisin.px";

async function haeVakiluvut() {
  const base = SOURCES.kuntien_avainluvut.api;
  const url  = `${base}/${AVAINLUVUT_TAULU}`;

  // 1) metatiedot: mitkä muuttujat ja mitkä koodit
  const meta = await getJSON(url);
  const vars = meta.variables || [];

  const alue = vars.find(v => /alue/i.test(v.code) || /alue/i.test(v.text));
  const tied = vars.find(v => /tiedot/i.test(v.code) || /tiedot/i.test(v.text));
  if (!alue || !tied) throw new Error("Alue- tai Tiedot-muuttujaa ei löytynyt");

  // "Väkiluku, 2025" — poimitaan nimen perusteella, ei koodin
  const vi = tied.valueTexts.findIndex(t => /^väkiluku,/i.test(t.trim()));
  if (vi < 0) throw new Error("Väkiluku-arvoa ei löytynyt Tiedot-muuttujasta");

  // 2) data kaikille alueille
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

  // 3) json-stat2 → { kunnannimi: väkiluku }
  const dim    = data.dimension?.[alue.code] ?? data.dimension?.[Object.keys(data.dimension)[0]];
  const labels = dim?.category?.label || {};
  const index  = dim?.category?.index || {};
  const out    = {};
  for (const [code, pos] of Object.entries(index)) {
    const v = data.value[pos];
    if (Number.isFinite(v)) out[labels[code] || code] = v;
  }
  if (!Object.keys(out).length) throw new Error("Väkilukuja ei saatu jäsennettyä");
  return out;
}

/** PxWeb-taulukon yksittäinen luku JSON-stat2-muodossa. */
async function haeStatFin({ taulu, query }) {
  const url = `${SOURCES.statfin.api}/${taulu}`;
  const data = await getJSON(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, response: { format: "json-stat2" } })
  });
  const v = data?.value?.find(x => x != null);
  if (!Number.isFinite(v)) throw new Error(`StatFin ${taulu}: ei numeerista arvoa`);
  return v;
}

/* ── Mitä haetaan ────────────────────────────────────────────────────── */

/* Alueet. vakiluku on asukaskohtaisen luvun jakaja: valtion menot
   jaetaan koko maalla, kaupungin menot vain sen omilla asukkailla. */
const SCOPES = {
  valtio:   { id:"valtio",   label:"Valtio",    vakiluku: 5_600_000 },
  helsinki: { id:"helsinki", label:"Helsinki",  vakiluku:   680_000 },
  tampere:  { id:"tampere",  label:"Tampere",   vakiluku:   260_000 },
  turku:    { id:"turku",    label:"Turku",     vakiluku:   200_000 },
  oulu:     { id:"oulu",     label:"Oulu",      vakiluku:   215_000 },
  tuleva:   { id:"tuleva",   label:"Suunnitteilla", vakiluku: 5_600_000 },
  arki:     { id:"arki",     label:"Arkiostokset",  vakiluku: 5_600_000, arki:true }
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

    /* ── Kaupungit ja hankkeet ──────────────────────────────────────
       arvio = alkuperäinen kustannusarvio, amount/fallback = toteutunut.
       Jos arvio on annettu, skripti luo automaattisesti oman
       "budjetin ylitys" -menoerän erotuksesta. */

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

    /* ── Suunnitteilla ──────────────────────────────────────────────
       Nämä ovat arvioita, eivät toteutuneita kustannuksia. Suunnittelu
       on eri vaiheissa ja luvut tarkentuvat — merkitty tuleva: true. */

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

    /* ── Arkiostokset ───────────────────────────────────────────────
       Kertaluokka on toinen, laskutoimitus sama. Hinnat ovat karkeita
       keskiarvoja ja vaihtelevat paikkakunnittain — siksi jokainen on
       lukijan muokattavissa, kuten muutkin yksikköhinnat.
       Sävysääntö: ei paheita, ei syyllistämistä. Vertailu on
       kokoluokan havainnollistus, ei talousneuvo. */

    { id:"ark-burgeri",  scope:"arki", arki:true, source:"hinta", fallback: 12,
      label:"Hampurilaisateria",        note:"pikaruokala, ateria juomineen" },
    { id:"ark-latte",    scope:"arki", arki:true, source:"hinta", fallback: 5,
      label:"Erikoiskahvi kahvilassa",  note:"latte tai vastaava" },
    { id:"ark-lounas",   scope:"arki", arki:true, source:"hinta", fallback: 13,
      label:"Lounas ravintolassa",      note:"arkilounas" },
    { id:"ark-suoratoisto", scope:"arki", arki:true, source:"hinta", fallback: 168,
      label:"Suoratoistopalvelu vuodeksi", note:"n. 14 €/kk" },
    { id:"ark-liittyma", scope:"arki", arki:true, source:"hinta", fallback: 300,
      label:"Puhelinliittymä vuodeksi", note:"n. 25 €/kk" },
    { id:"ark-puhelin",  scope:"arki", arki:true, source:"hinta", fallback: 900,
      label:"Uusi puhelin",             note:"keskihintainen älypuhelin" },
    { id:"ark-renkaat",  scope:"arki", arki:true, source:"hinta", fallback: 600,
      label:"Talvirenkaat",             note:"rengassarja asennettuna" },
    { id:"ark-lomamatka", scope:"arki", arki:true, source:"hinta", fallback: 800,
      label:"Viikon etelänmatka",       note:"yksi henkilö, valmismatka" }
  ],
  /* Valtion budjetin pääluokat. Verokuitti jakaa maksetun valtionveron
     näiden osuuksien suhteessa. Luvut ovat vuoden 2026 talousarviosta ja
     TARKISTA ennen julkaisua — fetch-data hakee ne rajapinnasta, kun
     momenttitunnukset on varmistettu. */
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
    /* Arkiyksiköt — pieni kertaluokka. Merkitty arki:true, jotta
       miljardeja ei tarjota porkkanakiloina eikä toisin päin. */
    { id:"pork",  arki:true, label:"kiloa porkkanoita", source:"hinta", fallback:1.5, note:"kaupan kilohinta" },
    { id:"maito", arki:true, label:"litraa maitoa",     source:"hinta", fallback:1.2, note:"kevytmaito" },
    { id:"leipa", arki:true, label:"leipää",            source:"hinta", fallback:2.5, note:"tavallinen ruokaleipä" },
    { id:"bussi", arki:true, label:"bussilippua",       source:"hinta", fallback:3.2, note:"kertalippu, kaupunkiliikenne" },
    { id:"leffa", arki:true, label:"elokuvalippua",     source:"hinta", fallback:14,  note:"aikuinen, ilta" },
    { id:"kirja", arki:true, label:"kirjaa",            source:"hinta", fallback:25,  note:"uusi kovakantinen" },

    { id:"ruoka",  label:"viikon ruokaostosta",         source:"arvio",   fallback:150,     note:"perhe, viikko" },
    { id:"lapsi",  label:"lapsilisää vuodeksi",         source:"arvio",   fallback:1500,    note:"yksi lapsi" },
    { id:"palkka", label:"kuukauden palkkaa",           source:"statfin",
      // TODO: varmista taulun tunnus StatFinin ansiotasotilastosta
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
    // TODO: varmista väkilukutaulun tunnus
    fetch: () => haeStatFin({ taulu:"vaerak/statfin_vaerak_pxt_11ra.px", query:[] }),
    fallback: 5_600_000
  }
};

/* ── Suoritus ────────────────────────────────────────────────────────── */

async function resolve(entry) {
  const src = SOURCES[entry.source];
  const base = {
    id: entry.id,
    scope: entry.scope || "valtio",
    arvio: entry.arvio || null,
    tuleva: !!entry.tuleva,
    arki: !!entry.arki,
    paatos: entry.paatos || null,
    arkiYksikko: !!entry.arki,
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
    console.warn(`  ! ${entry.id.padEnd(8)} haku epäonnistui (${err.message}) — käytetään varalukua`);
    return { ...base, value: entry.fallback, status: "varaluku", error: err.message };
  }
}

console.log("Haetaan kuntien väkiluvut…");
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
    else console.warn(`  ! ${nimi}: väkilukua ei löytynyt, käytetään varalukua`);
  }
  SOURCES.kuntien_avainluvut.retrieved = now;
  console.log(`  ✓ ${osui}/${Object.keys(SCOPES).length} aluetta rajapinnasta ` +
              `(${Object.keys(vak).length} kuntaa saatavilla)`);
} catch (err) {
  console.warn(`  ! väkilukuhaku epäonnistui (${err.message}) — käytetään varalukuja`);
}

console.log("Haetaan menoerät…");
const items = [];
for (const e of PLAN.items) items.push(await resolve(e));

// Budjetin ylitys omaksi menoeräkseen. Alitus merkitään erikseen.
const johdetut = [];
for (const it of items) {
  if (!it.arvio || it.tuleva) continue;
  const ero = it.value - it.arvio;
  if (Math.abs(ero) < 1_000_000) continue;
  johdetut.push({
    ...it,
    arvio: null,            // johdettu erä ei itse ole vertailukelpoinen
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
console.log(`  → ${johdetut.length} johdettua ylitys/alitus-eraa`);

console.log("Haetaan yksikköhinnat…");
const units = [];
for (const e of PLAN.units) units.push(await resolve(e));

console.log("Haetaan väkiluku…");
const vak = await resolve({ id:"vakiluku", label:"väkiluku", ...PLAN.vakiluku });

/* Toteutunut ylityshistoria. Käytetään tulevien hankkeiden yhteydessä:
   "jos tämä käyttäytyy kuten aiemmat, hinta on X". Mediaani, ei keskiarvo,
   jottei yksi karkaava hanke vääristä. Alitukset lasketaan mukaan. */
const suhteet = items
  .filter(i => i.arvio && !i.tuleva && i.arvio > 0)
  .map(i => ({ label: i.label, suhde: i.value / i.arvio }))
  .sort((a, b) => a.suhde - b.suhde);

const mediaani = suhteet.length
  ? suhteet[Math.floor(suhteet.length / 2)].suhde
  : null;

if (mediaani) {
  console.log(`\nToteutunut ylityshistoria (${suhteet.length} hanketta):`);
  for (const x of suhteet) console.log(`  ${x.suhde.toFixed(2)}×  ${x.label}`);
  console.log(`  mediaani ${mediaani.toFixed(2)}×`);
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
  scopes: SCOPES,
  vakilukuLahde: SOURCES.kuntien_avainluvut,
  items: items.map(i => ({
    id:i.id, scope:i.scope, label:i.label, amount:i.value, arvio:i.arvio || null, tuleva:!!i.tuleva, arki:!!i.arki, paatos:i.paatos||null,
    vakiluku: SCOPES[i.scope]?.vakiluku ?? vak.value,
    note:i.note, status:i.status, source:i.source
  })),
  paaluokat: PLAN.paaluokat.map(p => ({
    id:p.id, label:p.label, amount:p.fallback, note:p.note || "", status:"kasin"
  })),
  units: units.map(u => ({ id:u.id, label:u.label, cost:u.value,  note:u.note, status:u.status, source:u.source, arki:!!u.arki }))
};

await fs.writeFile(OUT, JSON.stringify(out, null, 2), "utf8");

const live = [...items, ...units].filter(x => x.status === "rajapinta").length;
console.log(`\nKirjoitettu ${OUT} — ${live} lukua rajapinnasta, ${items.length + units.length - live} muualta.`);
