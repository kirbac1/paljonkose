# Yhdistäminen olemassa olevaan repoon

Tässä paketissa on **vain sovelluskoodi**. Deploy-tiedostot on jätetty
tarkoituksella pois, koska reposi käyttää Pleskiä ja GitHub Actionsia,
eikä niitä pidä ylikirjoittaa.

## Kopioi sellaisenaan

Nämä ovat uusia tai kokonaan korvattavia:

- `render.mjs`
- `server.mjs`
- `fetch-data.mjs`
- `build-pages.mjs`
- `data.json`
- `public/index.html`
- `paljonko-se-on.html`
- `test-dom.mjs`
- `.env.example`

## Tarkista käsin

- **`package.json`** — koodi tarvitsee `express` ja `@resvg/resvg-js`.
  Sinulla on jälkimmäinen jo (commit 98addb7). Tarvittavat skriptit:

  ```json
  "type": "module",
  "scripts": {
    "data":  "node fetch-data.mjs",
    "pages": "node build-pages.mjs",
    "build": "npm run data && npm run pages",
    "start": "node server.mjs",
    "dev":   "PORT=3000 SITE_URL=http://localhost:3000 node server.mjs"
  }
  ```

  **`"type": "module"` on pakollinen** — kaikki tiedostot ovat ES-moduuleja.

- **`.gitignore`** — varmista että sisältää `node_modules/`, `dist/`, `.env`

- **Ympäristömuuttujat Pleskissä**:
  - `SITE_URL=https://paljonkose.fi` — ilman tätä canonical-osoitteet ja
    jakokuvien URL:t osoittavat localhostiin
  - `PORT` — Pleskin antama
  - `RELOAD_TOKEN` — vain jos käytät `/api/reload`-reittiä

## Älä kopioi

Näitä ei ole paketissa, koska ne olettavat Docker-deployn:

- `Dockerfile`, `docker-compose.yml` — sinä deployaat Pleskillä
- `nginx-paljonkose.conf` — sinulla on nginx-direktiivit Pleskissä
- `.github/workflows/` — sinulla on jo CI ja auto-deploy

## Vaiheet

```bash
cd /Users/ugurkirbac/Desktop/Projects/paljonkose
git checkout -b uudet-sivut
# kopioi paketin tiedostot tähän hakemistoon
git status                 # katso mitä muuttui ennen kuin lisäät
npm install
npm run dev                # http://localhost:3000
npm install --no-save jsdom && node test-dom.mjs
git add -A && git commit -m "Ylitysrekisteri, verokuitti, vapaa summa ja arkiostokset"
git push -u origin uudet-sivut
```

Haaralle siksi, että CI ehtii ajaa ennen kuin tämä osuu `main`iin ja
auto-deploy vie sen tuotantoon.

## Uudet reitit

Jos deploy tarjoilee vain staattisia tiedostoja, nämä eivät toimi —
ne vaativat että `server.mjs` on käynnissä Node-prosessina:

- `/ylitykset/`
- `/kuitti/` ja `/kuitti/:ansio/`
- `/summa/` ja `/summa/:summa/`
- `/p/:slug/` ja `/p/:slug/og.png`
- `/api/data`, `/api/top`, `/api/share/:slug`, `/api/reload`
- `/sitemap.xml`, `/healthz`
