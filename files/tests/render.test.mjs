import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { fmt, eur, esc, combo, verokuitti } from "../render.mjs";

describe("fmt", () => {
  it("groups thousands with the fi-FI separator", () => {
    expect(fmt(1234567)).toBe(new Intl.NumberFormat("fi-FI").format(1234567));
  });
  it("passes small numbers through unchanged", () => {
    expect(fmt(42)).toBe("42");
  });
});

describe("eur", () => {
  it("formats amounts under a billion in millions", () => {
    expect(eur(500_000_000)).toBe("500 M€");
  });
  it("formats amounts of a billion or more in mrd €", () => {
    expect(eur(2_500_000_000)).toBe("2,5 mrd €");
  });
  it("treats exactly one billion as the mrd boundary", () => {
    expect(eur(1_000_000_000)).toBe("1 mrd €");
  });
});

describe("esc", () => {
  it("escapes all HTML-significant characters", () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;"
    );
  });
  it("leaves plain text untouched", () => {
    expect(esc("hävittäjät")).toBe("hävittäjät");
  });
});

describe("combo", () => {
  const data = {
    vakiluku: 5_600_000,
    items: [
      { id: "big", scope: "valtio", label: "iso meno", amount: 3_400_000_000 },
      { id: "tiny", scope: "helsinki", label: "pieni meno", amount: 100, vakiluku: 650_000 },
      { id: "registry-only", scope: "valtio", label: "vain rekisteri",
        amount: 1_000_000, vainRekisteri: true }
    ],
    units: [
      { id: "ruoka", label: "ruokaostosta", cost: 150 },
      { id: "kallis", label: "kalliimpaa", cost: 10_000 }
    ]
  };

  it("computes the count and a slug without a cost suffix at the default price", () => {
    const c = combo(data, "big", "ruoka");
    expect(c.count).toBe(Math.floor(3_400_000_000 / 150));
    expect(c.slug).toBe("big-ruoka");
    expect(c.edited).toBe(false);
  });

  it("uses the reader-supplied cost and flags it as edited", () => {
    const c = combo(data, "big", "ruoka", 200);
    expect(c.cost).toBe(200);
    expect(c.edited).toBe(true);
    expect(c.count).toBe(Math.floor(3_400_000_000 / 200));
    expect(c.slug).toBe("big-ruoka-200");
  });

  it("ignores a non-positive reader-supplied cost and falls back to the unit price", () => {
    const c = combo(data, "big", "ruoka", -5);
    expect(c.cost).toBe(150);
    expect(c.edited).toBe(false);
  });

  it("returns null for an unknown item or unit id", () => {
    expect(combo(data, "nope", "ruoka")).toBeNull();
    expect(combo(data, "big", "nope")).toBeNull();
  });

  it("returns null for items that only exist for the registry comparison", () => {
    expect(combo(data, "registry-only", "ruoka")).toBeNull();
  });

  it("returns null once the count would drop below one", () => {
    expect(combo(data, "tiny", "kallis")).toBeNull();
  });

  it("falls back to the item's own vakiluku for the per-person share", () => {
    const c = combo(data, "tiny", "ruoka", 1);
    expect(c.per).toBe((100 / 650_000).toLocaleString("fi-FI", { maximumFractionDigits: 0 }) + " €");
  });
});

describe("combo against the live dataset", () => {
  const data = JSON.parse(fs.readFileSync(new URL("../data.json", import.meta.url), "utf8"));

  it("produces a finite, sane count for every item/unit pair", () => {
    const bad = [];
    for (const item of data.items) {
      for (const unit of data.units) {
        const c = combo(data, item.id, unit.id);
        if (c && (!Number.isFinite(c.count) || c.count > 1e10)) bad.push(c.slug);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("verokuitti", () => {
  const data = {
    paaluokat: [
      { label: "a", amount: 60 },
      { label: "b", amount: 40 }
    ]
  };

  it("returns null for a non-positive income", () => {
    expect(verokuitti(data, 0)).toBeNull();
    expect(verokuitti(data, -100)).toBeNull();
  });

  it("applies the correct 2026 bracket and splits by top-level category share", () => {
    const r = verokuitti(data, 40_000, 7.5);
    expect(r.valtionvero).toBe(7207);
    expect(r.kunnallisvero).toBe(3000);
    expect(r.maksut).toBe(3856);
    expect(r.yhteensa).toBe(14063);
    expect(r.aste).toBeCloseTo(35.158125, 6);
    expect(r.rivit).toHaveLength(2);
    expect(r.rivit[0].label).toBe("a");
    expect(r.rivit[0].euroa).toBeCloseTo(7207.25 * 0.6, 6);
  });
});
