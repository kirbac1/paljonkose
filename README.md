# Paljonko se on?

Suomen valtion ja kaupunkien menoeriä muutettuna arkisiksi yksiköiksi.
Neutraali suunnittelultaan: kaikki budjettirivit näkyvissä, yksikköhinnat
lukijan muokattavissa, varaukset esillä eikä piilotettuna.

Tuotanto: **paljonkose.fi**

---

## Rakenne

- [`files/`](files/README.md) — Express-palvelin: `/api/data`, jaettavat
  `/p/…`-sivut, `/ylitykset/`, `/kuitti/`, `/summa/`. Palvelee myös
  etusivun (`files/public/`), joka rakennetaan `web/`:stä deployn
  yhteydessä — `files/public/`:ssa ei enää ole omaa lähdekoodia. Vanha
  vanilla JS -etusivu on poistettu repostä kokonaan.
- [`web/`](web/README.md) — React + TypeScript, **etusivun
  tuotantototeutus**. `npm run build` kirjoittaa `files/public/`-
  hakemistoon; `deploy.yml` ajaa tämän ennen jokaista julkaisua.
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
cd files && npm run test:e2e  # Playwright — rakennettu React-etusivu oikeassa selaimessa
cd web   && npm test          # Vitest — React-komponentit ja laskentalogiikka
```

Tarkemmat kuvaukset kummankin testijoukon kattavuudesta:
[`files/README.md`](files/README.md#testaus) ja
[`web/README.md`](web/README.md#testaus-paikallisesti).

---

## CI/CD

[`.github/workflows/`](.github/workflows/) ajaa testit (`test.yml`,
kutsuttuna sekä `ci.yml`:stä että `deploy.yml`:stä) jokaisella pushilla ja
PR:llä. `main`-haaraan pushatessa `deploy.yml` rakentaa `web/`:n
(`files/public/`-hakemistoon), rsynkkaa `files/`-hakemiston Plesk-
palvelimelle, asentaa riippuvuudet siellä ja käynnistää sovelluksen
uudelleen Passengerin kautta.

## Tuotantoon

Automaattinen: push `main`-haaraan, katso `Actions`-välilehti. Manuaalinen
vaihtoehto ja pystytysohjeet: [`DEPLOYMENT.md`](DEPLOYMENT.md). Docker-
pohjaiselle ajolle: [`files/README.md`](files/README.md#tuotantoon).
