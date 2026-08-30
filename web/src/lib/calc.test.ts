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
  it("jakaa summan yksikköhinnalla", () => {
    const c = calculate(item({ amount: 10_000 }), unit({ cost: 3000 }));
    expect(c.count).toBe(3);
    expect(c.remainder).toBe(1000);
    expect(c.fraction).toBeNull();
  });

  it("kertoo osuuden kun summa jää yksikköä pienemmäksi", () => {
    // "0 hoitajan vuosipalkkaa" on umpikuja — lukijan on saatava jokin luku
    const c = calculate(item({ amount: 12 }), unit({ cost: 150 }));
    expect(c.count).toBe(0);
    expect(c.fraction).toBeCloseTo(0.08);
  });

  it("merkitsee muokatun hinnan", () => {
    expect(calculate(item(), unit({ cost: 1000 }), 2000).edited).toBe(true);
    expect(calculate(item(), unit({ cost: 1000 }), 1000).edited).toBe(false);
  });

  it("sivuuttaa kelvottoman hinnan ja käyttää yksikön omaa", () => {
    expect(calculate(item(), unit({ cost: 1000 }), 0).cost).toBe(1000);
    expect(calculate(item(), unit({ cost: 1000 }), -5).cost).toBe(1000);
  });

  it("laskee per capitan erän oman väkiluvun mukaan, ei koko maan", () => {
    const c = calculate(item({ scope: "tampere", vakiluku: 260_000, amount: 2_600_000 }), unit());
    expect(c.perCapita).toBe(10);
  });
});

describe("comparableItems", () => {
  it("jättää pois nostot ja vertailukohdat", () => {
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

  it("valitsee kalleimman, johon summa riittää", () => {
    expect(bestUnitFor(100_000, units)?.id).toBe("kallis");
  });

  it("valitsee halvimman kun mikään ei riitä", () => {
    expect(bestUnitFor(12, units)?.id).toBe("halpa");
  });
});

describe("comboPath", () => {
  it("rakentaa saman slug-kaavan kuin server.mjs:n combo()", () => {
    const c = calculate(item({ id: "pma" }), unit({ id: "hoit", cost: 1000 }));
    expect(comboPath(c, "fi")).toBe("/p/pma-hoit/");
  });

  it("lisää muokatun hinnan slugiin, kuten palvelinkin tekee", () => {
    const c = calculate(item({ id: "pma" }), unit({ id: "hoit", cost: 1000 }), 2500);
    expect(comboPath(c, "fi")).toBe("/p/pma-hoit-2500/");
  });

  it("käyttää /en/-etuliitettä englanniksi", () => {
    const c = calculate(item({ id: "pma" }), unit({ id: "hoit", cost: 1000 }));
    expect(comboPath(c, "en")).toBe("/en/p/pma-hoit/");
  });

  it("palauttaa null lukijan omalle summalle — sillä ei ole sivua", () => {
    const c = calculate(item({ id: OWN_ID, amount: 500 }), unit({ cost: 100 }));
    expect(comboPath(c, "fi")).toBeNull();
  });

  it("palauttaa null kun summa jää yksikköä pienemmäksi", () => {
    const c = calculate(item({ amount: 12 }), unit({ cost: 150 }));
    expect(c.count).toBe(0);
    expect(comboPath(c, "fi")).toBeNull();
  });
});

describe("rivals", () => {
  it("palauttaa vain saman päätöksen hankkeet", () => {
    const data = { items: [
      item({ id: "a", paatos: "rata" }),
      item({ id: "b", paatos: "rata", amount: 5 }),
      item({ id: "c", paatos: "muu" }),
      item({ id: "d" })
    ] } as Dataset;
    const a = data.items[0]!;
    expect(rivals(data, a).map(i => i.id)).toEqual(["b"]);
  });

  it("palauttaa tyhjän kun erä ei kuulu päätökseen", () => {
    const data = { items: [item({ id: "a" })] } as Dataset;
    expect(rivals(data, data.items[0]!)).toEqual([]);
  });
});
