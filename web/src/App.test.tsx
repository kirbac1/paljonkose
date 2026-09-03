import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

/**
 * Component tests. These run against the real DOM, because type-checking
 * only tells you the code compiles — it doesn't tell you the handler
 * works. In an earlier version, exactly this gap let a bug into
 * production where switching the spending item left the unit unchanged.
 */

beforeEach(() => {
  // no API in the test: the app uses the fallback figures compiled into the page
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));

  /* Language is read from the address, and jsdom's address persists
     between tests. Without resetting it, the language-switch test leaves
     ?lang=en in effect and later tests run in the wrong language — state
     leaks from one test to the next. */
  window.history.replaceState(null, "", "/");
});

const count = () => screen.getByTestId("count").textContent ?? "";

describe("App", () => {
  it("shows the calculation result immediately", async () => {
    render(<App />);
    expect(await screen.findByTestId("count")).toBeInTheDocument();
    expect(count()).not.toBe("");
  });

  it("tells the reader if the figures failed to load", async () => {
    render(<App />);
    expect(await screen.findByRole("status")).toHaveTextContent(/tallennetut arvot/i);
  });

  it("switches language without a page reload", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Paljonko se on?");

    await user.click(screen.getByRole("button", { name: "In English" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("What would that buy?");

    // and back — the button must not disappear in either direction
    await user.click(screen.getByRole("button", { name: "Suomeksi" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Paljonko se on?");
  });

  it("filters spending items by region", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Tampere" }));

    const select = screen.getByLabelText("Valitse menoerä");
    const groups = within(select).getAllByRole("group");
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveAttribute("label", "Tampere");
  });

  it("calculates the reader's own sum", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText("Summa euroina"), "340000000");
    await user.click(screen.getByRole("button", { name: "Paljonko se on?" }));
    expect(count()).not.toBe("0");
  });

  it("picks a unit a small sum is enough for", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText("Summa euroina"), "500");
    await user.click(screen.getByRole("button", { name: "Paljonko se on?" }));
    // must not land on zero: either whole units or a fraction
    expect(count()).not.toBe("0");
  });

  /* Server-rendered pages are easy to forget in a rewrite: they aren't
     React routes, so nothing crashes if the links disappear. That
     happened once — that's why this test exists. */
  it("links to server-rendered pages", () => {
    render(<App />);
    const nav = screen.getByRole("navigation", { name: "Muut sivut" });
    const hrefs = within(nav).getAllByRole("link").map(a => a.getAttribute("href"));
    expect(hrefs).toEqual(["/ylitykset/", "/kuitti/"]);
  });

  it("switches the page links along with the language", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "In English" }));
    const nav = screen.getByRole("navigation", { name: "More pages" });
    const hrefs = within(nav).getAllByRole("link").map(a => a.getAttribute("href"));
    expect(hrefs).toEqual(["/en/overruns/", "/en/tax-receipt/"]);
  });

  it("resets the reader's edited price when the spending item changes", async () => {
    const user = userEvent.setup();
    render(<App />);

    const price = screen.getByLabelText<HTMLInputElement>("Yksikköhinta euroina");
    const original = price.value;

    await user.clear(price);
    await user.type(price, "99999");
    expect(price.value).toBe("99999");

    // An edited price must not carry over to the next item — that would
    // be a silent error where the reader sees a wrong number and
    // believes it's correct.
    const items = screen.getByLabelText<HTMLSelectElement>("Valitse menoerä");
    const other = [...items.options].find(o => o.value !== items.value);
    expect(other).toBeDefined();
    await user.selectOptions(items, other!.value);

    expect(price.value).toBe(original);
  });
});

/* The share button has now been wrong four times: linking to the homepage
   instead of the calculation; copying whichever hostname the reader happened
   to be on; dumping an unformatted integer; and putting a whole sentence on
   the clipboard so the result could not be pasted as a link. Every one of
   them failed silently — the button says "Kopioitu ✓" regardless. */
describe("share button", () => {
  async function copyShareText(): Promise<string> {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Kopioi ja jaa" }));
    return navigator.clipboard.readText();
  }

  it("copies a bare URL and nothing else", async () => {
    const copied = await copyShareText();

    // Must survive being pasted straight into an address bar: no prose, no
    // whitespace, parseable as a URL on its own.
    expect(copied).not.toMatch(/\s/);
    expect(() => new URL(copied)).not.toThrow();
    expect(new URL(copied).protocol).toMatch(/^https?:$/);
  });

  it("links to the calculation's own page, not the homepage", async () => {
    expect(new URL(await copyShareText()).pathname).toMatch(/^\/p\/[a-z0-9-]+\/$/);
  });
});
