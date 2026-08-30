/**
 * types.ts — sovelluksen tietomalli.
 *
 * Tyypit on johdettu data.jsonista, jonka fetch-data.mjs tuottaa. Ne ovat
 * ainoa paikka, jossa datan muoto on kirjattu — palvelin ei tarjoa skeemaa,
 * joten tämä tiedosto on sopimus palvelimen ja käyttöliittymän välillä.
 */

export type Lang = "fi" | "en";

/** Alue, johon menoerä kuuluu. Ratkaisee per capita -jakajan. */
export type ScopeId =
  | "valtio" | "helsinki" | "tampere" | "turku" | "oulu" | "uusimaa"
  | "tuleva" | "nosto";

/** Mistä luku on peräisin. Näytetään lukijalle merkkinä. */
export type Status = "rajapinta" | "kasin" | "arvio" | "muokattu";

export interface Scope {
  id: ScopeId;
  label: string;
  label_en: string;
  vakiluku: number;
}

export interface Source {
  name: string;
  kind?: string;
  retrieved?: string;
  docs?: string;
}

/** Uutislähde nostoille. Pakollinen — nosto ilman lähdettä ei päädy dataan. */
export interface NewsSource {
  url: string;
  julkaisija: string;
  pvm?: string;
}

export interface Item {
  id: string;
  scope: ScopeId;
  label: string;
  label_en: string;
  amount: number;
  note: string;
  note_en: string;
  vakiluku: number;
  status: Status;
  source?: Source;
  /** Alkuperäinen kustannusarvio, jos hanke on valmis ja arvio tiedossa. */
  arvio?: number | null;
  /** Suunnitteilla — hinta on arvio, ei toteutunut. */
  tuleva?: boolean;
  /** Kilpailee samasta määrärahasta muiden saman tunnuksen hankkeiden kanssa. */
  paatos?: string | null;
  /** Vertailukohta ylitysrekisterissä, ei julkista rahaa — ei omaa laskusivua. */
  vainRekisteri?: boolean;
  /** Yksittäinen uutisoitu meno. */
  nosto?: boolean;
  konteksti?: string | null;
  lahde?: NewsSource | null;
  vastine?: string | null;
}

export interface Unit {
  id: string;
  label: string;
  label_en: string;
  cost: number;
  note?: string;
  note_en?: string;
  status: Status;
  source?: Source;
}

export interface Dataset {
  generated: string;
  vakiluku: number;
  scopes: Record<string, Scope>;
  items: Item[];
  units: Unit[];
  ylityshistoria: {
    mediaani: number;
    otos: number;
    hankkeet: { label: string; suhde: number }[];
  } | null;
}

/**
 * Yksi laskutoimitus. Erotettu Itemistä ja Unitista, koska lukija voi
 * muuttaa yksikköhintaa — silloin `cost` poikkeaa `unit.cost`:sta ja
 * sivun on kerrottava siitä.
 */
export interface Calculation {
  item: Item;
  unit: Unit;
  /** Käytetty yksikköhinta. Sama kuin unit.cost, ellei lukija ole muuttanut. */
  cost: number;
  edited: boolean;
  /** Montako yksikköä summalla saisi. Nolla, jos summa on yksikköä pienempi. */
  count: number;
  /** Osuus yhdestä yksiköstä, kun count on 0. Muuten null. */
  fraction: number | null;
  remainder: number;
  perCapita: number;
}
