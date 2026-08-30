import type { Calculation, Dataset, Lang } from "../types";
import { demonym, label, note, UI } from "../i18n";
import { eur, num } from "../lib/format";
import { forecast, rivals } from "../lib/calc";

interface Props { calc: Calculation; data: Dataset; lang: Lang }

/**
 * The calculation spelled out, with its sources and caveats.
 *
 * This is the site's defense: the reader sees where both figures come
 * from and what the division doesn't tell them. Without this, the page
 * is just a claim.
 */
export function CalculationDetail({ calc, data, lang }: Props) {
  const t = UI[lang];
  const { item, unit } = calc;
  const scopeName = item.scope === "valtio" ? t.wholeCountry : item.scope;
  const fc = forecast(data, calc);
  const rv = rivals(data, item);

  return (
    <>
      <details className="calc">
        <summary>{t.showCalc}</summary>
        <div className="sum">
          <span>{num(item.amount, lang)} €</span> <span className="from">{label(item, lang)}</span>
          {"\n"}
          <span className="op">÷</span> <span>{num(calc.cost, lang)} €</span>{" "}
          <span className="from">{label(unit, lang)}</span>
          {"\n────────────────────\n"}
          <span className="res">= {num(calc.count, lang)}</span>{" "}
          <span className="from">{label(unit, lang)}</span>
          {calc.remainder > 0 && calc.count > 0 && (
            <>{"\n"}<span className="from">{t.leftOver(eur(calc.remainder, lang))}</span></>
          )}
          {"\n\n"}
          <span>{num(item.amount, lang)} €</span>
          {"\n"}
          <span className="op">÷</span> <span>{num(item.vakiluku, lang)}</span>{" "}
          <span className="from">{t.residents(scopeName)}</span>
          {"\n────────────────────\n"}
          <span className="res">= {eur(calc.perCapita, lang)}</span>{" "}
          <span className="from">{t.per(demonym(item.scope, lang))}</span>
        </div>
      </details>

      {calc.edited && (
        <p className="warn">{t.edited(eur(unit.cost, lang), eur(calc.cost, lang))}</p>
      )}

      {rv.length > 0 && (
        <p className="rival">
          <strong>{t.rivalTitle}</strong>
          {t.rivalBody}{" "}
          {rv.map((r, i) => (
            <span key={r.id}>
              {i > 0 && ", "}{label(r, lang)} ({eur(r.amount, lang)})
            </span>
          ))}
        </p>
      )}

      {fc && (
        <p className="forecast">
          <strong>{t.forecastTitle}</strong>
          {t.forecast(
            fc.sample,
            fc.ratio.toLocaleString(lang === "en" ? "en-GB" : "fi-FI",
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            eur(fc.amount, lang),
            num(fc.count, lang),
            label(unit, lang)
          )}
        </p>
      )}

      <p className="note">
        <strong>{t.numerator}</strong> {item.source?.name ?? ""}
        {note(item, lang) && ` — ${note(item, lang)}`}
      </p>
      <p className="note">
        <strong>{t.denominator}</strong> {unit.source?.name ?? ""}
        {note(unit, lang) && ` — ${note(unit, lang)}`}
      </p>
      <p className="note">
        <strong>{t.caveat}</strong>{" "}
        {item.scope === "valtio"
          ? lang === "en"
            ? "The division assumes a euro is a euro. In reality money is tied to a budget line and an administrative branch, and these are not paid from the same pot. The figure shows scale, not a workable alternative."
            : "Jakolasku olettaa että euro on euro. Oikeasti raha on sidottu momenttiin ja hallinnonalaan, eikä näitä makseta samasta pussista. Luku kertoo mittasuhteen, ei toteutettavaa vaihtoehtoa."
          : lang === "en"
            ? "This is the city's own money, so the comparison is closer to a real alternative. Even so, investment and operating budgets are separate lines, and health and social services are now paid by the wellbeing services county."
            : "Tämä on kaupungin omaa rahaa, joten vertailu on lähempänä aitoa vaihtoehtoa. Silti: investointi ja käyttötalous ovat eri momentteja, eikä sote-palveluita enää makseta kaupungin kassasta."}
      </p>
    </>
  );
}
