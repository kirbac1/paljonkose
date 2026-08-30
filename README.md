# Paljonko se on?

Suomen valtion ja kaupunkien menoeriä muutettuna arkisiksi yksiköiksi.
Neutraali suunnittelultaan: kaikki budjettirivit näkyvissä, yksikköhinnat
lukijan muokattavissa, varaukset esillä eikä piilotettuna.

Tuotanto: **paljonkose.fi**

---

## Rakenne

- [`files/`](files/README.md) — Express-palvelin: `/api/data`, jaettavat
  `/p/…`-sivut, `/ylitykset/`, `/kuitti/`, `/summa/`. Tätä tarvitaan
  taustalla molemmille etusivuille. Sisältää myös **vanhan vanilla JS
  -etusivun** (`public/index.html`), joka on nyt legacy-toteutus —
  korvautumassa `web/`:llä.
- [`web/`](web/README.md) — React + TypeScript, **etusivun uusi ja
  tuleva tuotantototeutus**. Käyttää samaa `files/`-backendia
  `/api/data`:n ja jaettavien sivujen kautta. Ei vielä kytketty
  julkaisuputkeen (`npm run build` kirjoittaa `files/public/`-hakemistoon,
  mutta deploy ei vielä aja sitä).
- [`deploy/`](deploy/) — GitHub Actionsin deploy-workflow.
- [`DEPLOYMENT.md`](DEPLOYMENT.md), [`READY-TO-DEPLOY.md`](READY-TO-DEPLOY.md) —
  SSH-pohjaisen automaattikäyttöönoton pystytys ja tila.

---

## Pikakäynnistys

```bash
npm install
npm run dev
```

Avaa <http://localhost:3000>. Katso [`files/README.md`](files/README.md)
mitä sivuja löytyy ja miten dataa muokataan.

---

## Testaus

```bash
cd files && npm test          # Vitest — render.mjs:n laskentafunktiot
cd files && npm run test:e2e  # Playwright — etusivun laskuri oikeassa selaimessa
cd web   && npm test          # Vitest — React-prototyypin komponentit ja logiikka
```

Tarkemmat kuvaukset kummankin testijoukon kattavuudesta:
[`files/README.md`](files/README.md#testaus) ja
[`web/README.md`](web/README.md#testaus-paikallisesti).

---

## CI/CD

[`.github/workflows/`](.github/workflows/) ajaa testit (`test.yml`,
kutsuttuna sekä `ci.yml`:stä että `deploy.yml`:stä) jokaisella pushilla ja
PR:llä. `main`-haaraan pushatessa `deploy.yml` rsynkkaa `files/`-hakemiston
Plesk-palvelimelle, asentaa riippuvuudet siellä ja käynnistää sovelluksen
uudelleen Passengerin kautta. `web/` ei ole vielä osa julkaisuputkea.

## Tuotantoon

Automaattinen: push `main`-haaraan, katso `Actions`-välilehti. Manuaalinen
vaihtoehto ja pystytysohjeet: [`DEPLOYMENT.md`](DEPLOYMENT.md). Docker-
pohjaiselle ajolle: [`files/README.md`](files/README.md#tuotantoon).
