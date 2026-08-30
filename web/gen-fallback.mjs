/**
 * gen-fallback.mjs — kirjoittaa data.jsonin TypeScript-varaluvuiksi.
 *
 * Sivu toimii ilman rajapintaa, mikä vaatii kopion datasta. Kopio
 * generoidaan, ei ylläpidetä käsin — käsin ylläpidetty kopio erkaantuisi.
 *
 *   node gen-fallback.mjs ../data.json
 */
import fs from "node:fs/promises";

const src = process.argv[2] ?? "../data.json";
const data = JSON.parse(await fs.readFile(src, "utf8"));

const out = `// GENEROITU TIEDOSTO — älä muokkaa käsin.
// Luotu: node gen-fallback.mjs ${src}
import type { Dataset } from "../types";

export const FALLBACK: Dataset = ${JSON.stringify(data, null, 2)} as unknown as Dataset;
`;

await fs.writeFile("src/data/fallback.ts", out);
console.log(`Varaluvut: ${data.items.length} menoerää, ${data.units.length} yksikköä`);
