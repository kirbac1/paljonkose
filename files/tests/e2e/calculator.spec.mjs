import { test, expect } from "@playwright/test";

/**
 * Selaimessa ajettava versio entisestä test-dom.mjs:stä — sama etusivun
 * käyttöpolku, mutta oikeassa selaimessa palvelimen takana.
 */

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#count")).not.toHaveText("—", { timeout: 5000 });
  page.errors = errors;
});

test("own amount: a large sum divides into a sane count", async ({ page }) => {
  await page.locator("#omaSumma").fill("340000000");
  await page.locator("#omaBtn").click();
  await expect(page.locator("#count")).toHaveText("7 083");
});

test("own amount: a sum under the unit price is shown as a fraction", async ({ page }) => {
  await page.locator("#omaSumma").fill("12");
  await page.locator("#omaBtn").click();
  const count = await page.locator("#count").textContent();
  expect(count).not.toBe("0");
  expect(count).toMatch(/0,0|0\.0/);
});

test("every spending item resolves to a finite, sane count", async ({ page }) => {
  const options = await page.locator("#itemSel option").all();
  const bad = [];
  for (const option of options) {
    const label = await option.textContent();
    if (/oma summa|your own figure/i.test(label)) continue;
    const value = await option.getAttribute("value");
    await page.locator("#itemSel").selectOption(value);
    const text = await page.locator("#count").textContent();
    const n = Number(text.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(n) || n > 1e10) bad.push(`${label} -> ${text}`);
  }
  expect(bad).toEqual([]);
});

test("region chips switch the active spending item", async ({ page }) => {
  const chips = page.locator(".scope");
  await expect(chips).not.toHaveCount(0);
  const tampere = page.locator('.scope[data-scope="tampere"]');
  if (await tampere.count()) {
    await tampere.click();
    await expect(page.locator("#count")).not.toHaveText("—");
  }
});

test("editing the unit price updates the calculation", async ({ page }) => {
  await page.locator("#unitCost").fill("99999");
  await page.locator("#unitCost").dispatchEvent("change");
  await expect(page.locator("#count")).not.toHaveText("—");
});

test("the ticking clock advances", async ({ page }) => {
  const first = await page.locator("#tick").textContent();
  expect(first).not.toBe("—");
  await page.waitForTimeout(1200);
  await expect(page.locator("#tick")).not.toHaveText(first);
});

test("the share button does not raise a console error", async ({ page }) => {
  await page.locator("#copyBtn").click();
  await page.waitForTimeout(200);
  expect(page.errors).toEqual([]);
});
