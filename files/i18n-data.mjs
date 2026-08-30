/**
 * i18n-data.mjs — englanninkieliset vastineet datan nimikkeille.
 *
 * Pidetään erillään fetch-data.mjs:stä, jotta menoerien määrittelyt
 * pysyvät luettavina ja käännökset yhdessä paikassa. fetch-data.mjs
 * liittää nämä data.jsoniin kenttinä label_en ja note_en.
 *
 * Jos lisäät menoerän tai yksikön, lisää käännös tänne. Puuttuva
 * käännös ei kaada mitään — sivu näyttää silloin suomenkielisen
 * nimikkeen, mikä on huomattavampaa kuin hiljainen tyhjä kohta.
 */

export const ITEMS_EN = {
  pma:            ["Ukraine: military aid", "cumulative 2022–5/2026, 33 packages"],
  hum:            ["Ukraine: civilian aid", "cumulative, incl. reception costs"],
  f35:            ["fighter jets", "2026 budget"],
  pmh:            ["defence procurement", "2026 budget"],
  pvtm:           ["Defence Forces", "operating expenses 2026"],
  koko:           ["the entire state budget", "2026 budget"],

  "hki-budjetti":    ["Helsinki city budget", "operating budget — VERIFY year and figure"],
  "hki-lansimetro":  ["West Metro, phase 1", "Ruoholahti–Matinkylä; the 2008 estimate approved by the councils was 714 M€"],
  "hki-kruunusillat":["Crown Bridges", "tram link to Laajasalo; cost doubled in 2021"],
  "hki-jokeri":      ["Jokeri Light Rail", "Helsinki 268 M€ + Espoo 118 M€; 2016 estimate was 275 M€"],
  "hki-stadion":     ["Olympic Stadium renovation", "final cost 337 M€; according to the National Audit Office the estimate was 197 M€"],
  "hki-oodi":        ["Oodi", "central library, completed 2018 — VERIFY"],

  "tre-budjetti":  ["Tampere city budget", "operating budget — VERIFY year and figure"],
  "tre-ratikka":   ["Tram, part 1", "Hervanta–centre–Tays; state share 71 M€"],
  "tre-ratikka2":  ["Tram, part 2", "centre–Hiedanranta–Lentävänniemi, 2016 estimate"],
  "tre-vaunut":    ["Tram vehicles", "rolling stock, 2016 estimate"],
  "tre-tunneli":   ["Rantatunneli", "Finland's longest road tunnel; came in 4.1 M€ UNDER its target cost"],
  "tre-areena":    ["Deck and Arena", "whole project; the city's share is smaller — VERIFY"],

  "tku-budjetti":  ["Turku city budget", "operating budget — VERIFY year and figure"],
  "tku-ratikka":   ["Turku tram", "project estimate — VERIFY"],
  "oul-budjetti":  ["Oulu city budget", "operating budget — VERIFY year and figure"],

  apotti: ["Apotti", "HUS audit committee 2022: 625.6 M€, 229.5 M€ above the original estimate; the main cause was a user count 41 % higher than forecast"],
  ol3: ["Olkiluoto 3", "TVO's investment 5.8 bn €; the 2002 contract price was 3.2 bn €. Total cost including the supplier's losses has been estimated at about 11 bn €. NOT public money — included for comparison only"],
  "apotti-ylitys": ["Apotti: overrun", "actual 626 M€, estimate was 396 M€"],
  "ol3-ylitys": ["Olkiluoto 3: overrun", "actual 5.8 bn €, estimate was 3.2 bn €"],

  lansirata:  ["Western Railway (Turku one-hour train)", "preliminary estimate, 2022 price level; nominal value 4.82 bn €; benefit-cost ratio 0.44"],
  lentorata:  ["Airport Rail Line", "30 km of track, 28 km of it in tunnel; Pasila–airport–Kerava"],
  itarata:    ["Eastern Railway", "Helsinki–Porvoo–Kouvola; nominal value 3.48 bn €; preliminary planning under way"],
  suomirata:  ["Finland Line (high-speed option)", "airport line + new high-speed track; cheaper option 4.0 bn €; planning suspended"],


  "hki-lansimetro-ylitys":   ["West Metro, phase 1: overrun", "actual 1186 M€, estimate was 714 M€"],
  "hki-kruunusillat-ylitys": ["Crown Bridges: overrun", "actual 800 M€, estimate was 380 M€"],
  "hki-jokeri-ylitys":       ["Jokeri Light Rail: overrun", "actual 386 M€, estimate was 275 M€"],
  "hki-stadion-ylitys":      ["Olympic Stadium renovation: overrun", "actual 337 M€, estimate was 197 M€"],
  "tre-tunneli-ylitys":      ["Rantatunneli: under budget", "estimate was 180 M€, actual 176 M€ — the project came in under budget"]
};

export const UNITS_EN = {
  ruoka:  ["weekly grocery shops", "family, one week"],
  lapsi:  ["years of child benefit", "one child"],
  palkka: ["months of salary", "median earnings, gross"],
  opp:    ["pupil-years of basic education", "per pupil"],
  hoit:   ["nurses' annual salaries", "salary plus employer costs"],
  tie:    ["kilometres of road repair", "paved road"],
  pk:     ["new daycare centres", "approx. 100 places"],
  oodi:   ["Oodi libraries", "actual construction cost"]
};

export const SCOPES_EN = {
  valtio:   "State",
  helsinki: "Helsinki",
  tampere:  "Tampere",
  turku:    "Turku",
  oulu:     "Oulu",
  tuleva:   "Planned",
  uusimaa:  "Uusimaa"
};

export const PAALUOKAT_EN = {
  "33":  ["Ministry of Social Affairs and Health", "incl. funding for the wellbeing services counties"],
  "28":  ["Ministry of Finance", "incl. central government transfers to municipalities and EU payments"],
  "29":  ["Ministry of Education and Culture", ""],
  "27":  ["Ministry of Defence", ""],
  "32":  ["Ministry of Economic Affairs and Employment", ""],
  "31":  ["Ministry of Transport and Communications", ""],
  "36":  ["Interest on central government debt", ""],
  "30":  ["Ministry of Agriculture and Forestry", ""],
  "26":  ["Ministry of the Interior", ""],
  "24":  ["Ministry for Foreign Affairs", "incl. development cooperation"],
  "25":  ["Ministry of Justice", ""],
  muu:   ["Other main classes", ""]
};

/* Demonyymit per capita -riville. Paljaita substantiiveja, koska
   käännös lisää eteen "per" — "per every person" olisi väärin. */
export const ASUKAS_EN = {
  valtio:   "person in Finland",
  helsinki: "Helsinki resident",
  tampere:  "Tampere resident",
  turku:    "Turku resident",
  oulu:     "Oulu resident",
  tuleva:   "person in Finland",
  uusimaa:  "Uusimaa resident"
};
