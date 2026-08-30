/**
 * gen-fallback.mjs — writes data.json out as TypeScript fallback data.
 *
 * The page works without the API, which requires a copy of the data.
 * The copy is generated, not hand-maintained — a hand-maintained copy
 * would drift.
 *
 *   node gen-fallback.mjs ../files/data.json
 */
import fs from "node:fs/promises";

const src = process.argv[2] ?? "../files/data.json";
const data = JSON.parse(await fs.readFile(src, "utf8"));

const out = `// GENERATED FILE — do not edit by hand.
// Created by: node gen-fallback.mjs ${src}
import type { Dataset } from "../types";

export const FALLBACK: Dataset = ${JSON.stringify(data, null, 2)} as unknown as Dataset;
`;

await fs.writeFile("src/data/fallback.ts", out);
console.log(`Fallback data: ${data.items.length} items, ${data.units.length} units`);
