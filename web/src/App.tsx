import { useCallback, useMemo, useState } from "react";
import type { Item } from "./types";
import { UI, label } from "./i18n";
import { useData } from "./hooks/useData";
import { useLang } from "./hooks/useLang";
import { OWN_ID, bestUnitFor, calculate, comboPath, comparableItems } from "./lib/calc";
import { eur } from "./lib/format";
import { Calculator } from "./components/Calculator";
import { ScopeChips } from "./components/ScopeChips";
import { OwnSum } from "./components/OwnSum";
import { BudgetTicker } from "./components/BudgetTicker";
import { SiteLinks } from "./components/SiteLinks";

export default function App() {
  const [lang, toggleLang] = useLang();
  const { status, data } = useData();
  const t = UI[lang];

  const [scope, setScope] = useState("kaikki");
  const [itemId, setItemId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  /** null = käytä yksikön omaa hintaa. Luku = lukija on muuttanut sitä. */
  const [cost, setCost] = useState<number | null>(null);
  const [own, setOwn] = useState<Item | null>(null);
  const [shareLabel, setShareLabel] = useState<string>(t.copy);

  const all = useMemo(() => comparableItems(data), [data]);
  const visible = useMemo(
    () => (scope === "kaikki" ? all : all.filter(i => i.scope === scope)),
    [all, scope]
  );

  /* Tyhjä data on aito mahdollisuus: rajapinta voi palauttaa listan ilman
     eriä. Käsitellään se nimenomaisesti eikä "!"-operaattorilla — muuten
     vika ilmenee vasta ajossa, väärässä paikassa. */
  const item = (own && itemId === OWN_ID ? own : all.find(i => i.id === itemId))
    ?? visible[0] ?? all[0] ?? null;
  const unit = data.units.find(u => u.id === unitId) ?? data.units[0] ?? null;

  const calc = useMemo(
    () => (item && unit ? calculate(item, unit, cost ?? undefined) : null),
    [item, unit, cost]
  );

  const pickItem = useCallback((id: string) => {
    setItemId(id);
    setCost(null);        // muokattu hinta ei saa siirtyä toiseen erään
  }, []);

  const pickScope = useCallback((s: string) => {
    setScope(s);
    const first = (s === "kaikki" ? all : all.filter(i => i.scope === s))[0];
    if (first) { setItemId(first.id); setCost(null); }
  }, [all]);

  /**
   * Lukijan oma summa. Pieni luku ei mahdu kalliiseen yksikköön, joten
   * valitaan halvin, joka antaa vähintään yhden — muuten näkyy nolla.
   */
  const submitOwn = useCallback((amount: number) => {
    const synthetic: Item = {
      id: OWN_ID, scope: "valtio", vakiluku: data.vakiluku,
      label: UI.fi.ownSumLabel, label_en: UI.en.ownSumLabel,
      amount, note: UI.fi.ownSumNote, note_en: UI.en.ownSumNote,
      status: "kasin"
    };
    setOwn(synthetic);
    setItemId(OWN_ID);
    setCost(null);
    const best = bestUnitFor(amount, data.units);
    if (best) setUnitId(best.id);
  }, [data]);

  const share = useCallback(async () => {
    if (!calc) return;
    // Jokaisella oikealla laskutoimituksella on oma, palvelimen renderöimä
    // sivu (samat luvut, oikea og:image) — jaetaan se, ei etusivun
    // yleistä osoitetta, joka ei kertoisi mitä lukija juuri katsoi.
    const path = comboPath(calc, lang);
    const url = path ? `${window.location.origin}${path}` : window.location.href;
    const text = `${eur(calc.item.amount, lang)} = ${calc.count} ${
      label(calc.unit, lang)} — ${url}`;
    try {
      await navigator.clipboard.writeText(text);
      setShareLabel(t.copied);
    } catch {
      setShareLabel(t.copyFailed);
    }
    window.setTimeout(() => setShareLabel(t.copy), 2000);
  }, [calc, lang, t]);

  const budget = all.find(i => i.id === "koko")?.amount ?? 91_300_000_000;

  if (!calc) {
    return (
      <div className="wrap">
        <h1>{t.title}</h1>
        <p className="sub" role="status">{t.loading}</p>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="top">
        <div className="topleft">
          <span className="tag">{t.daily}</span>
        </div>
        <button type="button" className="langsw" onClick={toggleLang}>
          {t.otherLang}
        </button>
      </div>

      <h1>{t.title}</h1>
      <p className="sub">{t.tagline}</p>

      {status === "stale" && <p className="warn" role="status">{t.loadFailed}</p>}

      <ScopeChips data={data} lang={lang} value={scope} onChange={pickScope} />

      <Calculator
        data={data} lang={lang} items={visible} calc={calc}
        onItem={pickItem}
        onUnit={id => setUnitId(id)}
        onCost={setCost}
        onShare={share}
        shareLabel={shareLabel}
      />

      <OwnSum lang={lang} onSubmit={submitOwn} />
      <BudgetTicker annualBudget={budget} lang={lang} />
      <SiteLinks lang={lang} />
    </div>
  );
}
