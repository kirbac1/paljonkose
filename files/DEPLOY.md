# Asennus Pleskiin (Passenger)

Sovelluksen juuri palvelimella on `.../current/files`, joten kaikki tämän
paketin tiedostot menevät repon `files/`-hakemistoon.

## Plesk-asetukset

- **Application Root**: `.../paljonkose/current/files`
- **Application Startup File**: `app.js`
- **Application Mode**: production
- **Node.js version**: 20 tai uudempi

## Ympäristömuuttujat

| Muuttuja | Arvo | Pakollinen |
|---|---|---|
| `SITE_URL` | `https://paljonkose.fi` | **Kyllä** |
| `PORT` | — | Ei, Passenger antaa |
| `RELOAD_TOKEN` | satunnainen merkkijono | Vain jos käytät `/api/reload` |

**`SITE_URL` on pakollinen.** Ilman sitä canonical-osoitteet ja jakokuvien
URL:t osoittavat localhostiin. Sivu toimii, mutta jaot ja hakukonenäkyvyys
rikkoutuvat hiljaa ilman virheilmoitusta.

## Miksi app.js on olemassa

Passenger lataa käynnistystiedoston `require()`-kutsulla, mutta `server.mjs`
on ES-moduuli. `app.js` on CommonJS-kääre, joka lataa sen dynaamisella
`import()`-kutsulla.

Tästä seuraa yksi sääntö: **`package.json`:iin ei saa lisätä
`"type": "module"`.** Se tekisi `app.js`:stä ESM:n ja Passengerin `require()`
kaatuisi. Muut tiedostot ovat `.mjs`-päätteisiä, joten ne ovat ES-moduuleja
joka tapauksessa — asetusta ei tarvita mihinkään.

## Asennuksen jälkeen

```bash
npm install --production
touch tmp/restart.txt      # Passenger lataa sovelluksen uudelleen
```

Tarkista:

```
https://paljonkose.fi/healthz     → {"ok":true,"generated":"..."}
https://paljonkose.fi/            → etusivu
https://paljonkose.fi/ylitykset/  → arvio vs. toteutunut
https://paljonkose.fi/kuitti/45000/
https://paljonkose.fi/summa/340000000/
https://paljonkose.fi/p/lansirata-pk/og.png   → PNG-kuva
```

Jos `/healthz` vastaa mutta `og.png` ei, `@resvg/resvg-js` ei kääntynyt
palvelimen arkkitehtuurille. Se on natiivimoduuli — aja `npm rebuild
@resvg/resvg-js` palvelimella, älä kopioi `node_modules`ia koneeltasi.

## Lukujen päivitys

`data.json` on repossa, joten sivu toimii ilman rajapintoja. Päivitys:

```bash
npm run data
```

Aja tämä kerran käsin palvelimella ja **lue tuloste**. Se on ainoa paikka,
josta näet tulivatko luvut oikeasti rajapinnasta vai jäivätkö varaluvut
voimaan. Sen jälkeen voit ajastaa sen cronilla tai jättää GitHub Actionsin
hoidettavaksi.
