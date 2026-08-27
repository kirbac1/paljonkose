# Asennus Pleskiin (Passenger)

Sovelluksen juuri: `.../paljonkose/current/files`

## Plesk-asetukset

- **Application Root**: `.../paljonkose/current/files`
- **Application Startup File**: `app.js`
- **Application Mode**: production
- **Node.js**: 20 tai uudempi

## Ympäristömuuttujat

| Muuttuja | Arvo | Pakollinen |
|---|---|---|
| `SITE_URL` | `https://paljonkose.fi` | **Kyllä** |
| `PORT` | — | Ei, Passenger antaa |
| `RELOAD_TOKEN` | satunnainen merkkijono | Vain `/api/reload`-reitille |

## Kaksi sääntöä, jotka rikkovat sovelluksen jos unohtuvat

**1. `package.json`:iin ei saa lisätä `"type": "module"`.**
Passenger lataa käynnistystiedoston `require()`-kutsulla. `app.js` on
CommonJS-kääre, joka lataa ESM-palvelimen dynaamisella `import()`-kutsulla.
`"type": "module"` tekisi `app.js`:stä ESM:n ja `require()` kaatuisi.
Muut tiedostot ovat `.mjs`, joten ne ovat ES-moduuleja ilman asetusta.

**2. Polut lasketaan `server.mjs`:n sijainnista, ei työhakemistosta.**
Passenger ei takaa työhakemistoa. `data.json` ja `public/` luetaan
absoluuttisina polkuina `import.meta.url`:n kautta. Älä muuta niitä
suhteellisiksi — se toimii kehityksessä ja hajoaa tuotannossa hiljaa.

## 301-silmukan selvitys

Jos selain valittaa liiallisista uudelleenohjauksista, sovellus ei ole syy —
se ei tee yhtään redirectiä. Paikanna se näin:

```bash
curl -sIL https://paljonkose.fi/ | grep -i "^HTTP\|^location"
```

Yleisimmät syyt Pleskissä:

- **HTTP→HTTPS-uudelleenohjaus päällä kahdesti** — sekä Pleskin
  "Permanent SEO-safe 301 redirect" että oma direktiivi nginxissä
- **www ↔ ei-www kiertää kehää** — molemmat ohjaavat toisiinsa
- **Hosting-asetusten redirect osoittaa itseensä**

Tarkista Plesk → Hosting Settings → onko HTTPS-redirect päällä, ja
Apache & nginx Settings → onko lisädirektiiveissä toinen redirect.
Vain toinen saa olla.

Testaa aina `curl`illa, älä selaimella: selain välimuistittaa 301:n
pysyvästi, joten korjaus ei näy ennen kuin tyhjennät välimuistin.

## Asennuksen jälkeen

```bash
npm install --production
mkdir -p tmp && touch tmp/restart.txt
```

Tarkista järjestyksessä:

```
/healthz                    → {"ok":true,...}   palvelin elää
/                           → etusivu           staattiset toimivat
/ylitykset/                 → taulukko          reitit toimivat
/p/lansirata-pk/og.png      → PNG               natiivimoduuli toimii
```

Jos `/healthz` vastaa mutta `og.png` ei, `@resvg/resvg-js` ei kääntynyt
palvelimen arkkitehtuurille. Aja `npm rebuild @resvg/resvg-js`
palvelimella — älä kopioi `node_modules`ia koneeltasi.

Käynnistyslokiin tulostuu `Juuri: <polku>`. Jos se ei ole
`.../current/files`, polut osoittavat väärään paikkaan.

## Lukujen päivitys

```bash
npm run data
```

Aja kerran käsin ja **lue tuloste** — se on ainoa paikka, josta näet
tulivatko luvut rajapinnasta vai jäivätkö varaluvut voimaan.
