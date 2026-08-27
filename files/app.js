/**
 * app.js — Passengerin käynnistystiedosto (CommonJS).
 * Plesk: Application Startup File = app.js
 * package.json:iin EI saa lisätä "type": "module" — se rikkoisi require():n.
 */
import("./server.mjs").catch(err => {
  console.error("Palvelimen käynnistys epäonnistui:", err);
  process.exit(1);
});
