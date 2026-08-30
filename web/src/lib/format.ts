import type { Lang } from "../types";

const LOCALE: Record<Lang, string> = { fi: "fi-FI", en: "en-GB" };

export const locale = (lang: Lang) => LOCALE[lang];

export const num = (n: number, lang: Lang) =>
  new Intl.NumberFormat(LOCALE[lang]).format(n);

/** Large sums, abbreviated. "Billion" is a different word in each language. */
export function eur(amount: number, lang: Lang): string {
  const l = LOCALE[lang];
  if (amount >= 1e9) {
    return `${(amount / 1e9).toLocaleString(l, { maximumFractionDigits: 1 })} ${
      lang === "en" ? "bn €" : "mrd €"}`;
  }
  if (amount >= 1e6) {
    return `${(amount / 1e6).toLocaleString(l, { maximumFractionDigits: 0 })} M€`;
  }
  return `${new Intl.NumberFormat(l).format(Math.round(amount))} €`;
}

/** A small fraction with significant digits — "0.00" doesn't say anything. */
export function fraction(value: number, lang: Lang): string {
  const l = LOCALE[lang];
  return value < 0.01
    ? Number(value.toPrecision(2)).toLocaleString(l, { maximumFractionDigits: 20 })
    : value.toLocaleString(l, { maximumFractionDigits: 2 });
}
