import { useEffect, useState } from "react";
import type { Lang } from "../types";
import { UI } from "../i18n";

interface Props {
  /** The price in effect — the unit's own, or edited by the reader. */
  value: number;
  lang: Lang;
  onChange: (cost: number | null) => void;
}

/**
 * The unit-price field.
 *
 * The field keeps its own string instead of displaying the number
 * directly. Without that, the field couldn't be cleared: an empty value
 * would be read as zero, the price would revert to the unit's own, and
 * the number would reappear mid-keystroke. The reader would have to
 * select the whole field every time.
 */
export function PriceInput({ value, lang, onChange }: Props) {
  const [draft, setDraft] = useState(String(Math.round(value)));

  // An external change (item switched, price reset) overrides the draft.
  useEffect(() => { setDraft(String(Math.round(value))); }, [value]);

  return (
    <label className="cost">
      {UI[lang].unitPrice}{" "}
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        aria-label={lang === "en" ? "Unit price in euros" : "Yksikköhinta euroina"}
        onChange={e => {
          const next = e.target.value.replace(/[^\d]/g, "");
          setDraft(next);
          const n = Number.parseInt(next, 10);
          onChange(Number.isFinite(n) && n > 0 ? n : null);
        }}
        onBlur={() => { if (draft === "") setDraft(String(Math.round(value))); }}
      />{" "}
      <span className="hint">{UI[lang].changeIt}</span>
    </label>
  );
}
