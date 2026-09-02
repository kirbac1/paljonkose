/**
 * types.ts — the app's data model.
 *
 * The types are derived from data.json, which fetch-data.mjs produces.
 * They're the only place the data's shape is written down — the server
 * doesn't provide a schema, so this file is the contract between the
 * server and the UI.
 */

export type Lang = "fi" | "en";

/** The scope a spending item belongs to. Determines the per-capita divisor. */
export type ScopeId =
  | "valtio" | "helsinki" | "tampere" | "turku" | "oulu" | "uusimaa"
  | "tuleva" | "nosto";

/** Where a figure comes from. Shown to the reader as a badge. */
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

/** A news source for a news item ("nosto"). Required — a news item without a source doesn't make it into the data. */
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
  /** The original cost estimate, if the project is finished and an estimate is known. */
  arvio?: number | null;
  /** Planned — the price is an estimate, not the actual cost. */
  tuleva?: boolean;
  /** Competes for the same funding as other projects sharing this tag. */
  paatos?: string | null;
  /** A comparison point in the overrun register, not public money — no page of its own. */
  vainRekisteri?: boolean;
  /** A single reported news item. */
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
  /** Canonical site URL, supplied by the server so share links never point
   *  at whichever alternate hostname the reader happened to arrive on. */
  site?: string;
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
 * One calculation. Kept separate from Item and Unit, because the reader
 * can change the unit price — at that point `cost` differs from
 * `unit.cost`, and the page has to say so.
 */
export interface Calculation {
  item: Item;
  unit: Unit;
  /** The unit price actually used. Same as unit.cost, unless the reader has edited it. */
  cost: number;
  edited: boolean;
  /** How many units the sum would buy. Zero if the sum is smaller than the unit. */
  count: number;
  /** The fraction of one unit, when count is 0. Otherwise null. */
  fraction: number | null;
  remainder: number;
  perCapita: number;
}
