import type { Item, Lang, Scope, Unit } from "./types";

/**
 * UI copy. Functions wherever the text contains a number — concatenating
 * strings works in one language and breaks in the other, because the
 * word order differs.
 */
export const UI = {
  fi: {
    title: "Paljonko se on?",
    tagline: "Miljardi euroa ei tarkoita kenellekään mitään. Vaihda mittari niin se tarkoittaa.",
    daily: "uusi joka päivä",
    otherLang: "In English",
    all: "Kaikki",
    is: "on",
    ofOne: "yhdestä:",
    yourShare: "Sinun osuutesi:",
    per: (who: string) => `${who} kohden`,
    unitPrice: "Hinta-arvio:",
    changeIt: "— muuta jos tiedät paremmin",
    showCalc: "Näytä laskutoimitus",
    copy: "Kopioi ja jaa",
    copied: "Kopioitu ✓",
    copyFailed: "Kopiointi ei onnistunut",
    ownSum: "Oma summa",
    ownSumHint: "Uutisessa vilahti luku? Syötä se tähän.",
    ownSumBtn: "Paljonko se on?",
    ownSumLabel: "Oma summa",
    ownSumNote: "lukijan syöttämä luku",
    ticker: "Valtion budjetti kuluu juuri nyt",
    tickerNote: "Tasainen jako. Todellisuudessa meno ei jakaudu tasaisesti pitkin vuotta.",
    leftOver: (n: string) => `jää yli ${n}`,
    residents: (scope: string) => `asukasta (${scope})`,
    wholeCountry: "koko maa",
    numerator: "Osoittaja.",
    denominator: "Nimittäjä.",
    caveat: "Mitä tämä ei kerro.",
    edited: (orig: string, used: string) =>
      `Yksikköhintaa on muutettu. Alkuperäinen arvio oli ${orig}, tässä on käytetty ${used}.`,
    rivalTitle: "Tässä vertailu on aito.",
    rivalBody: "Samasta rahasta kilpailevat myös:",
    forecastTitle: "Tämä on arvio, ei toteutunut hinta.",
    forecast: (n: number, ratio: string, price: string, count: string, unit: string) =>
      `${n} vertailukelpoista suurhanketta maksoi mediaanissa ${ratio}× arvionsa. ` +
      `Jos sama toistuu, hinta olisi ${price} — eli ${count} ${unit}.`,
    loading: "Haetaan lukuja…",
    loadFailed: "Luvut eivät latautuneet. Näytetään sivulle tallennetut arvot."
  },
  en: {
    title: "What would that buy?",
    tagline: "A billion euros means nothing to anyone. Change the measure and it does.",
    daily: "new every day",
    otherLang: "Suomeksi",
    all: "All",
    is: "is",
    ofOne: "of one:",
    yourShare: "Your share:",
    per: (who: string) => `per ${who}`,
    unitPrice: "Price estimate:",
    changeIt: "— change it if you know better",
    showCalc: "Show the calculation",
    copy: "Copy and share",
    copied: "Copied ✓",
    copyFailed: "Copying failed",
    ownSum: "Your own figure",
    ownSumHint: "Spotted a number in the news? Put it in here.",
    ownSumBtn: "What would that buy?",
    ownSumLabel: "Your own figure",
    ownSumNote: "figure entered by the reader",
    ticker: "The state budget is being spent right now",
    tickerNote: "Divided evenly. In reality spending is not spread evenly across the year.",
    leftOver: (n: string) => `${n} left over`,
    residents: (scope: string) => `residents (${scope})`,
    wholeCountry: "whole country",
    numerator: "Numerator.",
    denominator: "Denominator.",
    caveat: "What this does not tell you.",
    edited: (orig: string, used: string) =>
      `The unit price has been changed. The original estimate was ${orig}; ${used} was used here.`,
    rivalTitle: "Here the comparison is a real one.",
    rivalBody: "The same funding is also being sought by:",
    forecastTitle: "This is an estimate, not a final cost.",
    forecast: (n: number, ratio: string, price: string, count: string, unit: string) =>
      `${n} comparable megaprojects cost a median of ${ratio}× their estimate. ` +
      `If that repeats, the cost would be ${price} — that is ${count} ${unit}.`,
    loading: "Loading figures…",
    loadFailed: "Figures failed to load. Showing the values stored in the page."
  }
};   // no "as const": the text goes into state, so a wide string is the correct type

export type Strings = typeof UI[Lang];

/** The label for the current language. A missing translation falls
 *  back to Finnish: a visible Finnish word is better than a blank spot. */
export const label = (o: Item | Unit | Scope, lang: Lang): string =>
  lang === "en" && o.label_en ? o.label_en : o.label;

export const note = (o: Item | Unit, lang: Lang): string =>
  (lang === "en" ? o.note_en : o.note) ?? "";

const DEMONYM: Record<Lang, Record<string, string>> = {
  fi: { valtio: "jokaista suomalaista", helsinki: "jokaista helsinkiläistä",
        tampere: "jokaista tamperelaista", turku: "jokaista turkulaista",
        oulu: "jokaista oululaista", uusimaa: "jokaista uusimaalaista",
        tuleva: "jokaista suomalaista" },
  en: { valtio: "person in Finland", helsinki: "Helsinki resident",
        tampere: "Tampere resident", turku: "Turku resident",
        oulu: "Oulu resident", uusimaa: "Uusimaa resident",
        tuleva: "person in Finland" }
};

export const demonym = (scope: string, lang: Lang): string =>
  DEMONYM[lang][scope] ?? (lang === "en" ? "resident" : "jokaista asukasta");
