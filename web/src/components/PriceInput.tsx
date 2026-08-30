import { useEffect, useState } from "react";
import type { Lang } from "../types";
import { UI } from "../i18n";

interface Props {
  /** Voimassa oleva hinta — yksikön oma tai lukijan muokkaama. */
  value: number;
  lang: Lang;
  onChange: (cost: number | null) => void;
}

/**
 * Yksikköhinnan kenttä.
 *
 * Kenttä pitää oman merkkijononsa sen sijaan että näyttäisi suoraan lukua.
 * Ilman sitä kenttää ei voi tyhjentää: tyhjä arvo tulkitaan nollaksi, hinta
 * palautuu yksikön omaksi ja luku ilmestyy takaisin keskellä kirjoittamista.
 * Lukija joutuisi maalaamaan koko kentän joka kerta.
 */
export function PriceInput({ value, lang, onChange }: Props) {
  const [draft, setDraft] = useState(String(Math.round(value)));

  // Ulkopuolinen muutos (erä vaihtui, hinta nollattiin) syrjäyttää luonnoksen.
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
