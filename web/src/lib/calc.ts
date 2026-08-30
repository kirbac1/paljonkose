import type { Calculation, Dataset, Item, Lang, Unit } from "../types";

/** Synthetic item id for the reader's own sum. Never has a /p/ page of its own. */
export const OWN_ID = "__oma";

/**
 * The calculation. A pure function with no React dependency, so it's
 * testable without rendering — this is the entire core of the
 * calculator and the only place numbers are handled.
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
    // The sum can be smaller than the unit. "0 nurses' annual salaries"
    // is a dead end, so a fraction is shown instead.
    fraction: count < 1 ? item.amount / used : null,
    remainder: item.amount - count * used,
    perCapita: item.amount / (item.vakiluku || 1)
  };
}

/** Spending items that have their own calculation page. News items and comparison points don't. */
export function comparableItems(data: Dataset): Item[] {
  return data.items.filter(i => !i.nosto && !i.vainRekisteri);
}

/**
 * The cheapest unit that yields at least one whole item. Used when the
 * reader enters a small sum — otherwise they'd just see a zero.
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
 * The path to the calculation's own shareable page (the same slug
 * scheme as server.mjs's combo()), or null if there isn't one: the
 * reader's own sum never gets a page, and neither does a sum smaller
 * than the unit (the server doesn't build a page when count < 1 — it
 * would show a blank or a zero).
 */
export function comboPath(calc: Calculation, lang: Lang): string | null {
  if (calc.item.id === OWN_ID || calc.count < 1) return null;
  const slug = `${calc.item.id}-${calc.unit.id}` +
    (calc.edited ? `-${Math.round(calc.cost)}` : "");
  return lang === "en" ? `/en/p/${slug}/` : `/p/${slug}/`;
}

/**
 * Projects competing for the same funding. Only here is the comparison
 * a real alternative — fighter jet vs. daycare center isn't.
 */
export function rivals(data: Dataset, item: Item): Item[] {
  if (!item.paatos) return [];
  return data.items
    .filter(x => x.paatos === item.paatos && x.id !== item.id)
    .sort((a, b) => b.amount - a.amount);
}

/**
 * A forecast using the historical overrun record's median. Only for
 * planned projects whose price is an estimate, not an actual cost.
 */
export function forecast(data: Dataset, c: Calculation) {
  if (!c.item.tuleva || !data.ylityshistoria) return null;
  const { mediaani, otos } = data.ylityshistoria;
  const amount = c.item.amount * mediaani;
  return { ratio: mediaani, sample: otos, amount, count: Math.floor(amount / c.cost) };
}
