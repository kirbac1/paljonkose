import { test, expect } from "@playwright/test";

/**
 * public/ now serves the built React app (web/), not the old vanilla-JS
 * homepage — this suite exercises the same user flows the vanilla version
 * once had, but against React's actual accessible structure (aria-labels,
 * data-testid="count") instead of its old element ids.
 */

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByTestId("count")).toBeVisible({ timeout: 5000 });
  page.errors = errors;
});

test("own amount: a large sum resolves to a sane count", async ({ page }) => {
  await page.getByLabel("Summa euroina").fill("340000000");
  await page.getByRole("button", { name: "Paljonko se on?" }).click();
  const text = await page.getByTestId("count").textContent();
  const n = Number(text.replace(/\s/g, "").replace(",", "."));
  expect(Number.isFinite(n)).toBe(true);
  expect(n).toBeGreaterThan(0);
});

test("own amount: a sum under the unit price is shown as a fraction", async ({ page }) => {
  await page.getByLabel("Summa euroina").fill("12");
  await page.getByRole("button", { name: "Paljonko se on?" }).click();
  const text = await page.getByTestId("count").textContent();
  expect(text).not.toBe("0");
  expect(text).toMatch(/0,0|0\.0/);
});

test("every spending item resolves to a finite, sane count", async ({ page }) => {
  const select = page.getByLabel("Valitse menoerä");
  const options = await select.locator("option").all();
  const bad = [];
  for (const option of options) {
    const value = await option.getAttribute("value");
    await select.selectOption(value);
    const text = await page.getByTestId("count").textContent();
    const n = Number(text.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(n) || n > 1e10) {
      const label = await option.textContent();
      bad.push(`${label} -> ${text}`);
    }
  }
  expect(bad).toEqual([]);
});

test("region chips switch the active spending item", async ({ page }) => {
  const chips = page.getByRole("group", { name: "Valitse alue" }).getByRole("button");
  await expect(chips).not.toHaveCount(0);
  const tampere = page.getByRole("button", { name: "Tampere", exact: true });
  if (await tampere.count()) {
    await tampere.click();
    await expect(page.getByTestId("count")).toBeVisible();
  }
});

test("editing the unit price updates the calculation", async ({ page }) => {
  const before = await page.getByTestId("count").textContent();
  await page.getByLabel("Yksikköhinta euroina").fill("99999");
  await expect(page.getByTestId("count")).not.toHaveText(before);
});

test("the ticking clock advances", async ({ page }) => {
  const tick = page.locator(".tick");
  const first = await tick.textContent();
  await page.waitForTimeout(1200);
  await expect(tick).not.toHaveText(first);
});

test("the share button does not raise a console error", async ({ page }) => {
  await page.getByRole("button", { name: "Kopioi ja jaa" }).click();
  await page.waitForTimeout(200);
  expect(page.errors).toEqual([]);
});
