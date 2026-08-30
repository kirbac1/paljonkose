/**
 * sync-fallbacks.mjs — kirjoittaa data.jsonin etusivun varaluvuiksi.
 *
 * Etusivu toimii myös jos data.json ei lataudu. Se vaatii kopion datasta
 * HTML:n sisällä, ja kopio ei päivity itsestään — siksi tämä skripti.
 *
 *   node sync-fallbacks.mjs
 *
 * Aja aina kun olet ajanut npm run data.
 */
import fs from "node:fs/promises";

const d = JSON.parse(await fs.readFile(new URL("./data.json", import.meta.url), "utf8"));
const q = s => JSON.stringify(s ?? "");

const items = "const ITEMS_FALLBACK = [\n" + d.items.map(i =>
  `  { id:${q(i.id)}, scope:${q(i.scope)}, vakiluku:${i.vakiluku}, label:${q(i.label)},` +
  ` label_en:${q(i.label_en)}, amount:${i.amount}, note:${q(i.note)}, note_en:${q(i.note_en)}` +
  (i.tuleva ? ", tuleva:true" : "") + (i.arki ? ", arki:true" : "") + " }"
).join(",\n") + "\n];";

const units = "const UNITS_FALLBACK = [\n" + d.units.map(u =>
  `  { id:${q(u.id)}, label:${q(u.label)}, label_en:${q(u.label_en)}, cost:${u.cost},` +
  ` note:${q(u.note)}, note_en:${q(u.note_en)}` + (u.arki ? ", arki:true" : "") + " }"
).join(",\n") + "\n];";

const scopes = "const SCOPES_FALLBACK = {\n" + Object.entries(d.scopes).map(([k, v]) =>
  `  ${k}: { id:${q(v.id)}, label:${q(v.label)}, label_en:${q(v.label_en)}, vakiluku:${v.vakiluku} }`
).join(",\n") + "\n};";

const files = ["public/index.html", "paljonko-se-on.html"];
for (const f of files) {
  const p = new URL("./" + f, import.meta.url);
  let s = await fs.readFile(p, "utf8");
  s = s.replace(/const ITEMS_FALLBACK = \[[\s\S]*?\n\];/, items)
       .replace(/const UNITS_FALLBACK = \[[\s\S]*?\n\];/, units)
       .replace(/const SCOPES_FALLBACK = \{[\s\S]*?\n\};/, scopes);
  await fs.writeFile(p, s);
}
console.log(`Synkattu ${d.items.length} menoerää ja ${d.units.length} yksikköä → ${files.join(", ")}`);
