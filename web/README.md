# Paljonko se on? — käyttöliittymä

React + TypeScript -toteutus laskimesta — **etusivun tuotantototeutus**.
`npm run build` kirjoittaa `../files/public/`-hakemistoon, jota
`deploy.yml` ajaa jokaisen julkaisun yhteydessä; vanha vanilla JS
-versio elää enää `../files/paljonko-se-on.html`:ssä, koskemattomana
referenssinä. Palvelin (`server.mjs`) pysyy ennallaan ja tarjoaa datan
osoitteessa `/api/data` sekä jaettavat sivut osoitteissa `/p/…`,
`/ylitykset/` ja `/kuitti/`.

## Komennot

```bash
npm install
npm run dev        # Vite, portti 5173, /api välitetään porttiin 3000
npm test           # Vitest — 19 testiä
npm run typecheck  # tsc --noEmit, strict
npm run build      # tyypit + tuotantokäännös
npm run fallback   # kirjoittaa ../data.json varaluvuiksi
```

`npm run dev` olettaa että Express-palvelin on käynnissä portissa 3000.

## Testaus paikallisesti

Kaksi palvelinta pyörii rinnakkain kehityksessä — Vite tarjoaa tämän
React-sovelluksen, Express tarjoaa datan ja jaettavat sivut.

1. Käynnistä Express-palvelin toisessa terminaalissa, projektin
   `files/`-hakemistosta:

   ```bash
   cd ../files
   npm run dev        # portti 3000
   ```

2. Käynnistä tämän hakemiston Vite-kehityspalvelin:

   ```bash
   npm run dev        # portti 5173, /api, /p, /ylitykset, /kuitti → :3000
   ```

3. Avaa <http://localhost:5173>. Jos portti 3000 ei vastaa, sovellus ei
   kaadu — se näyttää `data/fallback.ts`:n varaluvut ja kertoo siitä
   lukijalle (`useData`-hookin `stale`-tila).

Yksikkötestit eivät tarvitse kumpaakaan palvelinta käyntiin — ne ajavat
jsdomissa eristettyinä:

```bash
npm test           # lib/calc.test.ts + App.test.tsx, 19 testiä
```

## Rakenne

```
src/
  types.ts              tietomalli — sopimus palvelimen kanssa
  i18n.ts               tekstit ja nimikkeet, fi/en
  lib/calc.ts           laskutoimitus, puhtaita funktioita
  lib/format.ts         luvut ja valuutta kielen mukaan
  hooks/useData.ts      datan haku, varaluvut jos rajapinta ei vastaa
  hooks/useLang.ts      kieli polusta tai parametrista
  components/           esitys, ei logiikkaa
    SiteLinks.tsx       linkit palvelimen renderöimille sivuille
  data/fallback.ts      GENEROITU — älä muokkaa
```

## Miksi näin

**Laskenta on erillään Reactista.** `lib/calc.ts` ei tunne komponentteja,
joten sen voi testata ilman renderöintiä. Kymmenen testiä ajaa 8
millisekunnissa, mikä pitää ne käytössä.

**Tyhjä data käsitellään erikseen.** `noUncheckedIndexedAccess` on päällä,
joten `items[0]` on `Item | undefined`. Sovellus näyttää latausviestin sen
sijaan että kaatuisi `!`-operaattoriin — vika ajossa olisi ilmennyt
väärässä paikassa.

**Varaluvut generoidaan.** `data/fallback.ts` on käännetty `data.jsonista`.
Käsin ylläpidetty kopio erkaantuisi, ja ero näkyisi vain silloin kun
rajapinta on jo alhaalla.

**Hinta-kenttä pitää oman merkkijononsa.** Ilman sitä kenttää ei voi
tyhjentää: tyhjä tulkittaisiin nollaksi, hinta palautuisi yksikön omaksi
ja luku ilmestyisi takaisin kesken kirjoittamisen. Tämän löysi testi, ei
lukeminen.

**Palvelimen sivuille on testi.** `/ylitykset/` ja `/kuitti/` eivät ole
React-reittejä, joten mikään ei kaadu jos linkit katoavat
uudelleenkirjoituksessa. Niin kävi kerran — nyt `App.test.tsx` kiinnittää
osoitteet, ja `../files/tests/e2e/calculator.spec.mjs` klikkaa ne oikeasti
auki rakennettua sivua vasten. (`/nostot/`-linkki poistettiin kokonaan —
sillä ei koskaan ollut vastaavaa palvelinreittiä.)

**Kielenvaihto ei lataa sivua.** Aiempi versio navigoi osoitteeseen `/en/`,
mikä toimi vain palvelimella; staattisella isännällä lukija päätyi
404-sivulle ja nappi näytti katoavan.

## Mitä testit kattavat

- `lib/calc.test.ts` — jakolasku, osuus kun summa jää yksikköä pienemmäksi,
  muokatun hinnan tunnistus, kelvoton syöte, per capita erän omalla
  väkiluvulla, nostojen suodatus, kilpailevat hankkeet
- `App.test.tsx` — renderöityy, kertoo epäonnistuneesta latauksesta,
  kielenvaihto molempiin suuntiin, aluesuodatus, lukijan oma summa,
  pieni summa saa kelvollisen yksikön, muokattu hinta nollautuu erän
  vaihtuessa, linkit palvelimen sivuille ja niiden kielikohtaiset osoitteet

## Vielä tekemättä

- Reitit `/ylitykset/` ja `/kuitti/` renderöi yhä palvelin. Ne toimivat,
  mutta jakavat logiikkaa `render.mjs`:n kanssa
- Ei virheiden kasausta eikä metriikkaa
