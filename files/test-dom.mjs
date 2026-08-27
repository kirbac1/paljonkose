/**
 * test-dom.mjs — ajaa etusivun oikeassa DOM-moottorissa.
 *
 *   npm install --no-save jsdom
 *   node test-dom.mjs
 *
 * `node --check` kertoo vain, että tiedosto jäsentyy. Se ei kerro, että
 * tapahtumankäsittelijä kaatuu ajossa — tämä kertoo.
 */
import fs from "node:fs";
import { JSDOM } from "jsdom";

const dom = new JSDOM(fs.readFileSync("public/index.html", "utf8"), {
  runScripts: "dangerously", url: "https://paljonkose.fi/", pretendToBeVisual: true
});
const w = dom.window, d = w.document;
const errs = [];
w.addEventListener("error", e => errs.push(e.message));
const ev = n => new w.Event(n, { bubbles: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
const $ = id => d.getElementById(id);

await wait(500);
let fails = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${extra ? "  — " + extra : ""}`);
  if (!ok) fails++;
};

// 1. oma summa, iso ja pieni
$("omaSumma").value = "340000000";
$("omaBtn").dispatchEvent(ev("click"));
await wait(120);
check("oma summa 340 M€", $("count").textContent.replace(/\s/g, "") === "7083",
  `${$("count").textContent} ${$("countLabel").textContent}`);

$("omaSumma").value = "12";
$("omaBtn").dispatchEvent(ev("click"));
await wait(120);
check("oma summa 12 € vaihtaa arkiyksikköön",
  /porkkan|maito|leip|bussi/.test($("countLabel").textContent),
  `${$("count").textContent} ${$("countLabel").textContent}`);

// 2. jokainen menoerä tuottaa järkevän luvun oikealla kertaluokalla
const itemSel = $("itemSel");
const opts = [...itemSel.querySelectorAll("option")];
const bad = [];
for (const o of opts) {
  itemSel.value = o.value;
  itemSel.dispatchEvent(ev("change"));
  await wait(4);
  const n = Number($("count").textContent.replace(/\s/g, ""));
  // yläraja on löysä tarkoituksella: 91,3 mrd ÷ 150 € on aidosti 608 miljoonaa
  if (!Number.isFinite(n) || n === 0 || n > 1e10)
    bad.push(`${o.textContent} → ${$("count").textContent} ${$("countLabel").textContent}`);
}
check(`kaikki ${opts.length} menoerää`, bad.length === 0, bad.slice(0, 3).join(" | "));

// 3. aluesirut
const chips = [...d.querySelectorAll(".scope")];
check("aluesirut", chips.length >= 6, chips.map(c => c.textContent).join(" · "));
const tre = chips.find(c => c.dataset.scope === "tampere");
if (tre) { tre.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); await wait(80); }
check("Tampere-siru vaihtaa erän", $("count").textContent !== "—");

// 4. muokattava yksikköhinta
const uc = $("unitCost");
uc.value = "99999"; uc.dispatchEvent(ev("input")); uc.dispatchEvent(ev("change"));
await wait(80);
check("yksikköhinnan muokkaus", $("count").textContent !== "—", $("count").textContent);

// 5. sekuntikello
await wait(250);
check("sekuntikello käy", $("tick").textContent !== "—", $("tick").textContent);

// 6. jakonappi
$("copyBtn").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
await wait(80);

check("ei konsolivirheitä", errs.length === 0, errs.slice(0, 3).join(" | "));
console.log(fails ? `\n${fails} testiä epäonnistui.` : "\nKaikki läpi.");
dom.window.close();
process.exit(fails ? 1 : 0);
