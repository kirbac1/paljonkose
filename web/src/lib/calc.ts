import type { Calculation, Dataset, Item, Lang, Unit } from "../types";

/** Lukijan oman summan synteettinen erä-id. Ei koskaan omaa /p/-sivua. */
export const OWN_ID = "__oma";

/**
 * Laskutoimitus. Puhdas funktio ilman React-riippuvuuksia, jotta se on
 * testattavissa ilman renderöintiä — tämä on koko laskimen ydin ja
 * ainoa kohta, jossa lukuja käsitellään.
 */
export function calculate(item: Item, unit: Unit, cost?: number): Calculation {
  const used = cost != null && cost > 0 ? cost : unit.cost;
  const count = Math.floor(item.amount / used);

  return {
    item,
    unit,
    cost: used,
    edited: Math.abs(used - unit.cost) > 0.005,
    count,
    // Summa voi olla yksikköä pienempi. "0 hoitajan vuosipalkkaa" on
    // umpikuja, joten kerrotaan osuus sen sijaan.
    fraction: count < 1 ? item.amount / used : null,
    remainder: item.amount - count * used,
    perCapita: item.amount / (item.vakiluku || 1)
  };
}

/** Menoerät, joilla on oma laskusivu. Nostot ja vertailukohdat eivät. */
export function comparableItems(data: Dataset): Item[] {
  return data.items.filter(i => !i.nosto && !i.vainRekisteri);
}

/**
 * Halvin yksikkö, joka antaa vähintään yhden kappaleen. Käytetään kun
 * lukija syöttää pienen summan — muuten hän näkee pelkän nollan.
 */
export function bestUnitFor(amount: number, units: Unit[]): Unit | undefined {
  const affordable = units.filter(u => amount >= u.cost);
  if (affordable.length) {
    return affordable.reduce((a, b) => (b.cost > a.cost ? b : a));
  }
  return units.reduce<Unit | undefined>(
    (a, b) => (!a || b.cost < a.cost ? b : a), undefined);
}

/**
 * Polku laskutoimituksen omalle jaettavalle sivulle (sama slug-kaava kuin
 * server.mjs:n combo()), tai null jos sellaista ei ole: lukijan oma summa
 * ei koskaan saa sivua, eikä yksikköä pienempi summa (server ei tee
 * sivua kun count < 1 — se näyttäisi tyhjän tai nollan).
 */
export function comboPath(calc: Calculation, lang: Lang): string | null {
  if (calc.item.id === OWN_ID || calc.count < 1) return null;
  const slug = `${calc.item.id}-${calc.unit.id}` +
    (calc.edited ? `-${Math.round(calc.cost)}` : "");
  return lang === "en" ? `/en/p/${slug}/` : `/p/${slug}/`;
}

/**
 * Hankkeet, jotka kilpailevat samasta määrärahasta. Vain näissä vertailu
 * on aito vaihtoehto — hävittäjä vastaan päiväkoti ei ole.
 */
export function rivals(data: Dataset, item: Item): Item[] {
  if (!item.paatos) return [];
  return data.items
    .filter(x => x.paatos === item.paatos && x.id !== item.id)
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Ennuste toteutuneen ylityshistorian mediaanilla. Vain suunnitteilla
 * oleville hankkeille, joiden hinta on arvio eikä toteutunut.
 */
export function forecast(data: Dataset, c: Calculation) {
  if (!c.item.tuleva || !data.ylityshistoria) return null;
  const { mediaani, otos } = data.ylityshistoria;
  const amount = c.item.amount * mediaani;
  return { ratio: mediaani, sample: otos, amount, count: Math.floor(amount / c.cost) };
}
