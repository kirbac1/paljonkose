import { describe, expect, it } from "vitest";
import { OWN_ID, bestUnitFor, calculate, comboPath, comparableItems, rivals } from "./calc";
import type { Dataset, Item, Unit } from "../types";

const item = (over: Partial<Item> = {}): Item => ({
  id: "x", scope: "valtio", label: "Erä", label_en: "Item",
  amount: 1_000_000, note: "", note_en: "", vakiluku: 5_600_000,
  status: "kasin", ...over
});

const unit = (over: Partial<Unit> = {}): Unit => ({
  id: "u", label: "yksikköä", label_en: "units", cost: 1000,
  status: "kasin", ...over
});

describe("calculate", () => {
  it("divides the sum by the unit price", () => {
    const c = calculate(item({ amount: 10_000 }), unit({ cost: 3000 }));
    expect(c.count).toBe(3);
    expect(c.remainder).toBe(1000);
    expect(c.fraction).toBeNull();
  });

  it("returns a fraction when the sum is smaller than the unit", () => {
    // "0 nurses' annual salaries" is a dead end — the reader needs some number
    const c = calculate(item({ amount: 12 }), unit({ cost: 150 }));
    expect(c.count).toBe(0);
    expect(c.fraction).toBeCloseTo(0.08);
  });

  it("flags an edited price", () => {
    expect(calculate(item(), unit({ cost: 1000 }), 2000).edited).toBe(true);
    expect(calculate(item(), unit({ cost: 1000 }), 1000).edited).toBe(false);
  });

  it("ignores an invalid price and uses the unit's own", () => {
    expect(calculate(item(), unit({ cost: 1000 }), 0).cost).toBe(1000);
    expect(calculate(item(), unit({ cost: 1000 }), -5).cost).toBe(1000);
  });

  it("computes the per-capita share using the item's own population, not the whole country's", () => {
    const c = calculate(item({ scope: "tampere", vakiluku: 260_000, amount: 2_600_000 }), unit());
    expect(c.perCapita).toBe(10);
  });
});

describe("comparableItems", () => {
  it("excludes news items and comparison points", () => {
    const data = { items: [
      item({ id: "a" }),
      item({ id: "b", nosto: true }),
      item({ id: "c", vainRekisteri: true })
    ] } as Dataset;
    expect(comparableItems(data).map(i => i.id)).toEqual(["a"]);
  });
});

describe("bestUnitFor", () => {
  const units = [unit({ id: "halpa", cost: 150 }), unit({ id: "kallis", cost: 48_000 })];

  it("picks the most expensive one the sum is enough for", () => {
    expect(bestUnitFor(100_000, units)?.id).toBe("kallis");
  });

  it("picks the cheapest one when nothing is enough", () => {
    expect(bestUnitFor(12, units)?.id).toBe("halpa");
  });
});

describe("comboPath", () => {
  it("builds the same slug scheme as server.mjs's combo()", () => {
    const c = calculate(item({ id: "pma" }), unit({ id: "hoit", cost: 1000 }));
    expect(comboPath(c, "fi")).toBe("/p/pma-hoit/");
  });

  it("adds the edited price to the slug, just like the server does", () => {
    const c = calculate(item({ id: "pma" }), unit({ id: "hoit", cost: 1000 }), 2500);
    expect(comboPath(c, "fi")).toBe("/p/pma-hoit-2500/");
  });

  it("uses the /en/ prefix in English", () => {
    const c = calculate(item({ id: "pma" }), unit({ id: "hoit", cost: 1000 }));
    expect(comboPath(c, "en")).toBe("/en/p/pma-hoit/");
  });

  it("returns null for the reader's own sum — it has no page", () => {
    const c = calculate(item({ id: OWN_ID, amount: 500 }), unit({ cost: 100 }));
    expect(comboPath(c, "fi")).toBeNull();
  });

  it("returns null when the sum is smaller than the unit", () => {
    const c = calculate(item({ amount: 12 }), unit({ cost: 150 }));
    expect(c.count).toBe(0);
    expect(comboPath(c, "fi")).toBeNull();
  });
});

describe("rivals", () => {
  it("returns only projects sharing the same decision tag", () => {
    const data = { items: [
      item({ id: "a", paatos: "rata" }),
      item({ id: "b", paatos: "rata", amount: 5 }),
      item({ id: "c", paatos: "muu" }),
      item({ id: "d" })
    ] } as Dataset;
    const a = data.items[0]!;
    expect(rivals(data, a).map(i => i.id)).toEqual(["b"]);
  });

  it("returns empty when the item doesn't belong to a decision", () => {
    const data = { items: [item({ id: "a" })] } as Dataset;
    expect(rivals(data, data.items[0]!)).toEqual([]);
  });
});
