import { useState } from "react";
import type { Lang } from "../types";
import { UI } from "../i18n";

interface Props { lang: Lang; onSubmit: (amount: number) => void }

/**
 * The reader's own sum. Calculates in place and doesn't navigate
 * anywhere — a number picked up from a news article is the whole point
 * of this feature, and that would break if the page changed underneath it.
 */
export function OwnSum({ lang, onSubmit }: Props) {
  const t = UI[lang];
  const [raw, setRaw] = useState("");

  const submit = () => {
    const n = Number.parseInt(raw.replace(/[^\d]/g, ""), 10);
    if (Number.isFinite(n) && n > 0) onSubmit(n);
  };

  return (
    <div className="card extra">
      <p className="xlabel">{t.ownSum}</p>
      <p className="xhint">{t.ownSumHint}</p>
      <div className="xrow">
        <input
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
          inputMode="numeric"
          placeholder="340000000"
          aria-label={lang === "en" ? "Amount in euros" : "Summa euroina"}
        />
        <button type="button" onClick={submit}>{t.ownSumBtn}</button>
      </div>
    </div>
  );
}
