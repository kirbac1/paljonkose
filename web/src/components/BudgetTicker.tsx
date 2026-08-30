import { useEffect, useRef, useState } from "react";
import type { Lang } from "../types";
import { num } from "../lib/format";
import { UI } from "../i18n";

interface Props { annualBudget: number; lang: Lang }

/**
 * Kulutusvauhti. Kertoo mitä on kulunut sen jälkeen kun sivu avattiin —
 * ei absoluuttista lukua, joka olisi mielivaltainen.
 *
 * Kunnioittaa prefers-reduced-motion: liikkuva luku on animaatio.
 */
export function BudgetTicker({ annualBudget, lang }: Props) {
  const [spent, setSpent] = useState(0);
  const start = useRef(Date.now());

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const perSecond = annualBudget / (365.25 * 24 * 3600);
    const tick = () => setSpent((Date.now() - start.current) / 1000 * perSecond);

    tick();
    if (reduced) return;
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [annualBudget]);

  return (
    <div className="card extra">
      <p className="xlabel">{UI[lang].ticker}</p>
      <p className="tick" aria-live="off">{num(Math.round(spent), lang)} €</p>
      <p className="xhint">{UI[lang].tickerNote}</p>
    </div>
  );
}
