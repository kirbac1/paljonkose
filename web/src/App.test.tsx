import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

/**
 * Komponenttitestit. Nämä ajavat oikeaa DOMia vastaan, koska tyypintarkistus
 * kertoo vain että koodi kääntyy — se ei kerro että käsittelijä toimii.
 * Aiemmassa versiossa juuri tämä ero päästi tuotantoon bugin, jossa
 * menoerän vaihto jätti yksikön ennalleen.
 */

beforeEach(() => {
  // ei rajapintaa testissä: sovellus käyttää sivulle käännettyjä varalukuja
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));

  /* Kieli luetaan osoitteesta, ja jsdomin osoite säilyy testien välillä.
     Ilman nollausta kielenvaihtotesti jättää ?lang=en voimaan ja seuraavat
     testit ajavat väärällä kielellä — tila vuotaa testistä toiseen. */
  window.history.replaceState(null, "", "/");
});

const count = () => screen.getByTestId("count").textContent ?? "";

describe("App", () => {
  it("näyttää laskutoimituksen tuloksen heti", async () => {
    render(<App />);
    expect(await screen.findByTestId("count")).toBeInTheDocument();
    expect(count()).not.toBe("");
  });

  it("kertoo lukijalle jos luvut eivät latautuneet", async () => {
    render(<App />);
    expect(await screen.findByRole("status")).toHaveTextContent(/tallennetut arvot/i);
  });

  it("vaihtaa kielen ilman sivunlatausta", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Paljonko se on?");

    await user.click(screen.getByRole("button", { name: "In English" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("What would that buy?");

    // ja takaisin — nappi ei saa kadota kummassakaan suunnassa
    await user.click(screen.getByRole("button", { name: "Suomeksi" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Paljonko se on?");
  });

  it("suodattaa menoerät alueen mukaan", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Tampere" }));

    const select = screen.getByLabelText("Valitse menoerä");
    const groups = within(select).getAllByRole("group");
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveAttribute("label", "Tampere");
  });

  it("laskee lukijan oman summan", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText("Summa euroina"), "340000000");
    await user.click(screen.getByRole("button", { name: "Paljonko se on?" }));
    expect(count()).not.toBe("0");
  });

  it("valitsee pienelle summalle yksikön, johon se riittää", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText("Summa euroina"), "500");
    await user.click(screen.getByRole("button", { name: "Paljonko se on?" }));
    // ei saa jäädä nollaan: joko kappaleita tai osuus
    expect(count()).not.toBe("0");
  });

  /* Palvelimen renderöimät sivut ovat helppo unohtaa uudelleenkirjoituksessa:
     ne eivät ole React-reittejä, joten mikään ei kaadu jos linkit katoavat.
     Näin kävi kerran — siksi tämä testi on olemassa. */
  it("linkittää palvelimen renderöimille sivuille", () => {
    render(<App />);
    const nav = screen.getByRole("navigation", { name: "Muut sivut" });
    const hrefs = within(nav).getAllByRole("link").map(a => a.getAttribute("href"));
    expect(hrefs).toEqual(["/nostot/", "/ylitykset/", "/kuitti/"]);
  });

  it("vaihtaa myös sivulinkit kielen mukana", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "In English" }));
    const nav = screen.getByRole("navigation", { name: "More pages" });
    const hrefs = within(nav).getAllByRole("link").map(a => a.getAttribute("href"));
    expect(hrefs).toEqual(["/en/highlights/", "/en/overruns/", "/en/tax-receipt/"]);
  });

  it("nollaa lukijan muokkaaman hinnan kun menoerä vaihtuu", async () => {
    const user = userEvent.setup();
    render(<App />);

    const price = screen.getByLabelText<HTMLInputElement>("Yksikköhinta euroina");
    const original = price.value;

    await user.clear(price);
    await user.type(price, "99999");
    expect(price.value).toBe("99999");

    // Muokattu hinta ei saa siirtyä seuraavaan erään — se olisi hiljainen
    // virhe, jossa lukija näkee väärän luvun uskoen sitä oikeaksi.
    const items = screen.getByLabelText<HTMLSelectElement>("Valitse menoerä");
    const other = [...items.options].find(o => o.value !== items.value);
    expect(other).toBeDefined();
    await user.selectOptions(items, other!.value);

    expect(price.value).toBe(original);
  });
});
