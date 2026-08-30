import type { Calculation, Dataset, Item, Lang, Unit } from "../types";
import { label, UI } from "../i18n";
import { eur, fraction, num } from "../lib/format";
import { CalculationDetail } from "./Calculation";
import { PriceInput } from "./PriceInput";

interface Props {
  data: Dataset;
  lang: Lang;
  items: Item[];
  calc: Calculation;
  onItem: (id: string) => void;
  onUnit: (id: string) => void;
  onCost: (cost: number | null) => void;
  onShare: () => void;
  shareLabel: string;
}

const ORDER = ["valtio", "helsinki", "tampere", "turku", "oulu", "uusimaa", "tuleva"];

export function Calculator(p: Props) {
  const t = UI[p.lang];
  const { calc } = p;
  /* Only group scopes that have both items and a label — an unknown
     scope in the data must not crash the dropdown. */
  const groups = ORDER
    .map(scope => ({
      scope,
      title: p.data.scopes[scope],
      items: p.items.filter(i => i.scope === scope)
    }))
    .filter((g): g is typeof g & { title: NonNullable<typeof g.title> } =>
      g.items.length > 0 && g.title != null);

  return (
    <div className="card">
      <div className="pills">
        <span className="pill">
          <select
            value={calc.item.id}
            onChange={e => p.onItem(e.target.value)}
            aria-label={p.lang === "en" ? "Choose an expenditure" : "Valitse menoerä"}
          >
            {groups.map(g => (
              <optgroup key={g.scope} label={label(g.title, p.lang)}>
                {g.items.map(i => (
                  <option key={i.id} value={i.id}>{label(i, p.lang)}</option>
                ))}
              </optgroup>
            ))}
            {!p.items.some(i => i.id === calc.item.id) && (
              <option value={calc.item.id}>{label(calc.item, p.lang)}</option>
            )}
          </select>
        </span>
        <span className="pill">
          <select
            value={calc.unit.id}
            onChange={e => p.onUnit(e.target.value)}
            aria-label={p.lang === "en" ? "Choose a measure" : "Valitse mittari"}
          >
            {p.data.units.map((u: Unit) => (
              <option key={u.id} value={u.id}>{label(u, p.lang)}</option>
            ))}
          </select>
        </span>
      </div>

      <p className="amount">{eur(calc.item.amount, p.lang)} {t.is}</p>

      {calc.fraction != null ? (
        <>
          <p className="count" data-testid="count">{fraction(calc.fraction, p.lang)}</p>
          <p className="what">{t.ofOne} {label(calc.unit, p.lang)}</p>
        </>
      ) : (
        <>
          <p className="count" data-testid="count">{num(calc.count, p.lang)}</p>
          <p className="what">{label(calc.unit, p.lang)}</p>
        </>
      )}

      <p className="share-line">
        {t.yourShare} {eur(calc.perCapita, p.lang)}
      </p>

      <PriceInput value={calc.cost} lang={p.lang} onChange={p.onCost} />

      <CalculationDetail calc={calc} data={p.data} lang={p.lang} />

      <button className="go" type="button" onClick={p.onShare}>{p.shareLabel}</button>
    </div>
  );
}
