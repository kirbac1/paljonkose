import type { Dataset, Lang, Scope } from "../types";
import { label, UI } from "../i18n";

const ORDER = ["valtio", "helsinki", "tampere", "turku", "oulu", "uusimaa", "tuleva"];

interface Props {
  data: Dataset;
  lang: Lang;
  value: string;
  onChange: (scope: string) => void;
}

export function ScopeChips({ data, lang, value, onChange }: Props) {
  const t = UI[lang];
  const present = ORDER.filter(id =>
    data.items.some(i => i.scope === id && !i.nosto && !i.vainRekisteri));

  const chips: { id: string; text: string }[] = [
    { id: "kaikki", text: t.all },
    ...present.map(id => {
      const scope: Scope | undefined = data.scopes[id];
      return { id, text: scope ? label(scope, lang) : id };
    })
  ];

  return (
    <div className="scopes" role="group" aria-label={lang === "en" ? "Choose an area" : "Valitse alue"}>
      {chips.map(c => (
        <button
          key={c.id}
          type="button"
          className={`scope${c.id === value ? " on" : ""}`}
          aria-pressed={c.id === value}
          onClick={() => onChange(c.id)}
        >
          {c.text}
        </button>
      ))}
    </div>
  );
}
