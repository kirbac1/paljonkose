# Paljonko se on?

Suomen valtion ja kaupunkien menoeriä muutettuna arkisiksi yksiköiksi.
Neutraali suunnittelultaan: kaikki budjettirivit näkyvissä, yksikköhinnat
lukijan muokattavissa, varaukset esillä eikä piilotettuna.

Tuotanto: **paljonkose.fi**

---

## Pikakäynnistys

```bash
npm install
npm run dev
```

Avaa <http://localhost:3000>. Siinä kaikki — `data.json` on repossa valmiina.

---

## Mitä katsoa

- `/` — etusivu: menoerän ja yksikön valinta, oma summa, sekuntikello
- `/ylitykset/` — arvio vs. toteutunut, mediaanikerroin
- `/kuitti/45000/` — verokuitti: mihin valtion tuloverosi menee
- `/summa/340000000/` — mikä tahansa summa arkisiksi yksiköiksi
- `/p/lansirata-pk/` — sivu, jolla näkyy sekä ylitysennuste että kilpailevat hankkeet
- `/p/ark-burgeri-pork/` — arkiostos ja ×5,6 M -silta
- `/sitemap.xml` — kaikki 282 sivua

---

## Komennot

- `npm run dev` — kehityspalvelin portissa 3000
- `npm run data` — hakee luvut rajapinnoista, kirjoittaa `data.json`
- `npm run pages` — rakentaa staattiset sivut `dist/`-hakemistoon
- `npm run build` — `data` + `pages`
- `npm start` — tuotantopalvelin (lue `PORT` ja `SITE_URL` ympäristöstä)

---

## Tiedostot

- `server.mjs` — Express-palvelin, kaikki reitit
- `render.mjs` — **jaettu renderöinti**; sekä palvelin että staattinen build käyttävät tätä, joten sivut ovat aina identtiset
- `fetch-data.mjs` — datan haku ja `data.json`:in kirjoitus. **Kaikki luvut, yksikköhinnat ja pääluokat määritellään täällä**
- `data.json` — generoitu, mutta committoitu, jotta sivu toimii ilman rajapintoja
- `public/index.html` — etusivu, jota palvelin tarjoilee
- `paljonko-se-on.html` — identtinen kopio, jonka voi avata selaimessa ilman palvelinta
- `build-pages.mjs` — staattinen generaattori (valinnainen)
- `Dockerfile`, `docker-compose.yml`, `nginx-paljonkose.conf` — tuotanto

---

## Datan muokkaus

Kaikki luvut ovat `fetch-data.mjs`:ssä, eivät `data.json`:issa.

- Lisää menoerä → `PLAN.items`
- Lisää yksikkö → `PLAN.units`
- Merkitse arkiostos → `arki: true` sekä erässä että yksikössä. Tämä estää
  miljardien näyttämisen porkkanakiloina ja päinvastoin
- Anna alkuperäinen kustannusarvio → `arvio: <luku>`. Skripti luo ylityserän
  automaattisesti ja päivittää mediaanikertoimen
- Merkitse hankkeet, jotka kilpailevat samasta rahasta → sama `paatos:`-tunnus

Muutoksen jälkeen:

```bash
npm run data
```

**Etusivun varaluvut on synkattava erikseen.** `public/index.html` sisältää
kopion datasta (`ITEMS_FALLBACK`, `UNITS_FALLBACK`, `SCOPES_FALLBACK`), jotta
sivu toimii vaikka `data.json` ei latautuisi. Ne eivät päivity itsestään.
Muista myös kopioida `public/index.html` → `paljonko-se-on.html`.

---

## Testaus

Selaimessa ajettava testi kannattaa pitää mukana — `node --check` kertoo vain,
että tiedosto jäsentyy, ei sitä että käsittelijä kaatuu ajossa.

```bash
npm install --no-save jsdom
node test-dom.mjs
```

Testi käy läpi kaikki menoerät, klikkaa nappeja ja raportoi konsolivirheet.

---

## Tuotantoon

```bash
echo "RELOAD_TOKEN=$(openssl rand -hex 16)" > .env
docker compose up -d
curl localhost:3000/healthz
```

Sitten reverse proxy ja sertifikaatti:

```bash
sudo cp nginx-paljonkose.conf /etc/nginx/sites-available/paljonkose.fi
sudo ln -s /etc/nginx/sites-available/paljonkose.fi /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d paljonkose.fi -d www.paljonkose.fi
```

Compose nostaa kaksi konttia:

- `web` — palvelin
- `updater` — hakee luvut kerran vuorokaudessa ja kutsuu `/api/reload`.
  Ei uudelleenkäynnistystä, ei katkosta

---

## Ennen julkaisua

Nämä ovat oikeita esteitä, eivät viimeistelyä.

- [ ] **Aja `npm run data` palvelimella ja lue tuloste.** Se on ainoa paikka,
      josta näet tulivatko luvut rajapinnasta vai jäivätkö varaluvut voimaan.
      Sandboxissa verkko oli estetty, joten mitään ei ole testattu oikeaa
      rajapintaa vasten
- [ ] **Tarkista veroasteikko `render.mjs`:n `ASTEIKKO_2026`-taulukosta.**
      Väärä asteikko on pahempi virhe kuin väärä päiväkodin hinta, koska lukija
      vertaa sitä omaan verokorttiinsa ja huomaa eron heti
- [ ] **Tarkista kaikki TARKISTA-merkinnät** `fetch-data.mjs`:ssä —
      kaupunkien budjetit, Tampereen areena, Turun ratikka
- [ ] Varmista Länsimetron lopullinen hinta (1 088 vai 1 186 M€, oikeuskäsittely
      kesken)
- [ ] Varmista Valtiokonttorin momenttitunnukset ja StatFinin taulutunnukset
- [ ] Etsi Kuntien taloustietojen taulu kaupunkien budjettien hakuun
- [ ] Tarkista pääluokkien jako — nyt käsin kirjattu, summautuu 91,3 mrd €:iin
- [ ] Lisää brändifontit `./fonts/`-hakemistoon, jotta jakokuvat vastaavat sivua
- [ ] Aseta `RELOAD_TOKEN` `.env`-tiedostoon
- [ ] Anna verokuitti verotusta tuntevan luettavaksi. Se on sivuston ainoa kohta,
      joka väittää jotain lukijan omasta rahasta, ja siksi ensimmäinen asia,
      jota kritisoidaan

---

## Suunnittelun periaatteet

Nämä eivät ole mielipiteitä vaan syitä, joiden takia koodi on kuten on.
Kannattaa lukea ennen kuin muuttaa niitä.

- **Jokainen luku kantaa alkuperänsä.** Sivu näyttää mistä luku on haettu,
  milloin, ja onko se virallinen vai arvio
- **Yksikköhinnat ovat muokattavissa.** Lukija saa olla eri mieltä, ja muokattu
  hinta näkyy jakokuvassa asti
- **Varaukset ovat näkyvissä.** Erityisesti fungibiliteetti: raha ei ole
  vapaasti siirrettävissä hallinnonalojen välillä. Vertailu hävittäjän ja
  päiväkodin välillä ei ole aito valinta, ja sivu sanoo sen itse
- **Aito vertailu erotellaan.** Neljä ratahanketta kilpailee samasta
  määrärahasta — vain siinä laatikossa lukee, että vertailu on todellinen
- **Ylitysrekisteri sisältää alitukset.** Rantatunneli (0,98×) on mukana
  Kruunusiltojen (2,11×) rinnalla. Ilman sitä koko rekisteri olisi
  syytettävissä agendasta
- **Mediaani, ei keskiarvo**, jottei yksi karkaava hanke vääristä kuvaa
- **Arkiostoksissa ei paheita.** Tupakka ja alkoholi olisivat klikatuimmat ja
  samalla ainoa asia, joka kääntäisi sivuston moralisoivaksi. Ne on jätetty
  tietoisesti pois
- **Arkiostoksissa ei "sinun osuuttasi"** vaan ×5,6 M -silta. Vertailu puhuu
  joukosta, ei lukijan valinnoista
