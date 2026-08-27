/**
 * app.js — Passengerin käynnistystiedosto (CommonJS).
 *
 * Plesk/Passenger lataa käynnistystiedoston require()-kutsulla, mutta
 * server.mjs on ES-moduuli. Tämä kääre lataa sen dynaamisella import()-
 * kutsulla, joka toimii CommonJS-tiedostosta käsin.
 *
 * package.json:issa EI ole "type": "module" — se tekisi tästä tiedostosta
 * ESM:n ja require() kaatuisi. Kaikki muut tiedostot ovat .mjs-päätteisiä,
 * joten ne ovat ES-moduuleja joka tapauksessa.
 *
 * Plesk: Application Startup File = app.js
 * Porttia ei tarvitse asettaa — Passenger antaa sen PORT-muuttujassa.
 */
import("./server.mjs").catch(err => {
  console.error("Palvelimen käynnistys epäonnistui:", err);
  process.exit(1);
});
